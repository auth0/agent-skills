#!/usr/bin/env python3
"""
Auth0 Agent Skills Evaluation Runner

Runs evaluations against Auth0 skills using:
- Deterministic graders for automated checks
- Model-assisted rubric scoring (LLM-as-judge)
- Agent execution mode via Claude Code
- Debug mode for saving intermediate outputs
"""

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import yaml
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# Add graders to path
sys.path.insert(0, str(Path(__file__).parent))

from graders import Auth0ReactGrader, Auth0QuickstartGrader, GraderResult
from graders.auth0_quickstart import ExecutionTrace

# Optional anthropic import for LLM-as-judge
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class TestCase:
    """A single test case from a dataset."""
    id: str
    prompt: str
    scaffold: str
    expected_checks: list[str]
    should_trigger: bool
    notes: str = ""


@dataclass
class AgentOutput:
    """Captured output from agent execution."""
    raw_output: str
    exit_code: int
    duration_seconds: float
    files_modified: list[str] = field(default_factory=list)
    files_created: list[str] = field(default_factory=list)
    commands_executed: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_output": self.raw_output,
            "exit_code": self.exit_code,
            "duration_seconds": self.duration_seconds,
            "files_modified": self.files_modified,
            "files_created": self.files_created,
            "commands_executed": self.commands_executed,
        }


@dataclass
class RubricScore:
    """Score from LLM-as-judge evaluation."""
    security_practices: dict[str, Any]
    user_consent: dict[str, Any]
    framework_alignment: dict[str, Any]
    instruction_following: dict[str, Any]
    overall_notes: str
    weighted_score: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "security_practices": self.security_practices,
            "user_consent": self.user_consent,
            "framework_alignment": self.framework_alignment,
            "instruction_following": self.instruction_following,
            "overall_notes": self.overall_notes,
            "weighted_score": self.weighted_score,
        }


@dataclass
class EvalResult:
    """Result of evaluating a single test case."""
    test_case: TestCase
    grader_results: list[GraderResult]
    agent_output: AgentOutput | None = None
    rubric_score: RubricScore | None = None
    duration_seconds: float = 0.0
    error: str | None = None

    @property
    def passed(self) -> bool:
        """Check if all expected graders passed."""
        if self.error:
            return False
        if not self.test_case.should_trigger:
            # For negative cases, pass if no modifications were made
            return True
        expected = set(self.test_case.expected_checks)
        for result in self.grader_results:
            if result.name in expected and not result.passed:
                return False
        return True

    @property
    def score(self) -> float:
        """Calculate score as percentage of passing graders (0-1)."""
        if not self.grader_results:
            return 0.0
        passed = sum(1 for r in self.grader_results if r.passed)
        return passed / len(self.grader_results)

    def to_dict(self) -> dict[str, Any]:
        return {
            "test_case_id": self.test_case.id,
            "prompt": self.test_case.prompt,
            "passed": self.passed,
            "score": self.score,
            "grader_results": [r.to_dict() for r in self.grader_results],
            "agent_output": self.agent_output.to_dict() if self.agent_output else None,
            "rubric_score": self.rubric_score.to_dict() if self.rubric_score else None,
            "duration_seconds": self.duration_seconds,
            "error": self.error,
        }


@dataclass
class EvalReport:
    """Complete evaluation report."""
    skill: str
    dataset: str
    timestamp: str
    mode: str  # "dry-run", "baseline", "agent"
    results: list[EvalResult]
    total_duration_seconds: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def pass_rate(self) -> float:
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r.passed) / len(self.results)

    @property
    def avg_score(self) -> float:
        if not self.results:
            return 0.0
        return sum(r.score for r in self.results) / len(self.results)

    def to_dict(self) -> dict[str, Any]:
        return {
            "skill": self.skill,
            "dataset": self.dataset,
            "timestamp": self.timestamp,
            "mode": self.mode,
            "total_tests": len(self.results),
            "passed": sum(1 for r in self.results if r.passed),
            "failed": sum(1 for r in self.results if not r.passed),
            "pass_rate": self.pass_rate,
            "avg_score": self.avg_score,
            "total_duration_seconds": self.total_duration_seconds,
            "results": [r.to_dict() for r in self.results],
            "metadata": self.metadata,
        }


# =============================================================================
# Agent Execution
# =============================================================================

class AgentRunner:
    """Runs prompts through an AI coding agent."""

    def __init__(self, agent_type: str = "claude-code", timeout: int = 300):
        self.agent_type = agent_type
        self.timeout = timeout

    def run(self, prompt: str, project_dir: Path, skill: str) -> AgentOutput:
        """Execute the agent with the given prompt in the project directory."""
        if self.agent_type == "claude-code":
            return self._run_claude_code(prompt, project_dir, skill)
        else:
            raise ValueError(f"Unknown agent type: {self.agent_type}")

    def _run_claude_code(self, prompt: str, project_dir: Path, skill: str) -> AgentOutput:
        """Run Claude Code on the prompt."""
        start_time = time.time()

        # Build the full prompt with skill invocation hint
        full_prompt = f"{prompt}\n\nUse the {skill} skill to complete this task."

        # Get files before execution
        files_before = set(self._list_files(project_dir))

        try:
            # Run claude with --print flag for non-interactive mode
            result = subprocess.run(
                [
                    "claude",
                    "--print",  # Non-interactive mode
                    "--dangerously-skip-permissions",  # Skip permission prompts for eval
                    "-p", full_prompt,
                ],
                cwd=project_dir,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )

            duration = time.time() - start_time

            # Get files after execution
            files_after = set(self._list_files(project_dir))

            # Determine what changed
            files_created = list(files_after - files_before)
            files_modified = self._get_modified_files(project_dir, files_before & files_after)

            # Extract commands from output (look for bash tool usage patterns)
            commands = self._extract_commands(result.stdout)

            return AgentOutput(
                raw_output=result.stdout + result.stderr,
                exit_code=result.returncode,
                duration_seconds=duration,
                files_created=files_created,
                files_modified=files_modified,
                commands_executed=commands,
            )

        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            return AgentOutput(
                raw_output=f"Timeout after {self.timeout}s",
                exit_code=-1,
                duration_seconds=duration,
            )
        except FileNotFoundError:
            duration = time.time() - start_time
            return AgentOutput(
                raw_output="Error: 'claude' command not found. Install Claude Code CLI.",
                exit_code=-1,
                duration_seconds=duration,
            )

    def _list_files(self, directory: Path) -> list[str]:
        """List all files in directory recursively."""
        files = []
        for path in directory.rglob("*"):
            if path.is_file() and ".git" not in str(path):
                files.append(str(path.relative_to(directory)))
        return files

    def _get_modified_files(self, directory: Path, files: set[str]) -> list[str]:
        """Get list of files that were modified (simplified - just return empty for now)."""
        # In a full implementation, we'd track mtimes or use git status
        return []

    def _extract_commands(self, output: str) -> list[str]:
        """Extract executed commands from agent output."""
        commands = []
        # Look for common patterns in Claude Code output
        patterns = [
            r'Running: (.+)',
            r'\$ (.+)',
            r'Executing: (.+)',
        ]
        for pattern in patterns:
            matches = re.findall(pattern, output)
            commands.extend(matches)
        return commands


# =============================================================================
# LLM-as-Judge
# =============================================================================

class LLMJudge:
    """Uses Claude to score agent execution quality."""

    def __init__(self, rubric_path: Path | None = None):
        if not ANTHROPIC_AVAILABLE:
            raise RuntimeError("anthropic package not installed. Run: pip install anthropic")

        self.client = anthropic.Anthropic()
        self.rubric = self._load_rubric(rubric_path)

    def _load_rubric(self, rubric_path: Path | None) -> dict[str, Any]:
        """Load the scoring rubric from YAML."""
        if rubric_path is None:
            rubric_path = Path(__file__).parent / "rubrics" / "skill_quality.yaml"

        with open(rubric_path, "r") as f:
            return yaml.safe_load(f)

    def score(self, agent_output: AgentOutput, skill_content: str = "") -> RubricScore:
        """Score the agent's execution using the rubric."""
        # Build the evaluation prompt
        prompt = self._build_prompt(agent_output, skill_content)

        # Call Claude
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        # Parse the response
        return self._parse_response(response.content[0].text)

    def _build_prompt(self, agent_output: AgentOutput, skill_content: str) -> str:
        """Build the evaluation prompt."""
        rubric_text = self._format_rubric()

        return f"""You are evaluating the quality of an AI agent's execution of an Auth0 integration skill.

## Scoring Rubric
{rubric_text}

## Agent Execution Trace
```
{agent_output.raw_output[:10000]}
```

## Files Created
{json.dumps(agent_output.files_created, indent=2)}

## Files Modified
{json.dumps(agent_output.files_modified, indent=2)}

## Commands Executed
{json.dumps(agent_output.commands_executed, indent=2)}

{f"## SKILL.md Content{chr(10)}{skill_content[:5000]}" if skill_content else ""}

## Instructions
For each dimension, provide a score from 1-5 based on the criteria in the rubric.

Respond ONLY with valid JSON in this exact format:
{{
  "security_practices": {{"score": N, "reasoning": "..."}},
  "user_consent": {{"score": N, "reasoning": "..."}},
  "framework_alignment": {{"score": N, "reasoning": "..."}},
  "instruction_following": {{"score": N, "reasoning": "..."}},
  "overall_notes": "..."
}}"""

    def _format_rubric(self) -> str:
        """Format the rubric for the prompt."""
        lines = []
        for dim_name, dim_data in self.rubric.get("scoring_dimensions", {}).items():
            lines.append(f"### {dim_name.replace('_', ' ').title()} (weight: {dim_data['weight']})")
            lines.append(f"{dim_data['description']}")
            for score, score_data in sorted(dim_data.get("scores", {}).items(), reverse=True):
                criteria = ", ".join(score_data.get("criteria", []))
                lines.append(f"  - {score} ({score_data['label']}): {criteria}")
            lines.append("")
        return "\n".join(lines)

    def _parse_response(self, response_text: str) -> RubricScore:
        """Parse the LLM response into a RubricScore."""
        # Extract JSON from response
        try:
            # Try to find JSON in the response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
        except json.JSONDecodeError as e:
            # Return default scores on parse failure
            return RubricScore(
                security_practices={"score": 3, "reasoning": "Parse error"},
                user_consent={"score": 3, "reasoning": "Parse error"},
                framework_alignment={"score": 3, "reasoning": "Parse error"},
                instruction_following={"score": 3, "reasoning": "Parse error"},
                overall_notes=f"Failed to parse LLM response: {e}",
                weighted_score=3.0,
            )

        # Calculate weighted score
        weights = {
            "security_practices": 0.30,
            "user_consent": 0.25,
            "framework_alignment": 0.25,
            "instruction_following": 0.20,
        }
        weighted_score = sum(
            data.get(dim, {}).get("score", 3) * weight
            for dim, weight in weights.items()
        )

        return RubricScore(
            security_practices=data.get("security_practices", {"score": 3, "reasoning": ""}),
            user_consent=data.get("user_consent", {"score": 3, "reasoning": ""}),
            framework_alignment=data.get("framework_alignment", {"score": 3, "reasoning": ""}),
            instruction_following=data.get("instruction_following", {"score": 3, "reasoning": ""}),
            overall_notes=data.get("overall_notes", ""),
            weighted_score=weighted_score,
        )


# =============================================================================
# Debug Mode
# =============================================================================

class DebugWriter:
    """Saves intermediate outputs for debugging."""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save_test_case(self, test_case: TestCase, result: EvalResult, project_dir: Path | None = None):
        """Save all debug info for a test case."""
        case_dir = self.output_dir / f"case-{test_case.id}"
        case_dir.mkdir(parents=True, exist_ok=True)

        # Save test case info
        with open(case_dir / "test_case.json", "w") as f:
            json.dump({
                "id": test_case.id,
                "prompt": test_case.prompt,
                "scaffold": test_case.scaffold,
                "expected_checks": test_case.expected_checks,
                "should_trigger": test_case.should_trigger,
                "notes": test_case.notes,
            }, f, indent=2)

        # Save agent output if present
        if result.agent_output:
            with open(case_dir / "agent_output.txt", "w") as f:
                f.write(result.agent_output.raw_output)
            with open(case_dir / "agent_output.json", "w") as f:
                json.dump(result.agent_output.to_dict(), f, indent=2)

        # Save grader results
        with open(case_dir / "grader_results.json", "w") as f:
            json.dump([r.to_dict() for r in result.grader_results], f, indent=2)

        # Save rubric score if present
        if result.rubric_score:
            with open(case_dir / "rubric_score.json", "w") as f:
                json.dump(result.rubric_score.to_dict(), f, indent=2)

        # Copy project directory if provided
        if project_dir and project_dir.exists():
            project_copy = case_dir / "project"
            if project_copy.exists():
                shutil.rmtree(project_copy)
            shutil.copytree(project_dir, project_copy, ignore=shutil.ignore_patterns('.git', 'node_modules'))


# =============================================================================
# Core Evaluation Logic
# =============================================================================

def load_dataset(path: Path) -> list[TestCase]:
    """Load test cases from a CSV dataset file."""
    test_cases = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            test_cases.append(
                TestCase(
                    id=row["id"],
                    prompt=row["prompt"],
                    scaffold=row["scaffold"],
                    expected_checks=[
                        c.strip()
                        for c in row.get("expected_checks", "").split(",")
                        if c.strip()
                    ],
                    should_trigger=row.get("should_trigger", "true").lower() == "true",
                    notes=row.get("notes", ""),
                )
            )
    return test_cases


def copy_scaffold(scaffold_name: str, dest_dir: Path) -> Path:
    """Copy a scaffold to the destination directory."""
    scaffold_dir = Path(__file__).parent / "scaffolds" / scaffold_name
    if not scaffold_dir.exists():
        raise FileNotFoundError(f"Scaffold not found: {scaffold_name}")
    shutil.copytree(scaffold_dir, dest_dir, dirs_exist_ok=True)
    return dest_dir


def run_graders(skill: str, project_dir: Path, trace: dict | None = None) -> list[GraderResult]:
    """Run the appropriate graders for a skill."""
    if skill == "auth0-react":
        grader = Auth0ReactGrader(project_dir)
        return grader.run_all()
    elif skill == "auth0-quickstart":
        if trace is None:
            trace = {"commands": [], "files_modified": [], "files_created": [], "env_vars_set": {}, "outputs": []}
        execution_trace = ExecutionTrace.from_dict(trace)
        grader = Auth0QuickstartGrader(execution_trace)
        return grader.run_all()
    else:
        return [
            GraderResult(
                name="unknown_skill",
                passed=False,
                message=f"No graders available for skill: {skill}",
            )
        ]


def evaluate_test_case(
    skill: str,
    test_case: TestCase,
    mode: str = "dry-run",
    agent_runner: AgentRunner | None = None,
    llm_judge: LLMJudge | None = None,
    debug_writer: DebugWriter | None = None,
    verbose: bool = False,
) -> EvalResult:
    """Evaluate a single test case."""
    start_time = time.time()

    try:
        # Create temp directory for this test
        with tempfile.TemporaryDirectory(prefix=f"eval-{skill}-") as temp_dir:
            project_dir = Path(temp_dir)
            copy_scaffold(test_case.scaffold, project_dir)

            agent_output = None
            rubric_score = None

            if mode == "dry-run":
                # Just run graders on unmodified scaffold
                grader_results = run_graders(skill, project_dir)
            elif mode == "agent":
                # Run agent and capture output
                if agent_runner is None:
                    raise ValueError("Agent runner required for agent mode")

                if verbose:
                    print(f"    Running agent...")

                agent_output = agent_runner.run(test_case.prompt, project_dir, skill)

                if verbose:
                    print(f"    Agent completed in {agent_output.duration_seconds:.1f}s")

                # Run graders on modified project
                trace = {
                    "commands": agent_output.commands_executed,
                    "files_modified": agent_output.files_modified,
                    "files_created": agent_output.files_created,
                    "env_vars_set": {},
                    "outputs": [agent_output.raw_output],
                }
                grader_results = run_graders(skill, project_dir, trace)

                # Run LLM-as-judge if available
                if llm_judge and agent_output:
                    if verbose:
                        print(f"    Running LLM-as-judge...")
                    rubric_score = llm_judge.score(agent_output)
                    if verbose:
                        print(f"    Rubric score: {rubric_score.weighted_score:.2f}")

            else:  # baseline mode - future extension for direct LLM calls
                grader_results = run_graders(skill, project_dir)

            duration = time.time() - start_time
            result = EvalResult(
                test_case=test_case,
                grader_results=grader_results,
                agent_output=agent_output,
                rubric_score=rubric_score,
                duration_seconds=duration,
            )

            # Save debug info if enabled
            if debug_writer:
                debug_writer.save_test_case(test_case, result, project_dir)

            return result

    except Exception as e:
        duration = time.time() - start_time
        return EvalResult(
            test_case=test_case,
            grader_results=[],
            duration_seconds=duration,
            error=str(e),
        )


def run_evaluation(
    skill: str,
    dataset_path: Path,
    mode: str = "dry-run",
    output_dir: Path | None = None,
    debug: bool = False,
    with_rubric: bool = False,
    agent_type: str = "claude-code",
    agent_timeout: int = 300,
    verbose: bool = False,
    test_ids: list[str] | None = None,
) -> EvalReport:
    """Run a full evaluation for a skill."""
    start_time = time.time()
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    # Setup components
    agent_runner = AgentRunner(agent_type, agent_timeout) if mode == "agent" else None

    llm_judge = None
    if with_rubric and ANTHROPIC_AVAILABLE:
        try:
            llm_judge = LLMJudge()
        except Exception as e:
            if verbose:
                print(f"Warning: Could not initialize LLM judge: {e}")

    debug_writer = None
    if debug:
        debug_dir = Path(__file__).parent / "debug-runs" / f"{skill}-{timestamp}"
        debug_writer = DebugWriter(debug_dir)
        if verbose:
            print(f"Debug output will be saved to: {debug_dir}")

    # Load test cases
    test_cases = load_dataset(dataset_path)

    # Filter by test IDs if specified
    if test_ids:
        test_cases = [tc for tc in test_cases if tc.id in test_ids]

    if verbose:
        print(f"Loaded {len(test_cases)} test cases from {dataset_path}")
        print(f"Mode: {mode}")

    # Run evaluations
    results = []
    for i, test_case in enumerate(test_cases):
        if verbose:
            print(f"[{i+1}/{len(test_cases)}] Evaluating: {test_case.prompt[:50]}...")

        result = evaluate_test_case(
            skill=skill,
            test_case=test_case,
            mode=mode,
            agent_runner=agent_runner,
            llm_judge=llm_judge,
            debug_writer=debug_writer,
            verbose=verbose,
        )
        results.append(result)

        if verbose:
            status = "PASS" if result.passed else "FAIL"
            print(f"  Result: {status} (score: {result.score:.2f})")
            if result.error:
                print(f"  Error: {result.error}")

    # Create report
    total_duration = time.time() - start_time
    report = EvalReport(
        skill=skill,
        dataset=str(dataset_path),
        timestamp=timestamp,
        mode=mode,
        results=results,
        total_duration_seconds=total_duration,
        metadata={
            "agent_type": agent_type if mode == "agent" else None,
            "with_rubric": with_rubric,
            "debug": debug,
            "python_version": sys.version,
        },
    )

    # Save report
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        # Use different filenames for different modes
        if mode == "agent":
            report_file = output_dir / f"agent-scores-{skill}-{timestamp}.json"
        elif mode == "dry-run":
            report_file = output_dir / f"scores-{skill}-{timestamp}.json"
        else:
            report_file = output_dir / f"{mode}-scores-{skill}-{timestamp}.json"

        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, indent=2)
        if verbose:
            print(f"Report saved to: {report_file}")

    return report


def compare_reports(report_a_path: Path, report_b_path: Path) -> dict[str, Any]:
    """Compare two evaluation reports."""
    with open(report_a_path, "r") as f:
        report_a = json.load(f)
    with open(report_b_path, "r") as f:
        report_b = json.load(f)

    comparison = {
        "report_a": {
            "path": str(report_a_path),
            "timestamp": report_a["timestamp"],
            "mode": report_a.get("mode", "unknown"),
            "pass_rate": report_a["pass_rate"],
            "avg_score": report_a.get("avg_score", 0),
        },
        "report_b": {
            "path": str(report_b_path),
            "timestamp": report_b["timestamp"],
            "mode": report_b.get("mode", "unknown"),
            "pass_rate": report_b["pass_rate"],
            "avg_score": report_b.get("avg_score", 0),
        },
        "pass_rate_delta": report_b["pass_rate"] - report_a["pass_rate"],
        "avg_score_delta": report_b.get("avg_score", 0) - report_a.get("avg_score", 0),
        "improved": report_b["pass_rate"] > report_a["pass_rate"],
        "regressed": report_b["pass_rate"] < report_a["pass_rate"],
    }

    # Find specific test case changes
    results_a = {r["test_case_id"]: r for r in report_a.get("results", [])}
    results_b = {r["test_case_id"]: r for r in report_b.get("results", [])}

    changes = []
    for test_id in set(results_a.keys()) | set(results_b.keys()):
        a_passed = results_a.get(test_id, {}).get("passed", False)
        b_passed = results_b.get(test_id, {}).get("passed", False)
        a_score = results_a.get(test_id, {}).get("score", 0)
        b_score = results_b.get(test_id, {}).get("score", 0)

        if a_passed != b_passed or abs(a_score - b_score) > 0.1:
            changes.append({
                "test_case_id": test_id,
                "was_passing": a_passed,
                "now_passing": b_passed,
                "score_delta": b_score - a_score,
                "change": "improved" if b_passed and not a_passed else "regressed" if not b_passed and a_passed else "score_change",
            })

    comparison["changes"] = changes
    return comparison


def merge_scores(score_files: list[Path], output_path: Path):
    """Merge multiple score files into a leaderboard."""
    all_results = {}

    for score_file in score_files:
        with open(score_file, "r") as f:
            report = json.load(f)

        mode = report.get("mode", "unknown")
        skill = report.get("skill", "unknown")
        key = f"{skill}-{mode}"

        if key not in all_results:
            all_results[key] = {
                "skill": skill,
                "mode": mode,
                "pass_rate": report["pass_rate"],
                "avg_score": report.get("avg_score", 0),
                "total_tests": report["total_tests"],
                "timestamp": report["timestamp"],
            }

    # Sort by avg_score descending
    leaderboard = sorted(all_results.values(), key=lambda x: x["avg_score"], reverse=True)

    with open(output_path, "w") as f:
        json.dump({"leaderboard": leaderboard}, f, indent=2)

    return leaderboard


def print_report_summary(report: EvalReport):
    """Print a summary of the evaluation report."""
    print("\n" + "=" * 60)
    print(f"EVALUATION REPORT: {report.skill}")
    print("=" * 60)
    print(f"Mode: {report.mode}")
    print(f"Dataset: {report.dataset}")
    print(f"Timestamp: {report.timestamp}")
    print(f"Total tests: {len(report.results)}")
    print(f"Passed: {sum(1 for r in report.results if r.passed)}")
    print(f"Failed: {sum(1 for r in report.results if not r.passed)}")
    print(f"Pass rate: {report.pass_rate:.1%}")
    print(f"Avg score: {report.avg_score:.2f}")
    print(f"Total duration: {report.total_duration_seconds:.1f}s")
    print("=" * 60)

    # Show rubric scores if present
    rubric_results = [r for r in report.results if r.rubric_score]
    if rubric_results:
        avg_rubric = sum(r.rubric_score.weighted_score for r in rubric_results) / len(rubric_results)
        print(f"\nRubric Scores (LLM-as-judge):")
        print(f"  Average weighted score: {avg_rubric:.2f}/5.0")

    # Show failed tests
    failed = [r for r in report.results if not r.passed]
    if failed:
        print("\nFailed tests:")
        for result in failed:
            print(f"  - [{result.test_case.id}] {result.test_case.prompt[:40]}...")
            if result.error:
                print(f"    Error: {result.error}")
            else:
                failed_checks = [
                    g.name for g in result.grader_results
                    if g.name in result.test_case.expected_checks and not g.passed
                ]
                if failed_checks:
                    print(f"    Failed checks: {', '.join(failed_checks)}")


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Run evaluations for Auth0 agent skills"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # eval command
    eval_parser = subparsers.add_parser("eval", help="Run skill evaluation")
    eval_parser.add_argument(
        "--skill",
        required=True,
        choices=["auth0-react", "auth0-quickstart"],
        help="Skill to evaluate",
    )
    eval_parser.add_argument(
        "--dataset",
        required=True,
        type=Path,
        help="Path to dataset CSV file",
    )
    eval_parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "reports",
        help="Output directory for reports",
    )
    eval_parser.add_argument(
        "--mode",
        choices=["dry-run", "agent"],
        default="dry-run",
        help="Evaluation mode: dry-run (graders only) or agent (run Claude Code)",
    )
    eval_parser.add_argument(
        "--agent",
        dest="agent_type",
        default="claude-code",
        help="Agent to use for execution (default: claude-code)",
    )
    eval_parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout for agent execution in seconds (default: 300)",
    )
    eval_parser.add_argument(
        "--with-rubric",
        action="store_true",
        help="Enable LLM-as-judge rubric scoring (requires ANTHROPIC_API_KEY)",
    )
    eval_parser.add_argument(
        "--debug",
        action="store_true",
        help="Save intermediate outputs to debug-runs/",
    )
    eval_parser.add_argument(
        "--test-id",
        action="append",
        dest="test_ids",
        help="Run only specific test IDs (can be repeated)",
    )
    eval_parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )

    # agent command (shorthand for eval --mode agent)
    agent_parser = subparsers.add_parser("agent", help="Run agent-based evaluation")
    agent_parser.add_argument(
        "--skill",
        required=True,
        choices=["auth0-react", "auth0-quickstart"],
        help="Skill to evaluate",
    )
    agent_parser.add_argument(
        "--dataset",
        required=True,
        type=Path,
        help="Path to dataset CSV file",
    )
    agent_parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "reports",
        help="Output directory for reports",
    )
    agent_parser.add_argument(
        "--agent",
        dest="agent_type",
        default="claude-code",
        help="Agent to use (default: claude-code)",
    )
    agent_parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout for agent execution in seconds",
    )
    agent_parser.add_argument(
        "--with-rubric",
        action="store_true",
        help="Enable LLM-as-judge rubric scoring",
    )
    agent_parser.add_argument(
        "--debug",
        action="store_true",
        help="Save intermediate outputs to debug-runs/",
    )
    agent_parser.add_argument(
        "--test-id",
        action="append",
        dest="test_ids",
        help="Run only specific test IDs",
    )
    agent_parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )

    # compare command
    compare_parser = subparsers.add_parser("compare", help="Compare two reports")
    compare_parser.add_argument(
        "report_a",
        type=Path,
        help="First report (baseline)",
    )
    compare_parser.add_argument(
        "report_b",
        type=Path,
        help="Second report (comparison)",
    )

    # merge command
    merge_parser = subparsers.add_parser("merge", help="Merge score files into leaderboard")
    merge_parser.add_argument(
        "score_files",
        type=Path,
        nargs="+",
        help="Score files to merge",
    )
    merge_parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "reports" / "leaderboard.json",
        help="Output path for leaderboard",
    )

    # graders command (for testing graders directly)
    graders_parser = subparsers.add_parser("graders", help="Run graders on a project")
    graders_parser.add_argument(
        "--skill",
        required=True,
        choices=["auth0-react", "auth0-quickstart"],
        help="Skill graders to run",
    )
    graders_parser.add_argument(
        "--project",
        required=True,
        type=Path,
        help="Path to project directory",
    )

    args = parser.parse_args()

    if args.command == "eval":
        report = run_evaluation(
            skill=args.skill,
            dataset_path=args.dataset,
            mode=args.mode,
            output_dir=args.output,
            debug=args.debug,
            with_rubric=args.with_rubric,
            agent_type=args.agent_type,
            agent_timeout=args.timeout,
            verbose=args.verbose,
            test_ids=args.test_ids,
        )
        print_report_summary(report)

    elif args.command == "agent":
        report = run_evaluation(
            skill=args.skill,
            dataset_path=args.dataset,
            mode="agent",
            output_dir=args.output,
            debug=args.debug,
            with_rubric=args.with_rubric,
            agent_type=args.agent_type,
            agent_timeout=args.timeout,
            verbose=args.verbose,
            test_ids=args.test_ids,
        )
        print_report_summary(report)

    elif args.command == "compare":
        comparison = compare_reports(args.report_a, args.report_b)
        print(json.dumps(comparison, indent=2))

    elif args.command == "merge":
        leaderboard = merge_scores(args.score_files, args.output)
        print(f"Merged {len(args.score_files)} files into {args.output}")
        print("\nLeaderboard:")
        for i, entry in enumerate(leaderboard, 1):
            print(f"  {i}. {entry['skill']} ({entry['mode']}): {entry['avg_score']:.2f}")

    elif args.command == "graders":
        results = run_graders(args.skill, args.project)
        for result in results:
            status = "PASS" if result.passed else "FAIL"
            print(f"[{status}] {result.name}: {result.message}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
