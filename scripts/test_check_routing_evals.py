import json, tempfile, unittest
from pathlib import Path
from check_routing_evals import check_routing


def _make_skill(root: Path, skill_md: str, refs: list, cases: list) -> Path:
    skill = root / "plugins/auth0/skills/auth0"
    (skill / "references").mkdir(parents=True)
    (skill / "tests").mkdir(parents=True)
    (skill / "SKILL.md").write_text(skill_md)
    for name in refs:
        (skill / "references" / name).write_text("ok")
    (skill / "tests" / "routing-cases.json").write_text(json.dumps({"cases": cases}))
    return skill


STEP4 = (
    "## Step 4: Load reference files\n"
    "### integrate\n```\nRead: references/framework-{framework}.md\n```\n"
    "### feature:mfa\n```\nRead: references/feature-mfa.md\n```\n"
)


class RoutingEvalTest(unittest.TestCase):
    def test_valid_case_passes(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4,
                ["framework-react.md", "feature-mfa.md"],
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_unknown_intent_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4, ["feature-mfa.md"],
                [{"id": "c1", "intent": "feature:nope", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("no '### feature:nope'" in f for f in failures))

    def test_missing_reference_file_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4, ["feature-mfa.md"],
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["framework-react.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("framework-react.md" in f and "does not exist" in f
                                 for f in failures))


if __name__ == "__main__":
    unittest.main()
