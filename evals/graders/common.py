"""
Common utilities for graders.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class GraderResult:
    """Result of a single grader check."""

    name: str
    passed: bool
    message: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
        }


def read_json_file(path: Path) -> dict[str, Any] | None:
    """Read and parse a JSON file, returning None if not found or invalid."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def read_file(path: Path) -> str | None:
    """Read a file as text, returning None if not found."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def check_file_contains(path: Path, pattern: str, regex: bool = False) -> bool:
    """Check if a file contains a string or regex pattern."""
    content = read_file(path)
    if content is None:
        return False

    if regex:
        return bool(re.search(pattern, content))
    return pattern in content


def find_files(directory: Path, pattern: str) -> list[Path]:
    """Find all files matching a glob pattern in a directory."""
    return list(directory.glob(pattern))


def check_package_dependency(
    project_dir: Path, package_name: str, dev: bool = False
) -> bool:
    """Check if a package is listed in package.json dependencies."""
    package_json = read_json_file(project_dir / "package.json")
    if package_json is None:
        return False

    deps_key = "devDependencies" if dev else "dependencies"
    deps = package_json.get(deps_key, {})
    return package_name in deps


def extract_env_vars_from_file(path: Path) -> list[str]:
    """Extract environment variable references from a source file."""
    content = read_file(path)
    if content is None:
        return []

    # Match import.meta.env.VITE_* or process.env.REACT_APP_*
    vite_pattern = r"import\.meta\.env\.(\w+)"
    cra_pattern = r"process\.env\.(\w+)"

    vite_vars = re.findall(vite_pattern, content)
    cra_vars = re.findall(cra_pattern, content)

    return vite_vars + cra_vars


def check_no_secrets_in_source(project_dir: Path) -> tuple[bool, list[str]]:
    """
    Check that no hardcoded secrets exist in source files.
    Returns (passed, list of files with potential secrets).
    """
    source_files = find_files(project_dir / "src", "**/*.tsx") + find_files(
        project_dir / "src", "**/*.ts"
    )

    # Patterns that might indicate hardcoded secrets
    secret_patterns = [
        r'client_?secret\s*[=:]\s*["\'][^"\']+["\']',
        r'clientSecret\s*[=:]\s*["\'][^"\']+["\']',
        r'AUTH0_SECRET\s*[=:]\s*["\'][^"\']+["\']',
        # Match things that look like Auth0 domains/client IDs hardcoded
        r'domain\s*[=:]\s*["\'][a-z0-9-]+\.auth0\.com["\']',
        r'clientId\s*[=:]\s*["\'][a-zA-Z0-9]{32}["\']',
    ]

    files_with_secrets: list[str] = []
    for file_path in source_files:
        content = read_file(file_path)
        if content is None:
            continue

        for pattern in secret_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                files_with_secrets.append(str(file_path))
                break

    return len(files_with_secrets) == 0, files_with_secrets
