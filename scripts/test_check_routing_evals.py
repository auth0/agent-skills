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

# A fuller fixture that mirrors the real Step 4 routing: unconditional reads
# plus modeled `If ...` conditionals, so the routing-aware assertions have
# something to exercise.
STEP4_FULL = (
    "## Step 4: Load reference files\n"
    "### integrate\n```\n"
    "Read: references/framework-{framework}.md\n"
    "Read: references/tooling-{tooling}.md\n"
    "```\n"
    "### feature:mfa\n```\n"
    "Read: references/feature-mfa.md\n"
    "Read: references/tooling-{tooling}.md\n"
    "If framework detected: Read references/framework-{framework}.md\n"
    "```\n"
    "### guidance\n```\n"
    "Read: references/pattern-security.md\n"
    "If token handling / JWT vs opaque / storage: Read references/pattern-token-handling.md\n"
    "If multi-tenant / B2B architecture: Read references/pattern-multi-tenant.md + references/feature-organizations.md\n"
    "```\n"
    "## Step 5: done\n"
)

FULL_REFS = [
    "framework-react.md", "framework-nextjs.md",
    "tooling-cli.md", "feature-mfa.md",
    "pattern-security.md", "pattern-token-handling.md",
    "pattern-multi-tenant.md", "feature-organizations.md",
]


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

    # --- routing-aware assertions -------------------------------------------

    def test_wrong_route_fails(self):
        """expect_refs names a file the intent never routes to -> 'not routed'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["feature-mfa.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("feature-mfa.md" in f and "not routed" in f for f in failures),
                f"expected a 'not routed' failure, got: {failures}",
            )

    def test_missing_mandatory_ref_fails(self):
        """expect_refs omits an unconditional read -> 'missing mandatory'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                # integrate unconditionally reads framework-{fw} AND tooling-{tool};
                # only framework-react.md is listed, so tooling-cli.md is missing.
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["framework-react.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("tooling-cli.md" in f and "missing mandatory" in f
                    for f in failures),
                f"expected a 'missing mandatory' failure, got: {failures}",
            )

    def test_correct_combo_case_passes(self):
        """feature:mfa + framework nextjs -> feature-mfa, tooling-cli, framework-nextjs."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": "nextjs",
                  "tooling": "cli",
                  "expect_refs": ["feature-mfa.md", "tooling-cli.md",
                                  "framework-nextjs.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_conditional_framework_omitted_when_null(self):
        """`If framework detected` ref is optional when no framework -> passes."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli",
                  "expect_refs": ["feature-mfa.md", "tooling-cli.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_conditional_when_flag_false_is_not_routed(self):
        """Naming a conditional ref whose flag is false -> 'not routed'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                # guidance without token_handling: pattern-token-handling.md
                # is gated off, so naming it is a wrong route.
                [{"id": "c1", "intent": "guidance", "framework": None,
                  "tooling": "cli",
                  "expect_refs": ["pattern-security.md",
                                  "pattern-token-handling.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("pattern-token-handling.md" in f and "not routed" in f
                    for f in failures),
                f"expected a 'not routed' failure, got: {failures}",
            )

    def test_enabled_conditional_ref_is_required(self):
        """A modeled conditional whose gate is ON must appear in expect_refs.

        feature:mfa + framework=nextjs enables `If framework detected: Read
        framework-{framework}.md`. Omitting framework-nextjs.md must FAIL —
        this is the combo path ("MFA in a Next.js app") that was previously
        under-specifiable because enabled conditionals were only 'allowed'.
        """
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": "nextjs",
                  "tooling": "cli",
                  # framework-nextjs.md deliberately omitted.
                  "expect_refs": ["feature-mfa.md", "tooling-cli.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("framework-nextjs.md" in f and "missing mandatory" in f
                    for f in failures),
                f"expected a 'missing mandatory' failure, got: {failures}",
            )

    def test_multi_tenant_pulls_both_refs(self):
        """guidance + multi_tenant routes to both multi-tenant + organizations."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "guidance", "framework": None,
                  "tooling": "cli", "multi_tenant": True,
                  "expect_refs": ["pattern-security.md",
                                  "pattern-multi-tenant.md",
                                  "feature-organizations.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def _make_group_skill(self, root, skill_md, flat_refs, groups, cases):
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "tests").mkdir(parents=True)
        (skill / "SKILL.md").write_text(skill_md)
        for name in flat_refs:
            (skill / "references" / name).write_text("ok")
        for gname, spec in groups.items():
            gdir = skill / "references" / gname
            gdir.mkdir()
            (gdir / "index.md").write_text(spec["index"])
            for leaf in spec["leaves"]:
                (gdir / leaf).write_text("ok")
        (skill / "tests" / "routing-cases.json").write_text(json.dumps({"cases": cases}))
        return skill

    GROUP_STEP4 = (
        "## Step 4: Load reference files\n"
        "### integrate\n```\n"
        "Read: references/framework-{framework}.md\n"
        "Read: references/tooling-{tooling}.md\n```\n"
        "### upgrade-sdk\n```\n"
        "Read: references/framework-{framework}.md\n```\n"
        "## Step 5\n"
    )
    GROUP_INDEX = (
        "# Swift hub\n"
        "| integrate | `Read: references/framework-swift/integrate.md` |\n"
        "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"
    )

    def test_grouped_integrate_resolves_to_index_and_leaf(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/integrate.md", "tooling-cli.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_upgrade_resolves_to_migration_leaf(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                [{"id": "c1", "intent": "upgrade-sdk", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_wrong_leaf_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                # integrate must resolve to integrate.md, not migration.md
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md", "tooling-cli.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("framework-swift/migration.md" in f for f in failures),
                            f"expected a failure naming the wrong leaf, got: {failures}")


if __name__ == "__main__":
    unittest.main()
