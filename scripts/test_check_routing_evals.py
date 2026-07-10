import json, tempfile, unittest
from pathlib import Path
from check_routing_evals import (
    check_case_routes,
    check_intent_symmetry,
    check_case_coverage,
    step1_intents,
)


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

# A Step 1 intent table whose value (last) column carries the bolded Intent
# key. Note the description column also bolds an Auth0 term (**MFA**) to prove
# the parser reads the Intent from the LAST cell, not any bolded token.
STEP1 = (
    "## Step 1: Detect intent\n"
    "| What the developer wants | Intent |\n"
    "|---|---|\n"
    "| Add login/signup | **integrate** |\n"
    "| Second step after password. *Auth0: **MFA**.* | **feature:mfa** |\n"
    "| Best practices, is this secure | **guidance** |\n"
    "## Step 2: next\n"
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
            self.assertEqual(check_case_routes(skill), [])

    def test_unknown_intent_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4, ["feature-mfa.md"],
                [{"id": "c1", "intent": "feature:nope", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa.md"]}],
            )
            failures = check_case_routes(skill)
            self.assertTrue(any("no '### feature:nope'" in f for f in failures))

    def test_missing_reference_file_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4, ["feature-mfa.md"],
                [{"id": "c1", "intent": "integrate", "framework": "react",
                  "tooling": "cli", "expect_refs": ["framework-react.md"]}],
            )
            failures = check_case_routes(skill)
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
            failures = check_case_routes(skill)
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
            failures = check_case_routes(skill)
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
            self.assertEqual(check_case_routes(skill), [])

    def test_conditional_framework_omitted_when_null(self):
        """`If framework detected` ref is optional when no framework -> passes."""
        with tempfile.TemporaryDirectory() as d:
            skill = _make_skill(
                Path(d), STEP4_FULL, FULL_REFS,
                [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli",
                  "expect_refs": ["feature-mfa.md", "tooling-cli.md"]}],
            )
            self.assertEqual(check_case_routes(skill), [])

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
            failures = check_case_routes(skill)
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
            failures = check_case_routes(skill)
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
            self.assertEqual(check_case_routes(skill), [])

    # --- Step 1 intent parsing ----------------------------------------------

    def test_step1_intents_read_from_value_column(self):
        """Intent keys come from the LAST cell, not a bolded description term."""
        intents = step1_intents(STEP1)
        self.assertEqual(intents, {"integrate", "feature:mfa", "guidance"})
        # **MFA** in the description column must NOT be mistaken for an intent.
        self.assertNotIn("mfa", intents)

    # --- Step 1 <-> Step 4 symmetry -----------------------------------------

    def test_symmetry_holds_when_intents_match(self):
        skill_md = STEP1 + STEP4_FULL
        self.assertEqual(check_intent_symmetry(skill_md), [])

    def test_step1_intent_without_step4_section_is_dead_route(self):
        # Step 1 declares guidance, but STEP4 (small) has only integrate+mfa.
        skill_md = STEP1 + STEP4
        failures = check_intent_symmetry(skill_md)
        self.assertTrue(
            any("guidance" in f and "dead route" in f for f in failures),
            f"expected a 'dead route' failure, got: {failures}",
        )

    def test_step4_section_without_step1_row_is_unreachable(self):
        # STEP1_MISSING drops the guidance row; STEP4_FULL still has it.
        step1_missing = STEP1.replace(
            "| Best practices, is this secure | **guidance** |\n", ""
        )
        failures = check_intent_symmetry(step1_missing + STEP4_FULL)
        self.assertTrue(
            any("guidance" in f and "unreachable section" in f for f in failures),
            f"expected an 'unreachable section' failure, got: {failures}",
        )

    # --- every Step 4 section is exercised by a case ------------------------

    def test_uncovered_section_fails_coverage(self):
        # STEP4_FULL has integrate, feature:mfa, guidance; case covers only mfa.
        cases = [{"id": "c1", "intent": "feature:mfa", "framework": None,
                  "tooling": "cli", "expect_refs": ["feature-mfa.md"]}]
        failures = check_case_coverage(STEP4_FULL, cases)
        self.assertTrue(any("integrate" in f for f in failures))
        self.assertTrue(any("guidance" in f for f in failures))

    def test_full_coverage_passes(self):
        cases = [
            {"id": "a", "intent": "integrate", "expect_refs": []},
            {"id": "b", "intent": "feature:mfa", "expect_refs": []},
            {"id": "c", "intent": "guidance", "expect_refs": []},
        ]
        self.assertEqual(check_case_coverage(STEP4_FULL, cases), [])


if __name__ == "__main__":
    unittest.main()
