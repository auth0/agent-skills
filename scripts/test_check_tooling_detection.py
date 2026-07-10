import json, tempfile, unittest
from pathlib import Path
from check_tooling_detection import (
    detect,
    check_tooling,
    check_tooling_cases,
    check_tooling_coverage,
    reachable_toolings,
    _parse_left_cell,
    _tooling_rules,
)

# A compact but faithful Step 3 fixture: the specific Terraform OR-group row, the
# signal-less MCP runtime row (must be un-reachable mechanically), and the
# catch-all default. Mirrors the real SKILL.md shape.
SKILL = """## Step 3: Detect tooling

Read the project file tree.

| Project has... | Load |
|---|---|
| `terraform/` directory OR any `*.tf` files | `tooling-terraform.md` |
| Auth0 MCP server active in this agent session | `tooling-mcp.md` |
| Anything else (default) | `tooling-cli.md` |

## Step 4: next
"""


class ParseTest(unittest.TestCase):
    def test_or_group(self):
        groups = _parse_left_cell("`terraform/` directory OR any `*.tf` files")
        self.assertEqual(groups, [{"terraform/", "*.tf"}])

    def test_prose_only_clause_dropped(self):
        # The MCP row has no backticked token -> no OR-group.
        self.assertEqual(_parse_left_cell("Auth0 MCP server active in this agent session"), [])


class DetectTest(unittest.TestCase):
    def test_terraform_dir(self):
        self.assertEqual(detect(SKILL, ["terraform/"]), "terraform")

    def test_terraform_tf_file_via_or_group(self):
        self.assertEqual(detect(SKILL, ["*.tf"]), "terraform")

    def test_default_when_no_signal(self):
        self.assertEqual(detect(SKILL, []), "cli")

    def test_default_when_unrelated_signal(self):
        self.assertEqual(detect(SKILL, ["package.json"]), "cli")

    def test_mcp_row_is_not_mechanically_reachable(self):
        # The MCP row carries no file signal, so nothing resolves to it; a
        # project with no Terraform signal falls through to the default.
        self.assertNotEqual(detect(SKILL, ["anything"]), "mcp")

    def test_rules_in_document_order(self):
        tools = [r.tooling for r in _tooling_rules(SKILL)]
        self.assertEqual(tools, ["terraform", "mcp", "cli"])

    def test_default_row_flagged(self):
        rules = {r.tooling: r for r in _tooling_rules(SKILL)}
        self.assertTrue(rules["cli"].is_default)
        self.assertFalse(rules["terraform"].is_default)

    def test_reorder_regression_is_detectable(self):
        # If the default row is moved ABOVE the Terraform row, every project
        # (including a Terraform one) mis-detects as cli.
        mutated = SKILL.replace(
            "| `terraform/` directory OR any `*.tf` files | `tooling-terraform.md` |\n"
            "| Auth0 MCP server active in this agent session | `tooling-mcp.md` |\n"
            "| Anything else (default) | `tooling-cli.md` |",
            "| Anything else (default) | `tooling-cli.md` |\n"
            "| `terraform/` directory OR any `*.tf` files | `tooling-terraform.md` |\n"
            "| Auth0 MCP server active in this agent session | `tooling-mcp.md` |",
        )
        self.assertNotEqual(mutated, SKILL)
        self.assertEqual(detect(mutated, ["terraform/"]), "cli")


class CoverageTest(unittest.TestCase):
    EXPECTED_REACHABLE = {"terraform", "cli"}  # mcp is signal-less -> excluded

    def test_reachable_set(self):
        self.assertEqual(reachable_toolings(SKILL), self.EXPECTED_REACHABLE)

    def test_full_coverage_passes(self):
        cases = [{"id": f"c{i}", "signals": [], "expect_tooling": t}
                 for i, t in enumerate(self.EXPECTED_REACHABLE)]
        self.assertEqual(check_tooling_coverage(SKILL, cases), [])

    def test_uncovered_reachable_tooling_fails(self):
        cases = [{"id": "c1", "signals": ["terraform/"], "expect_tooling": "terraform"}]
        failures = check_tooling_coverage(SKILL, cases)
        self.assertTrue(
            any("cli" in f and "no case" in f for f in failures),
            f"expected a coverage failure for cli, got: {failures}",
        )

    def test_mcp_not_required(self):
        # The signal-less MCP row must not be demanded by the coverage gate.
        self.assertNotIn("mcp", reachable_toolings(SKILL))


class CheckToolingCasesTest(unittest.TestCase):
    def _skill_dir(self, root: Path, cases: list, refs=("tooling-cli.md", "tooling-terraform.md")):
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "tests").mkdir(parents=True)
        (skill / "SKILL.md").write_text(SKILL)
        for r in refs:
            (skill / "references" / r).write_text("ok")
        (skill / "tests" / "tooling-cases.json").write_text(json.dumps({"cases": cases}))
        return skill

    def test_passing_case(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": ["terraform/"], "expect_tooling": "terraform"}],
            )
            self.assertEqual(check_tooling_cases(skill), [])

    def test_wrong_expectation_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": [], "expect_tooling": "terraform"}],
            )
            failures = check_tooling_cases(skill)
            self.assertTrue(any("c1" in f and "detected 'cli'" in f for f in failures))

    def test_missing_ref_file_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": ["terraform/"], "expect_tooling": "terraform"}],
                refs=("tooling-cli.md",),  # no tooling-terraform.md on disk
            )
            failures = check_tooling_cases(skill)
            self.assertTrue(any("no references/tooling-terraform.md" in f for f in failures))


if __name__ == "__main__":
    unittest.main()
