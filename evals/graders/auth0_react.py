"""
Graders for the auth0-react skill.

These check that the skill correctly integrates @auth0/auth0-react SDK.
"""

import re
from pathlib import Path

from .common import (
    GraderResult,
    check_file_contains,
    check_no_secrets_in_source,
    check_package_dependency,
    extract_env_vars_from_file,
    find_files,
    read_file,
)


class Auth0ReactGrader:
    """Grader for auth0-react skill evaluations."""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir

    def run_all(self) -> list[GraderResult]:
        """Run all grader checks and return results."""
        return [
            self.check_sdk_installed(),
            self.check_provider_wrapped(),
            self.check_env_vars_correct(),
            self.check_no_hardcoded_credentials(),
            self.check_redirect_uri_configured(),
            self.check_login_component(),
            self.check_logout_component(),
            self.check_useauth0_hook_usage(),
        ]

    def check_sdk_installed(self) -> GraderResult:
        """Verify @auth0/auth0-react is in package.json dependencies."""
        passed = check_package_dependency(self.project_dir, "@auth0/auth0-react")
        return GraderResult(
            name="sdk_installed",
            passed=passed,
            message="@auth0/auth0-react found in dependencies"
            if passed
            else "@auth0/auth0-react not found in package.json dependencies",
        )

    def check_provider_wrapped(self) -> GraderResult:
        """Verify Auth0Provider wraps the app in main.tsx or index.tsx."""
        entry_files = ["src/main.tsx", "src/index.tsx", "src/main.jsx", "src/index.jsx"]

        for entry_file in entry_files:
            path = self.project_dir / entry_file
            if check_file_contains(path, "Auth0Provider"):
                # Also check for proper import
                has_import = check_file_contains(
                    path, "from '@auth0/auth0-react'"
                ) or check_file_contains(path, 'from "@auth0/auth0-react"')

                if has_import:
                    return GraderResult(
                        name="provider_wrapped",
                        passed=True,
                        message=f"Auth0Provider found wrapping app in {entry_file}",
                        details={"file": entry_file},
                    )

        return GraderResult(
            name="provider_wrapped",
            passed=False,
            message="Auth0Provider not found wrapping the application",
        )

    def check_env_vars_correct(self) -> GraderResult:
        """Verify environment variables use correct prefix (VITE_ or REACT_APP_)."""
        entry_files = find_files(self.project_dir / "src", "**/*.tsx") + find_files(
            self.project_dir / "src", "**/*.ts"
        )

        uses_vite = (self.project_dir / "vite.config.ts").exists() or (
            self.project_dir / "vite.config.js"
        ).exists()

        expected_prefix = "VITE_" if uses_vite else "REACT_APP_"
        wrong_prefix = "REACT_APP_" if uses_vite else "VITE_"

        for file_path in entry_files:
            env_vars = extract_env_vars_from_file(file_path)
            for var in env_vars:
                if var.startswith(wrong_prefix):
                    return GraderResult(
                        name="env_vars_correct",
                        passed=False,
                        message=f"Wrong env var prefix: {var} (should use {expected_prefix})",
                        details={
                            "file": str(file_path),
                            "variable": var,
                            "expected_prefix": expected_prefix,
                        },
                    )

        # Check that Auth0-related env vars exist with correct prefix
        auth0_vars_found = False
        for file_path in entry_files:
            content = read_file(file_path)
            if content and (
                f"{expected_prefix}AUTH0" in content
                or f"import.meta.env.{expected_prefix}" in content
            ):
                auth0_vars_found = True
                break

        if not auth0_vars_found:
            # Check if env vars are being used at all
            for file_path in entry_files:
                content = read_file(file_path)
                if content and (
                    "AUTH0_DOMAIN" in content or "AUTH0_CLIENT_ID" in content
                ):
                    return GraderResult(
                        name="env_vars_correct",
                        passed=False,
                        message=f"Auth0 env vars found but without {expected_prefix} prefix",
                    )

        return GraderResult(
            name="env_vars_correct",
            passed=True,
            message=f"Environment variables correctly use {expected_prefix} prefix",
        )

    def check_no_hardcoded_credentials(self) -> GraderResult:
        """Ensure no client secrets or credentials are hardcoded in source files."""
        passed, files_with_secrets = check_no_secrets_in_source(self.project_dir)
        return GraderResult(
            name="no_hardcoded_credentials",
            passed=passed,
            message="No hardcoded credentials found"
            if passed
            else f"Potential hardcoded credentials in: {', '.join(files_with_secrets)}",
            details={"files_with_secrets": files_with_secrets},
        )

    def check_redirect_uri_configured(self) -> GraderResult:
        """Verify redirect_uri is configured properly (uses window.location.origin)."""
        entry_files = ["src/main.tsx", "src/index.tsx", "src/main.jsx", "src/index.jsx"]

        for entry_file in entry_files:
            path = self.project_dir / entry_file
            content = read_file(path)
            if content is None:
                continue

            # Check for proper redirect_uri configuration
            if "redirect_uri" in content:
                # Good patterns
                if "window.location.origin" in content:
                    return GraderResult(
                        name="redirect_uri_configured",
                        passed=True,
                        message="redirect_uri correctly uses window.location.origin",
                        details={"file": entry_file},
                    )
                # Bad patterns - hardcoded URLs
                if re.search(r'redirect_uri\s*:\s*["\']http', content):
                    return GraderResult(
                        name="redirect_uri_configured",
                        passed=False,
                        message="redirect_uri has hardcoded URL instead of window.location.origin",
                        details={"file": entry_file},
                    )

        return GraderResult(
            name="redirect_uri_configured",
            passed=False,
            message="redirect_uri configuration not found",
        )

    def check_login_component(self) -> GraderResult:
        """Check if a login button/component exists."""
        source_files = find_files(self.project_dir / "src", "**/*.tsx") + find_files(
            self.project_dir / "src", "**/*.jsx"
        )

        for file_path in source_files:
            if check_file_contains(file_path, "loginWithRedirect"):
                return GraderResult(
                    name="login_component",
                    passed=True,
                    message="Login functionality found using loginWithRedirect",
                    details={"file": str(file_path)},
                )

        return GraderResult(
            name="login_component",
            passed=False,
            message="No login component using loginWithRedirect found",
        )

    def check_logout_component(self) -> GraderResult:
        """Check if a logout button/component exists."""
        source_files = find_files(self.project_dir / "src", "**/*.tsx") + find_files(
            self.project_dir / "src", "**/*.jsx"
        )

        for file_path in source_files:
            content = read_file(file_path)
            if content and "logout(" in content:
                # Verify it's from useAuth0
                if "useAuth0" in content:
                    return GraderResult(
                        name="logout_component",
                        passed=True,
                        message="Logout functionality found",
                        details={"file": str(file_path)},
                    )

        return GraderResult(
            name="logout_component",
            passed=False,
            message="No logout component found",
        )

    def check_useauth0_hook_usage(self) -> GraderResult:
        """Check if useAuth0 hook is being used correctly."""
        source_files = find_files(self.project_dir / "src", "**/*.tsx") + find_files(
            self.project_dir / "src", "**/*.jsx"
        )

        for file_path in source_files:
            content = read_file(file_path)
            if content is None:
                continue

            if "useAuth0" in content:
                # Check for proper destructuring
                if re.search(
                    r"const\s*\{[^}]*\}\s*=\s*useAuth0\s*\(\s*\)", content
                ):
                    return GraderResult(
                        name="useauth0_hook_usage",
                        passed=True,
                        message="useAuth0 hook correctly used with destructuring",
                        details={"file": str(file_path)},
                    )

        return GraderResult(
            name="useauth0_hook_usage",
            passed=False,
            message="useAuth0 hook not found or not properly used",
        )
