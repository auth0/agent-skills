# Auth0 Agent Skills Evaluation Framework

A systematic evaluation framework for testing Auth0 agent skills effectiveness, inspired by [OpenAI's eval-skills approach](https://developers.openai.com/blog/eval-skills/).

## Overview

This framework transforms subjective skill assessment into measurable, repeatable evaluations:

```
prompt → agent execution → captured trace → graders + LLM judge → comparable score
```

## Features

- **Agent Execution**: Run prompts through Claude Code and capture outputs
- **Deterministic Graders**: Fast, explainable checks for specific outcomes
- **LLM-as-Judge**: Model-assisted rubric scoring for qualitative assessment
- **Debug Mode**: Save intermediate outputs for inspection
- **Multiple Scoring Modes**: Separate reports for dry-run vs agent execution
- **Score Comparison**: Track regressions and improvements over time

## Quick Start

```bash
# Install dependencies
cd evals
pip install -r requirements.txt

# Run a dry-run evaluation (graders only, no agent execution)
python run_eval.py eval \
  --skill auth0-react \
  --dataset datasets/auth0-react.csv \
  --dry-run \
  --verbose

# Run agent-based evaluation (requires Claude Code CLI)
python run_eval.py agent \
  --skill auth0-react \
  --dataset datasets/auth0-react.csv \
  --debug \
  --verbose

# Run with LLM-as-judge scoring (requires ANTHROPIC_API_KEY)
python run_eval.py agent \
  --skill auth0-react \
  --dataset datasets/auth0-react.csv \
  --with-rubric \
  --verbose
```

## CLI Commands

### `eval` - Run Evaluation

```bash
python run_eval.py eval --skill SKILL --dataset PATH [OPTIONS]

Options:
  --mode {dry-run,agent}   Evaluation mode (default: dry-run)
  --agent TYPE             Agent to use (default: claude-code)
  --timeout SECONDS        Agent timeout (default: 300)
  --with-rubric            Enable LLM-as-judge scoring
  --debug                  Save outputs to debug-runs/
  --test-id ID             Run specific test IDs only (repeatable)
  --output PATH            Report output directory
  -v, --verbose            Verbose output
```

### `agent` - Agent-Based Evaluation (Shorthand)

```bash
python run_eval.py agent --skill SKILL --dataset PATH [OPTIONS]

# Equivalent to: eval --mode agent
```

### `graders` - Run Graders Directly

```bash
python run_eval.py graders --skill SKILL --project PATH

# Test graders on an existing project
python run_eval.py graders \
  --skill auth0-react \
  --project /path/to/react-app
```

### `compare` - Compare Reports

```bash
python run_eval.py compare BASELINE.json LATEST.json

# Shows pass rate delta, score changes, and regressions
```

### `merge` - Create Leaderboard

```bash
python run_eval.py merge reports/*.json --output leaderboard.json

# Combines multiple score files into a ranked leaderboard
```

## Directory Structure

```
evals/
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── run_eval.py              # Main evaluation runner
│
├── scaffolds/               # Project templates for testing
│   └── react-vite/         # React + Vite scaffold
│
├── datasets/                # Test prompt datasets
│   ├── auth0-react.csv     # Test cases for auth0-react
│   └── auth0-quickstart.csv # Test cases for auth0-quickstart
│
├── graders/                 # Deterministic check scripts
│   ├── __init__.py
│   ├── common.py           # Shared utilities
│   ├── auth0_react.py      # React skill graders
│   └── auth0_quickstart.py # Quickstart skill graders
│
├── rubrics/                 # Model-assisted scoring schemas
│   └── skill_quality.yaml  # Quality rubric definition
│
├── debug-runs/             # Debug outputs (gitignored)
└── reports/                # Evaluation results (gitignored)
```

## Evaluation Modes

### Dry-Run Mode

Runs graders on unmodified scaffolds. Useful for testing grader logic:

```bash
python run_eval.py eval --skill auth0-react --dataset datasets/auth0-react.csv --mode dry-run
```

Output: `reports/scores-auth0-react-TIMESTAMP.json`

### Agent Mode

Executes Claude Code with each prompt and grades the results:

```bash
python run_eval.py agent --skill auth0-react --dataset datasets/auth0-react.csv
```

Output: `reports/agent-scores-auth0-react-TIMESTAMP.json`

## Deterministic Graders

### auth0-react Graders

| Grader | Description |
|--------|-------------|
| `sdk_installed` | @auth0/auth0-react in package.json |
| `provider_wrapped` | Auth0Provider wraps the app |
| `env_vars_correct` | VITE_ or REACT_APP_ prefix used |
| `no_hardcoded_credentials` | No secrets in source files |
| `redirect_uri_configured` | Uses window.location.origin |
| `login_component` | loginWithRedirect present |
| `logout_component` | logout() present |
| `useauth0_hook_usage` | Proper hook destructuring |

### auth0-quickstart Graders

| Grader | Description |
|--------|-------------|
| `framework_detected` | Framework detection performed |
| `cli_installed` | Auth0 CLI available |
| `cli_logged_in` | Auth0 CLI authenticated |
| `app_created` | Application created via CLI |
| `metadata_present` | --metadata flag used |
| `app_type_correct` | Correct app type for framework |
| `callbacks_configured` | Callback URLs set |
| `credentials_captured` | Client ID/Domain captured |

## LLM-as-Judge Scoring

When `--with-rubric` is enabled, each agent execution is scored by Claude on four dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Security Practices | 30% | Credential handling, warnings followed |
| User Consent | 25% | Explicit confirmation before changes |
| Framework Alignment | 25% | Correct patterns for detected framework |
| Instruction Following | 20% | Adherence to SKILL.md workflow |

Requires `ANTHROPIC_API_KEY` environment variable.

## Debug Mode

Save all intermediate outputs for inspection:

```bash
python run_eval.py agent --skill auth0-react --dataset datasets/auth0-react.csv --debug
```

Creates `debug-runs/auth0-react-TIMESTAMP/` with:
- `case-N/test_case.json` - Test case details
- `case-N/agent_output.txt` - Raw agent output
- `case-N/agent_output.json` - Structured output data
- `case-N/grader_results.json` - Grader verdicts
- `case-N/rubric_score.json` - LLM judge scores
- `case-N/project/` - Modified project files

## Test Datasets

CSV format with columns:

| Column | Description |
|--------|-------------|
| `id` | Unique test case identifier |
| `prompt` | The user prompt to evaluate |
| `scaffold` | Project scaffold to use |
| `expected_checks` | Grader names that should pass |
| `notes` | Additional context |

Example:
```csv
id,prompt,scaffold,expected_checks,notes
1,"Add Auth0 login to my React app",react-vite,"sdk_installed,provider_wrapped",basic case
2,"Add login and logout buttons with Auth0",react-vite,"sdk_installed,login_component,logout_component",UI focus
```

## Report Format

```json
{
  "skill": "auth0-react",
  "mode": "agent",
  "timestamp": "20240115-103000",
  "total_tests": 5,
  "passed": 5,
  "failed": 0,
  "pass_rate": 1.0,
  "avg_score": 0.95,
  "results": [
    {
      "test_case_id": "1",
      "prompt": "Add Auth0 login to my React app",
      "passed": true,
      "score": 1.0,
      "grader_results": [...],
      "agent_output": {...},
      "rubric_score": {...}
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For --with-rubric | Claude API key for LLM-as-judge |

## Best Practices

1. **Establish a baseline** - Run dry-run evals before making skill changes
2. **Test incrementally** - Run agent evals after each significant change
3. **Use debug mode** - Inspect outputs when tests fail unexpectedly
4. **Track regressions** - Compare reports to catch quality drops
5. **Add failing cases** - When bugs are found, add test cases first

## Adding New Skills

1. Create graders in `graders/your_skill.py`
2. Register in `graders/__init__.py`
3. Add to choices in `run_eval.py` CLI
4. Create dataset in `datasets/your-skill.csv`
5. Add scaffold if needed in `scaffolds/`

## Troubleshooting

**Agent mode fails with "claude not found":**
- Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`

**LLM-as-judge not working:**
- Ensure `ANTHROPIC_API_KEY` is set
- Check `anthropic` package is installed

**Graders fail on valid project:**
- Check file paths match expected structure
- Verify imports/patterns match grader regex
- Use `--debug` to inspect the project state

**Timeout errors:**
- Increase `--timeout` value (default: 300s)
- Check network connectivity
