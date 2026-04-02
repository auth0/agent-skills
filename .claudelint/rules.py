"""
Custom claudelint rules for agent-skills repository, enforcing Agent Skills specification and marketplace conventions.
"""

import re
import yaml
from pathlib import Path
from typing import List, Optional, Dict, Any

try:
    # Try importing from claudelint package (when installed via pip/uvx)
    from claudelint.src.rule import Rule, RuleViolation, Severity
    from claudelint.src.context import RepositoryContext
except ImportError:
    try:
        # Fallback for development environment
        from src.rule import Rule, RuleViolation, Severity
        from src.context import RepositoryContext
    except ImportError:
        # Final fallback
        from claudelint import Rule, RuleViolation, Severity, RepositoryContext


class SkillDirectoryStructureRule(Rule):
    """
    Enforce Agent Skills specification directory structure.

    Only SKILL.md should exist in the skill root directory.
    All other content must be organized in optional directories:
    - scripts/     - Executable code
    - references/  - Additional documentation
    - assets/      - Static resources (templates, images, data files)
    - tests/       - Validation artifacts (TDD transcripts, test data)
    """

    # Allowed directories per Agent Skills spec (plus tests/ for validation artifacts)
    ALLOWED_DIRS = {'scripts', 'references', 'assets', 'tests'}

    # Files that are allowed in skill root
    ALLOWED_ROOT_FILES = {'SKILL.md', '.gitignore', '.gitkeep'}

    @property
    def rule_id(self) -> str:
        return "skill-directory-structure"

    @property
    def description(self) -> str:
        return "Skills must follow Agent Skills specification: only SKILL.md in root, other content in scripts/, references/, assets/, or tests/"

    def default_severity(self) -> Severity:
        return Severity.ERROR

    def check(self, context: RepositoryContext) -> List[RuleViolation]:
        violations = []

        # Find all skill directories across all plugins
        for plugin_path in context.plugins:
            skills_dir = plugin_path / "skills"
            if not skills_dir.exists():
                continue

            # Check each skill directory
            for skill_dir in skills_dir.iterdir():
                if not skill_dir.is_dir():
                    continue

                # Skip hidden directories
                if skill_dir.name.startswith('.'):
                    continue

                violations.extend(self._check_skill_directory(skill_dir))

        return violations

    def _check_skill_directory(self, skill_dir: Path) -> List[RuleViolation]:
        """Check a single skill directory for structure violations."""
        violations = []

        # Check if SKILL.md exists (should be enforced by another rule, but good to check)
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            # Skip checking structure if no SKILL.md (another rule should catch this)
            return violations

        # Check all items in skill root
        for item in skill_dir.iterdir():
            item_name = item.name

            # Allow hidden files/dirs (e.g., .gitignore, .git)
            if item_name.startswith('.'):
                continue

            if item.is_dir():
                # Check if directory is allowed
                if item_name not in self.ALLOWED_DIRS:
                    violations.append(
                        self.violation(
                            f"Unexpected directory '{item_name}/' in skill root. "
                            f"Only 'scripts/', 'references/', 'assets/', and 'tests/' "
                            f"directories are allowed. Move content to an appropriate directory.",
                            file_path=item
                        )
                    )
            else:
                # Check if file is allowed in root
                if item_name not in self.ALLOWED_ROOT_FILES:
                    # Determine appropriate directory based on file extension/type
                    suggestion = self._suggest_directory(item)

                    violations.append(
                        self.violation(
                            f"File '{item_name}' should not be in skill root. "
                            f"Per Agent Skills spec, only SKILL.md should be in root. "
                            f"{suggestion}",
                            file_path=item
                        )
                    )

        return violations

    def _suggest_directory(self, file_path: Path) -> str:
        """Suggest appropriate directory based on file type."""
        suffix = file_path.suffix.lower()
        name = file_path.name.lower()

        # Config files belong in scripts/
        config_files = {'package.json', 'package-lock.json', 'tsconfig.json', 'jest.config.json',
                       'jest.config.js', 'babel.config.js', '.eslintrc.json', '.prettierrc.json'}
        if name in config_files:
            return "Move to 'scripts/' directory."

        # Scripts
        if suffix in {'.py', '.sh', '.js', '.ts', '.bash', '.zsh'} or not suffix:
            try:
                if file_path.stat().st_mode & 0o111:  # Check if executable
                    return "Move to 'scripts/' directory."
            except (OSError, PermissionError):
                # If we can't check permissions, suggest scripts/ for script extensions
                if suffix in {'.py', '.sh', '.js', '.ts', '.bash', '.zsh'}:
                    return "Move to 'scripts/' directory."

        # Documentation
        if suffix in {'.md', '.txt', '.rst', '.adoc'}:
            if name != 'skill.md':
                return "Move to 'references/' directory."

        # Assets (images, templates, data) - excluding config files handled above
        if suffix in {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.xml', '.csv', '.template', '.tmpl'}:
            return "Move to 'assets/' directory."

        # Generic JSON/YAML files (not config) go to assets
        if suffix in {'.json', '.yaml', '.yml'} and name not in config_files:
            return "Move to 'assets/' directory."

        # Default suggestion
        return "Move to 'scripts/', 'references/', or 'assets/' as appropriate."


class SkillReadmeDocumentationRule(Rule):
    """
    Enforce that all skills are documented in plugin README.md.

    Each skill in the skills/ directory must have a corresponding entry
    in the plugin's README.md file to ensure discoverability.
    """

    @property
    def rule_id(self) -> str:
        return "skill-readme-documentation"

    @property
    def description(self) -> str:
        return "All skills must be documented in plugin README.md"

    def default_severity(self) -> Severity:
        return Severity.ERROR

    def check(self, context: RepositoryContext) -> List[RuleViolation]:
        violations = []

        # Check each plugin
        for plugin_path in context.plugins:
            skills_dir = plugin_path / "skills"
            readme_path = plugin_path / "README.md"

            # Skip if no skills directory
            if not skills_dir.exists():
                continue

            # Get all skill directories that have SKILL.md
            skill_names = {
                skill_dir.name
                for skill_dir in skills_dir.iterdir()
                if skill_dir.is_dir()
                and not skill_dir.name.startswith(".")
                and (skill_dir / "SKILL.md").exists()
            }

            # Skip if no skills found
            if not skill_names:
                continue

            # Check if README exists
            if not readme_path.exists():
                violations.append(
                    self.violation(
                        f"Plugin has {len(skill_names)} skill(s) but no README.md to document them",
                        file_path=plugin_path
                    )
                )
                continue

            # Read README content
            try:
                readme_content = readme_path.read_text()
            except OSError as e:
                violations.append(
                    self.violation(
                        f"Could not read README.md: {e}",
                        file_path=readme_path
                    )
                )
                continue

            # Find undocumented skills
            # Look for skill references in README (skill name as link target or table entry)
            undocumented = []
            for skill_name in sorted(skill_names):
                # Check multiple patterns:
                # - **[skill-name](./skills/skill-name/)**
                # - [skill-name](./skills/skill-name/)
                # - ./skills/skill-name/
                # - (./skills/skill-name/SKILL.md)
                patterns_to_check = [
                    f"./skills/{skill_name}/",
                    f"**[{skill_name}](",
                    f"[{skill_name}](",
                    f"/{skill_name}/",
                ]

                found = any(pattern in readme_content for pattern in patterns_to_check)

                if not found:
                    undocumented.append(skill_name)

            # Report violations for undocumented skills
            for skill_name in undocumented:
                violations.append(
                    self.violation(
                        f"Skill '{skill_name}' exists but is not documented in README.md. "
                        f"Add an entry to the skills table linking to ./skills/{skill_name}/",
                        file_path=skills_dir / skill_name
                    )
                )

        return violations


class SkillMarkdownNamingRule(Rule):
    """
    Enforce markdown file naming conventions in skills/ directories.

    - Only SKILL.md is allowed as a .md file in the root of a skill folder
    - All other .md files (in subdirectories) must be kebab-case
    - SKILL.md and README.md are exempt from the kebab-case requirement
    """

    # Pattern for valid kebab-case filenames (without extension)
    KEBAB_CASE_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')

    # Markdown files exempt from kebab-case requirement
    EXEMPT_NAMES = {'SKILL.md', 'README.md'}

    @property
    def rule_id(self) -> str:
        return "skill-markdown-naming"

    @property
    def description(self) -> str:
        return "Markdown files in skills/ must be kebab-case (except SKILL.md and README.md), and only SKILL.md is allowed at the skill root"

    def default_severity(self) -> Severity:
        return Severity.ERROR

    def check(self, context: RepositoryContext) -> List[RuleViolation]:
        violations = []

        for plugin_path in context.plugins:
            skills_dir = plugin_path / "skills"
            if not skills_dir.exists():
                continue

            for skill_dir in skills_dir.iterdir():
                if not skill_dir.is_dir() or skill_dir.name.startswith('.'):
                    continue

                violations.extend(self._check_skill_markdown(skill_dir))

        return violations

    # Directories to skip during traversal (tooling artifacts, not skill content)
    SKIP_DIRS = {'node_modules', '__pycache__', '.git', '.pytest_cache'}

    def _check_skill_markdown(self, skill_dir: Path) -> List[RuleViolation]:
        """Check markdown naming conventions within a single skill directory."""
        violations = []

        for md_file in self._iter_markdown(skill_dir):
            name = md_file.name

            # Check root-level constraint: only SKILL.md allowed at skill root
            if md_file.parent == skill_dir and name != 'SKILL.md':
                violations.append(
                    self.violation(
                        f"Only SKILL.md is allowed in the skill root directory. "
                        f"Move '{name}' to an appropriate subdirectory such as 'references/' or 'tests/'.",
                        file_path=md_file
                    )
                )
                continue

            # Skip exempt names
            if name in self.EXEMPT_NAMES:
                continue

            # Check kebab-case naming
            stem = md_file.stem
            if not self.KEBAB_CASE_RE.match(stem):
                violations.append(
                    self.violation(
                        f"Markdown file '{name}' is not kebab-case. "
                        f"Rename to use lowercase letters, numbers, and hyphens "
                        f"(e.g., '{self._suggest_kebab(stem)}.md').",
                        file_path=md_file
                    )
                )

        return violations

    def _iter_markdown(self, skill_dir: Path):
        """Yield .md files under skill_dir, skipping tooling directories."""
        for item in skill_dir.iterdir():
            if item.is_dir():
                if item.name in self.SKIP_DIRS or item.name.startswith('.'):
                    continue
                yield from self._iter_markdown(item)
            elif item.suffix == '.md':
                yield item

    @staticmethod
    def _suggest_kebab(stem: str) -> str:
        """Suggest a kebab-case version of a filename stem."""
        # Normalize non-alphanumeric characters to hyphens
        result = re.sub(r'[^A-Za-z0-9]+', '-', stem)
        # Insert hyphens before uppercase letters (camelCase/PascalCase)
        result = re.sub(r'(?<=[a-z0-9])([A-Z])', r'-\1', result)
        # Lowercase everything
        result = result.lower()
        # Collapse multiple hyphens
        result = re.sub(r'-+', '-', result)
        # Strip leading/trailing hyphens
        result = result.strip('-')
        return result


class SkillRequiredMetadataRule(Rule):
    """
    Enforce that SKILL.md frontmatter includes license and metadata.author.

    Per marketplace convention, all skills must declare:
    - license (e.g., "Proprietary")
    - metadata.author (e.g., "Name <email>")
    """

    @property
    def rule_id(self) -> str:
        return "skill-required-metadata"

    @property
    def description(self) -> str:
        return "SKILL.md must include 'license' and 'metadata.author' in frontmatter"

    # Matches "Name <email>" pattern (one author entry)
    AUTHOR_RE = re.compile(r'^[^<>]+<[^@\s]+@[^@\s]+\.[^@\s]+>$')

    def default_severity(self) -> Severity:
        return Severity.ERROR

    def check(self, context: RepositoryContext) -> List[RuleViolation]:
        violations = []

        for plugin_path in context.plugins:
            skills_dir = plugin_path / "skills"
            if not skills_dir.exists():
                continue

            for skill_dir in skills_dir.iterdir():
                if not skill_dir.is_dir() or skill_dir.name.startswith('.'):
                    continue

                skill_md = skill_dir / "SKILL.md"
                if not skill_md.exists():
                    continue

                try:
                    frontmatter = self._parse_frontmatter(skill_md)
                except yaml.YAMLError as e:
                    violations.append(
                        self.violation(
                            f"SKILL.md has malformed YAML frontmatter: {e}",
                            file_path=skill_md
                        )
                    )
                    continue
                if frontmatter is None:
                    continue  # Built-in skill-frontmatter rule handles missing frontmatter

                if not frontmatter.get('license'):
                    violations.append(
                        self.violation(
                            f"SKILL.md is missing 'license' field. "
                            f"Add 'license: Proprietary' (or appropriate license) to frontmatter.",
                            file_path=skill_md
                        )
                    )

                metadata = frontmatter.get('metadata')
                if not isinstance(metadata, dict) or not metadata.get('author'):
                    violations.append(
                        self.violation(
                            f"SKILL.md is missing 'metadata.author' field. "
                            f"Add 'metadata:\\n  author: Name <email>' to frontmatter.",
                            file_path=skill_md
                        )
                    )
                else:
                    author_violation = self._validate_author_format(metadata['author'])
                    if author_violation:
                        violations.append(
                            self.violation(author_violation, file_path=skill_md)
                        )

        return violations

    def _validate_author_format(self, author: str) -> Optional[str]:
        """Validate that author follows 'Name <email>' format. Returns error message or None."""
        if not isinstance(author, str) or not author.strip():
            return (
                "metadata.author must be a non-empty string in the format "
                "'Name <email>'. Example: 'Jane Doe <jane.doe@okta.com>'"
            )

        if ';' in author:
            return (
                "metadata.author uses semicolon separator. "
                "Use comma to separate multiple authors. "
                "Example: 'Jane Doe <jane@okta.com>, John Doe <john@okta.com>'"
            )

        entries = author.split(',')

        for entry in entries:
            entry = entry.strip()
            if not entry:
                continue
            if not self.AUTHOR_RE.match(entry):
                return (
                    f"metadata.author entry '{entry}' does not match expected format "
                    f"'Name <email>'. Example: 'Jane Doe <jane.doe@okta.com>'"
                )

        return None

    @staticmethod
    def _parse_frontmatter(skill_md: Path) -> Optional[Dict[str, Any]]:
        """Extract YAML frontmatter from a SKILL.md file.

        Returns None if the file has no frontmatter.
        Raises yaml.YAMLError if frontmatter exists but is malformed.
        """
        try:
            content = skill_md.read_text()
        except OSError:
            return None

        if not content.startswith('---'):
            return None

        # Find closing ---
        end = content.find('---', 3)
        if end == -1:
            return None

        # Let yaml.YAMLError propagate so the caller can report it as a violation
        return yaml.safe_load(content[3:end])