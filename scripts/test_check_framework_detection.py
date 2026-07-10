import json, tempfile, unittest
from pathlib import Path
from check_framework_detection import (
    detect,
    check_detection,
    check_detection_cases,
    check_framework_coverage,
    reachable_frameworks,
    _parse_left_cell,
    _detection_rules,
    _variant_table,
)

# A compact but structurally faithful Step 2 fixture: Tier 1 first (Auth0 SDKs,
# with the ordering traps + a negation row + an OR-group), then Tier 2, then the
# variant disambiguation table. Mirrors the real SKILL.md shape so the parser is
# exercised on every clause form it must handle.
SKILL = """## Step 2: Detect framework

### Tier 1
| Package | Framework |
|---|---|
| `@capacitor/browser` + `@auth0/auth0-react` | `ionic-react` |
| `@auth0/nextjs-auth0` | `nextjs` |
| `@auth0/auth0-react` | `react` |
| `react-native-auth0` + `app.json` or `app.config.js` present | `expo` |
| `react-native-auth0` (no Expo files) | `react-native` |
| `auth0/login` + `AuthorizationGuard` | `laravel-api` |
| `auth0/login` (laravel, no `AuthorizationGuard`) | `laravel` |
| `mvc-auth-commons` (`com.auth0:mvc-auth-commons`) | `java-mvc` |

### Tier 2
| Signal | Base framework |
|---|---|
| `next` in `package.json` | `nextjs` |
| `express` in `package.json` | `express` (variant below) |
| `vue` in `package.json` (no `nuxt`) | `vue` |

### Variant disambiguation (web app vs API)
| Base | Web-app variant | API variant | Choose API when… |
|---|---|---|---|
| express | `express` | `express-jwt` | protecting API routes |

### If nothing matched
Ask.
"""


class ParseTest(unittest.TestCase):
    def test_and_split_on_plus(self):
        clauses, neg = _parse_left_cell("`@capacitor/browser` + `@auth0/auth0-react`")
        self.assertEqual(clauses, [{"@capacitor/browser"}, {"@auth0/auth0-react"}])
        self.assertEqual(neg, set())

    def test_or_group(self):
        clauses, neg = _parse_left_cell(
            "`react-native-auth0` + `app.json` or `app.config.js` present"
        )
        self.assertIn({"react-native-auth0"}, clauses)
        self.assertIn({"app.json", "app.config.js"}, clauses)

    def test_negation_keeps_positive_signal(self):
        # "`react-native-auth0` (no Expo files)" — Expo files are prose, no token.
        clauses, neg = _parse_left_cell("`react-native-auth0` (no Expo files)")
        self.assertEqual(clauses, [{"react-native-auth0"}])
        self.assertEqual(neg, set())

    def test_negation_zone_negates_backticked_tail(self):
        clauses, neg = _parse_left_cell("`auth0/login` (laravel, no `AuthorizationGuard`)")
        self.assertEqual(clauses, [{"auth0/login"}])
        self.assertEqual(neg, {"AuthorizationGuard"})

    def test_explanatory_gloss_dropped(self):
        # "`vue` in `package.json` (no `nuxt`)" -> require vue, negate nuxt.
        clauses, neg = _parse_left_cell("`vue` in `package.json` (no `nuxt`)")
        self.assertEqual(clauses, [{"vue"}])
        self.assertEqual(neg, {"nuxt"})


class DetectTest(unittest.TestCase):
    def test_ionic_beats_plain_react(self):
        self.assertEqual(
            detect(SKILL, ["@capacitor/browser", "@auth0/auth0-react"]), "ionic-react"
        )

    def test_nextjs_beats_react(self):
        self.assertEqual(
            detect(SKILL, ["@auth0/nextjs-auth0", "@auth0/auth0-react"]), "nextjs"
        )

    def test_expo_via_or_group(self):
        self.assertEqual(detect(SKILL, ["react-native-auth0", "app.config.js"]), "expo")

    def test_react_native_when_no_expo_files(self):
        self.assertEqual(detect(SKILL, ["react-native-auth0"]), "react-native")

    def test_negation_blocks_laravel_api_row(self):
        # auth0/login alone: the laravel-api row (needs AuthorizationGuard) must
        # NOT fire; the negated laravel row must.
        self.assertEqual(detect(SKILL, ["auth0/login"]), "laravel")

    def test_laravel_api_when_guard_present(self):
        self.assertEqual(detect(SKILL, ["auth0/login", "AuthorizationGuard"]), "laravel-api")

    def test_variant_web_vs_api(self):
        self.assertEqual(detect(SKILL, ["express"], api_intent=False), "express")
        self.assertEqual(detect(SKILL, ["express"], api_intent=True), "express-jwt")

    def test_no_match_returns_none(self):
        self.assertIsNone(detect(SKILL, ["totally-unrelated"]))

    def test_reorder_regression_is_detectable(self):
        # THE point of the checker: if the plain react row is moved above the
        # nextjs row, a Next.js app mis-detects as react.
        mutated = SKILL.replace(
            "| `@auth0/nextjs-auth0` | `nextjs` |\n| `@auth0/auth0-react` | `react` |",
            "| `@auth0/auth0-react` | `react` |\n| `@auth0/nextjs-auth0` | `nextjs` |",
        )
        self.assertNotEqual(mutated, SKILL)
        self.assertEqual(detect(mutated, ["@auth0/nextjs-auth0", "@auth0/auth0-react"]), "react")

    def test_variant_table_parsed(self):
        self.assertEqual(_variant_table(SKILL), {"express": ("express", "express-jwt")})

    def test_rules_are_in_document_order(self):
        rules = _detection_rules(SKILL)
        fws = [r.framework for r in rules]
        # Tier 1 rows precede Tier 2 rows (precedence via order).
        self.assertLess(fws.index("ionic-react"), fws.index("nextjs"))
        self.assertLess(fws.index("java-mvc"), fws.index("express"))


class CheckDetectionTest(unittest.TestCase):
    """Exercises the per-case layer (check_detection_cases) with small,
    hand-authored case lists. The full check_detection composite (which also runs
    the coverage gate) would fault these single-case lists for not exercising
    every reachable framework — that composite is covered by CoverageTest."""

    def _skill_dir(self, root: Path, cases: list, refs=("framework-nextjs.md",)):
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "tests").mkdir(parents=True)
        (skill / "SKILL.md").write_text(SKILL)
        for r in refs:
            (skill / "references" / r).write_text("ok")
        (skill / "tests" / "detection-cases.json").write_text(json.dumps({"cases": cases}))
        return skill

    def test_passing_case(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": ["@auth0/nextjs-auth0"], "expect_framework": "nextjs"}],
            )
            self.assertEqual(check_detection_cases(skill), [])

    def test_wrong_expectation_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": ["@auth0/nextjs-auth0"], "expect_framework": "react"}],
                refs=("framework-nextjs.md", "framework-react.md"),
            )
            failures = check_detection_cases(skill)
            self.assertTrue(any("c1" in f and "detected 'nextjs'" in f for f in failures))

    def test_detected_framework_missing_ref_file_fails(self):
        with tempfile.TemporaryDirectory() as d:
            # Expect nextjs (correctly detected) but no framework-nextjs.md on disk.
            skill = self._skill_dir(
                Path(d),
                [{"id": "c1", "signals": ["@auth0/nextjs-auth0"], "expect_framework": "nextjs"}],
                refs=(),
            )
            failures = check_detection_cases(skill)
            self.assertTrue(any("no references/framework-nextjs.md" in f for f in failures))


class CoverageTest(unittest.TestCase):
    # The frameworks the SKILL fixture's cascade can actually emit as a result.
    # Note `express` resolves to BOTH express (web) and express-jwt (api variant),
    # so both are reachable from a single express base row.
    EXPECTED_REACHABLE = {
        "ionic-react", "nextjs", "react", "expo", "react-native",
        "laravel-api", "laravel", "java-mvc", "vue", "express", "express-jwt",
    }

    def test_reachable_set_matches_cascade(self):
        self.assertEqual(reachable_frameworks(SKILL), self.EXPECTED_REACHABLE)

    def test_full_coverage_passes(self):
        cases = [{"id": f"c{i}", "signals": [], "expect_framework": fw}
                 for i, fw in enumerate(self.EXPECTED_REACHABLE)]
        self.assertEqual(check_framework_coverage(SKILL, cases), [])

    def test_uncovered_reachable_framework_fails(self):
        # Cover everything except nextjs -> nextjs must be reported.
        cases = [{"id": f"c{i}", "signals": [], "expect_framework": fw}
                 for i, fw in enumerate(self.EXPECTED_REACHABLE - {"nextjs"})]
        failures = check_framework_coverage(SKILL, cases)
        self.assertTrue(
            any("nextjs" in f and "no detection case" in f for f in failures),
            f"expected a coverage failure for nextjs, got: {failures}",
        )

    def test_prose_only_row_is_not_required(self):
        # A framework whose detection row carries NO backticked signal (prose
        # only — e.g. a Tier 3 "developer mentions X" row) can never match the
        # cascade, so the coverage gate must not demand a case for it.
        prose_row = "| plain-english only, no token | `mysteryfw` |\n"
        mutated = SKILL.replace(
            "| `express` in `package.json` | `express` (variant below) |\n",
            "| `express` in `package.json` | `express` (variant below) |\n" + prose_row,
        )
        self.assertNotEqual(mutated, SKILL)
        self.assertNotIn("mysteryfw", reachable_frameworks(mutated))


if __name__ == "__main__":
    unittest.main()
