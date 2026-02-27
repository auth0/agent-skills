"""
Graders for the auth0-quickstart skill.

These check that the skill correctly detects frameworks,
installs CLI, and creates Auth0 applications.
"""

import re
from dataclasses import dataclass
from typing import Any

from .common import GraderResult


@dataclass
class ExecutionTrace:
    """Represents the execution trace from a skill run."""

    commands: list[dict[str, Any]]
    files_modified: list[str]
    files_created: list[str]
    env_vars_set: dict[str, str]
    outputs: list[str]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ExecutionTrace":
        return cls(
            commands=data.get("commands", []),
            files_modified=data.get("files_modified", []),
            files_created=data.get("files_created", []),
            env_vars_set=data.get("env_vars_set", {}),
            outputs=data.get("outputs", []),
        )


class Auth0QuickstartGrader:
    """Grader for auth0-quickstart skill evaluations."""

    def __init__(self, trace: ExecutionTrace):
        self.trace = trace

    def run_all(self) -> list[GraderResult]:
        """Run all grader checks and return results."""
        return [
            self.check_framework_detected(),
            self.check_cli_installed(),
            self.check_cli_logged_in(),
            self.check_app_created(),
            self.check_metadata_present(),
            self.check_app_type_correct(),
            self.check_callbacks_configured(),
            self.check_credentials_captured(),
        ]

    def check_framework_detected(self) -> GraderResult:
        """Verify that the skill detected the project framework."""
        # Look for framework detection commands
        detection_patterns = [
            r"cat\s+package\.json",
            r"grep.*react|next|vue|angular|express",
            r"ls.*angular\.json|vue\.config|next\.config",
        ]

        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            for pattern in detection_patterns:
                if re.search(pattern, cmd_str, re.IGNORECASE):
                    return GraderResult(
                        name="framework_detected",
                        passed=True,
                        message="Framework detection step performed",
                        details={"command": cmd_str},
                    )

        # Also check outputs for framework mentions
        framework_mentions = ["react", "next", "vue", "angular", "express"]
        for output in self.trace.outputs:
            for fw in framework_mentions:
                if fw.lower() in output.lower() and "detected" in output.lower():
                    return GraderResult(
                        name="framework_detected",
                        passed=True,
                        message=f"Framework {fw} detected in output",
                    )

        return GraderResult(
            name="framework_detected",
            passed=False,
            message="No framework detection step found in trace",
        )

    def check_cli_installed(self) -> GraderResult:
        """Verify Auth0 CLI installation was attempted or verified."""
        install_patterns = [
            r"brew\s+install.*auth0",
            r"scoop\s+install\s+auth0",
            r"choco\s+install\s+auth0",
            r"auth0\s+--version",
            r"which\s+auth0",
            r"command\s+-v\s+auth0",
        ]

        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            for pattern in install_patterns:
                if re.search(pattern, cmd_str, re.IGNORECASE):
                    return GraderResult(
                        name="cli_installed",
                        passed=True,
                        message="Auth0 CLI installation/verification found",
                        details={"command": cmd_str},
                    )

        return GraderResult(
            name="cli_installed",
            passed=False,
            message="No Auth0 CLI installation or verification found",
        )

    def check_cli_logged_in(self) -> GraderResult:
        """Verify auth0 login command was executed."""
        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if re.search(r"auth0\s+login", cmd_str):
                return GraderResult(
                    name="cli_logged_in",
                    passed=True,
                    message="auth0 login command executed",
                    details={"command": cmd_str},
                )

        return GraderResult(
            name="cli_logged_in",
            passed=False,
            message="auth0 login command not found in trace",
        )

    def check_app_created(self) -> GraderResult:
        """Verify auth0 apps create command was executed."""
        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if re.search(r"auth0\s+apps\s+create", cmd_str):
                return GraderResult(
                    name="app_created",
                    passed=True,
                    message="auth0 apps create command executed",
                    details={"command": cmd_str},
                )

        return GraderResult(
            name="app_created",
            passed=False,
            message="auth0 apps create command not found in trace",
        )

    def check_metadata_present(self) -> GraderResult:
        """Verify --metadata 'created_by=agent_skills' is in the create command."""
        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if "auth0 apps create" in cmd_str:
                if re.search(
                    r'--metadata\s+["\']?created_by=agent_skills["\']?', cmd_str
                ):
                    return GraderResult(
                        name="metadata_present",
                        passed=True,
                        message="Instrumentation metadata present in create command",
                        details={"command": cmd_str},
                    )
                else:
                    return GraderResult(
                        name="metadata_present",
                        passed=False,
                        message="auth0 apps create found but missing --metadata 'created_by=agent_skills'",
                        details={"command": cmd_str},
                    )

        return GraderResult(
            name="metadata_present",
            passed=False,
            message="auth0 apps create command not found",
        )

    def check_app_type_correct(self, expected_type: str = "spa") -> GraderResult:
        """Verify --type matches the expected application type."""
        type_map = {
            "spa": ["spa", "single page application"],
            "regular": ["regular", "regular web application"],
            "native": ["native"],
        }

        expected_values = type_map.get(expected_type, [expected_type])

        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if "auth0 apps create" in cmd_str:
                type_match = re.search(r"--type\s+(\w+)", cmd_str)
                if type_match:
                    actual_type = type_match.group(1).lower()
                    if actual_type in expected_values:
                        return GraderResult(
                            name="app_type_correct",
                            passed=True,
                            message=f"Correct application type: {actual_type}",
                            details={"expected": expected_type, "actual": actual_type},
                        )
                    else:
                        return GraderResult(
                            name="app_type_correct",
                            passed=False,
                            message=f"Wrong application type: {actual_type} (expected {expected_type})",
                            details={"expected": expected_type, "actual": actual_type},
                        )

        return GraderResult(
            name="app_type_correct",
            passed=False,
            message="Application type not specified in create command",
        )

    def check_callbacks_configured(self) -> GraderResult:
        """Verify callback URLs were configured in the create command."""
        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if "auth0 apps create" in cmd_str:
                has_callbacks = "--callbacks" in cmd_str
                has_logout = "--logout-urls" in cmd_str

                if has_callbacks and has_logout:
                    return GraderResult(
                        name="callbacks_configured",
                        passed=True,
                        message="Callback and logout URLs configured",
                        details={"command": cmd_str},
                    )
                elif has_callbacks:
                    return GraderResult(
                        name="callbacks_configured",
                        passed=False,
                        message="Callback URLs configured but logout URLs missing",
                    )
                else:
                    return GraderResult(
                        name="callbacks_configured",
                        passed=False,
                        message="Callback URLs not configured",
                    )

        return GraderResult(
            name="callbacks_configured",
            passed=False,
            message="auth0 apps create command not found",
        )

    def check_credentials_captured(self) -> GraderResult:
        """Verify credentials (domain, client_id) were captured from the created app."""
        # Look for auth0 apps show or list commands
        show_commands = []
        for cmd in self.trace.commands:
            cmd_str = cmd.get("command", "")
            if re.search(r"auth0\s+apps\s+(show|list)", cmd_str):
                show_commands.append(cmd_str)

        if show_commands:
            return GraderResult(
                name="credentials_captured",
                passed=True,
                message="Credentials retrieval commands found",
                details={"commands": show_commands},
            )

        # Also check if domain/client_id appear in env vars
        auth0_env_vars = [
            k
            for k in self.trace.env_vars_set.keys()
            if "AUTH0" in k.upper() or "DOMAIN" in k.upper() or "CLIENT" in k.upper()
        ]

        if auth0_env_vars:
            return GraderResult(
                name="credentials_captured",
                passed=True,
                message="Auth0 credentials set as environment variables",
                details={"env_vars": auth0_env_vars},
            )

        return GraderResult(
            name="credentials_captured",
            passed=False,
            message="No credentials retrieval or storage found",
        )
