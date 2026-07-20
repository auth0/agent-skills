import json, tempfile, unittest
from pathlib import Path
from check_routing_evals import check_routing


def _make_index_group_skill(root: Path, skill_md: str, group_names: list,
                             cases: list) -> Path:
    """Build a skill where every ref in `group_names` is an index-only group
    directory (references/<name>/index.md, no leaves)."""
    skill = root / "plugins/auth0/skills/auth0"
    (skill / "references").mkdir(parents=True)
    (skill / "tests").mkdir(parents=True)
    (skill / "SKILL.md").write_text(skill_md)
    for name in group_names:
        gdir = skill / "references" / name
        gdir.mkdir()
        (gdir / "index.md").write_text(f"# {name}\ncontent")
    (skill / "tests" / "routing-cases.json").write_text(json.dumps({"cases": cases}))
    return skill


STEP4 = (
    "## Step 4: Load reference files\n"
    "### integrate\n```\nRead: references/framework-{framework}/index.md\n```\n"
    "### feature:mfa\n```\nRead: references/feature-mfa/index.md\n```\n"
)

# A fuller fixture that mirrors the real Step 4 routing: unconditional reads
# plus modeled `If ...` conditionals, so the routing-aware assertions have
# something to exercise.
STEP4_FULL = (
    "## Step 4: Load reference files\n"
    "### integrate\n```\n"
    "Read: references/framework-{framework}/index.md\n"
    "Read: references/tooling-{tooling}/index.md\n"
    "```\n"
    "### feature:mfa\n```\n"
    "Read: references/feature-mfa/index.md\n"
    "Read: references/tooling-{tooling}/index.md\n"
    "If framework detected: Read references/framework-{framework}/index.md\n"
    "```\n"
    "### guidance\n```\n"
    "Read: references/pattern-security/index.md\n"
    "If token handling / JWT vs opaque / storage: Read references/pattern-token-handling/index.md\n"
    "If multi-tenant / B2B architecture: Read references/pattern-multi-tenant/index.md + references/feature-organizations/index.md\n"
    "```\n"
    "## Step 5: done\n"
)

FULL_REFS = [
    "framework-react", "framework-nextjs",
    "tooling-cli", "feature-mfa",
    "pattern-security", "pattern-token-handling",
    "pattern-multi-tenant", "feature-organizations",
]


class RoutingEvalTest(unittest.TestCase):
    def test_valid_case_passes(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4,
                ["framework-react", "feature-mfa"],
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa/index.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_unknown_intent_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4, ["feature-mfa"],
                [{"id": "c1", "intent": "feature:nope", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("no '### feature:nope'" in f for f in failures))

    def test_missing_reference_file_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4, ["feature-mfa"],
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["framework-react/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("framework-react/index.md" in f and "does not exist" in f
                                 for f in failures))

    # --- routing-aware assertions -------------------------------------------

    def test_wrong_route_fails(self):
        """expect_refs names a file the intent never routes to -> 'not routed'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["feature-mfa/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("feature-mfa/index.md" in f and "not routed" in f for f in failures),
                f"expected a 'not routed' failure, got: {failures}",
            )

    def test_missing_mandatory_ref_fails(self):
        """expect_refs omits an unconditional read -> 'missing mandatory'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                # integrate unconditionally reads framework-{fw} AND tooling-{tool};
                # only framework-react/index.md is listed, so tooling-cli/index.md is missing.
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["framework-react/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("tooling-cli/index.md" in f and "missing mandatory" in f
                    for f in failures),
                f"expected a 'missing mandatory' failure, got: {failures}",
            )

    def test_correct_combo_case_passes(self):
        """feature:mfa + framework nextjs -> feature-mfa, tooling-cli, framework-nextjs."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": "nextjs",
                  "tooling": "cli",
                  "expect_refs": ["feature-mfa/index.md", "tooling-cli/index.md",
                                  "framework-nextjs/index.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_conditional_framework_omitted_when_null(self):
        """`If framework detected` ref is optional when no framework -> passes."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli",
                  "expect_refs": ["feature-mfa/index.md", "tooling-cli/index.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_conditional_when_flag_false_is_not_routed(self):
        """Naming a conditional ref whose flag is false -> 'not routed'."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                # guidance without token_handling: pattern-token-handling/index.md
                # is gated off, so naming it is a wrong route.
                [{"id": "c1", "intent": "guidance", "framework": None,
                  "tooling": "cli",
                  "expect_refs": ["pattern-security/index.md",
                                  "pattern-token-handling/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("pattern-token-handling/index.md" in f and "not routed" in f
                    for f in failures),
                f"expected a 'not routed' failure, got: {failures}",
            )

    def test_enabled_conditional_ref_is_required(self):
        """A modeled conditional whose gate is ON must appear in expect_refs.

        feature:mfa + framework=nextjs enables `If framework detected: Read
        framework-{framework}/index.md`. Omitting framework-nextjs/index.md
        must FAIL — this is the combo path ("MFA in a Next.js app") that was
        previously under-specifiable because enabled conditionals were only
        'allowed'.
        """
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": "nextjs",
                  "tooling": "cli",
                  # framework-nextjs/index.md deliberately omitted.
                  "expect_refs": ["feature-mfa/index.md", "tooling-cli/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(
                any("framework-nextjs/index.md" in f and "missing mandatory" in f
                    for f in failures),
                f"expected a 'missing mandatory' failure, got: {failures}",
            )

    def test_multi_tenant_pulls_both_refs(self):
        """guidance + multi_tenant routes to both multi-tenant + organizations."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_index_group_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "guidance", "framework": None,
                  "tooling": "cli", "multi_tenant": True,
                  "expect_refs": ["pattern-security/index.md",
                                  "pattern-multi-tenant/index.md",
                                  "feature-organizations/index.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_index_only_group_resolves_to_index(self):
        # A reference with no leaves: router routes references/<name>/index.md;
        # expect_refs is just <name>/index.md (no leaf).
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d),
                "## Step 4: Load reference files\n"
                "### feature:mfa\n```\nRead: references/feature-mfa/index.md\n```\n"
                "## Step 5\n",
                [],
                {"feature-mfa": {"index": "# mfa\ncontent", "leaves": []}},
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": None, "expect_refs": ["feature-mfa/index.md"]}],
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
        "Read: references/framework-{framework}/index.md\n"
        "Read: references/tooling-{tooling}/index.md\n```\n"
        "### upgrade-sdk\n```\n"
        "Read: references/framework-{framework}/index.md\n```\n"
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
                Path(d), self.GROUP_STEP4, [],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]},
                 "tooling-cli": {"index": "# cli\ncontent", "leaves": []}},
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/integrate.md",
                                  "tooling-cli/index.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_upgrade_resolves_to_migration_leaf(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, [],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]},
                 "tooling-cli": {"index": "# cli\ncontent", "leaves": []}},
                [{"id": "c1", "intent": "upgrade-sdk", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_wrong_leaf_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, [],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]},
                 "tooling-cli": {"index": "# cli\ncontent", "leaves": []}},
                # integrate must resolve to integrate.md, not migration.md
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md",
                                  "tooling-cli/index.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("framework-swift/migration.md" in f for f in failures),
                            f"expected a failure naming the wrong leaf, got: {failures}")


if __name__ == "__main__":
    unittest.main()
