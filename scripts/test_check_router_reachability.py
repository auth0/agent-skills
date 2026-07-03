import tempfile, unittest
from pathlib import Path
from check_router_reachability import check_router

def _make_skill(root: Path, skill_md: str, refs: dict[str, str]) -> Path:
    skill = root / "plugins/auth0/skills/auth0"
    (skill / "references").mkdir(parents=True)
    (skill / "SKILL.md").write_text(skill_md)
    for name, body in refs.items():
        (skill / "references" / name).write_text(body)
    return skill

class ReachabilityTest(unittest.TestCase):
    def test_orphan_file_is_unreachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md": "ok", "framework-php-api.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn("framework-php-api.md", unreachable)
            self.assertEqual(bad_links, [])

    def test_template_expansion_reaches_files(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "| a | `react` |\n| b | `php-api` |\n",
                {"framework-react.md": "ok", "framework-php-api.md": "ok"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertEqual(unreachable, [])

    def test_reference_linking_existing_reference_is_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md": "see [x](feature-mfa.md)", "feature-mfa.md": "ok"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn(("framework-react.md", "feature-mfa.md"), bad_links)

    def test_reference_linking_nonexistent_md_is_flagged(self):
        # Dead cross-refs (target does not exist) must ALSO be caught.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md": "see [setup](setup.md) and [api](react-api.md)"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn(("framework-react.md", "setup.md"), bad_links)
            self.assertIn(("framework-react.md", "react-api.md"), bad_links)

    def test_external_and_asset_links_not_flagged(self):
        # https:// links and non-.md asset paths are fine.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md":
                    "[docs](https://auth0.com/docs/x.md) "
                    "[docs2](https://auth0.com/docs/y.md#anchor) "
                    "[tpl](../assets/acul/react-templates/login-id.tsx)"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertEqual(bad_links, [])

    def test_path_prefixed_md_links_are_flagged(self):
        # Links with ./ ../ or references/ prefixes (and links to ../SKILL.md)
        # must ALL be flagged — the one-hop rule forbids any .md link.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md":
                    "[a](./references/setup.md) "
                    "[b](../SKILL.md) "
                    "[c](react-integration.md#protected-routes)"},
            )
            unreachable, bad_links = check_router(skill)
            targets = [t for _, t in bad_links]
            self.assertIn("./references/setup.md", targets)
            self.assertIn("../SKILL.md", targets)
            self.assertIn("react-integration.md", targets)

    def test_non_inline_md_link_forms_are_flagged(self):
        # The one-hop rule forbids EVERY intra-references .md link, not just the
        # inline [text](x.md) form. Reference-style definitions, titled inline
        # links, and autolinks must all be caught.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md":
                    "[ref]: feature-mfa.md\n"
                    "[titled](feature-branding.md \"Branding\")\n"
                    "[angle](<feature-dpop.md>)\n"
                    "see <feature-organizations.md> too\n"
                    "external autolink <https://auth0.com/x.md> is fine"},
            )
            unreachable, bad_links = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)        # reference-style
            self.assertIn("feature-branding.md", targets)   # titled inline
            self.assertIn("feature-dpop.md", targets)       # inline <>
            self.assertIn("feature-organizations.md", targets)  # autolink
            # The external https autolink must NOT be flagged.
            self.assertNotIn("https://auth0.com/x.md", targets)

    def test_template_slug_universe_comes_from_router_not_hardcode(self):
        # A framework file whose slug the router NEVER mentions must be flagged
        # unreachable — even though it matches the framework-*.md shape.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                # Router mentions only `react`; template read for {framework}.
                "Read: references/framework-{framework}.md\n"
                "| `@auth0/auth0-react` | `react` |\n",
                {"framework-react.md": "ok", "framework-php-api.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn("framework-php-api.md", unreachable)
            self.assertNotIn("framework-react.md", unreachable)

    def test_backticked_bare_md_target_is_reachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "| `terraform/` dir | `tooling-terraform.md` |\n",
                {"tooling-terraform.md": "ok", "tooling-orphan.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertNotIn("tooling-terraform.md", unreachable)
            self.assertIn("tooling-orphan.md", unreachable)

    def test_left_column_dependency_name_is_not_a_routable_slug(self):
        # A dependency name in the left (detection) column must NOT make a
        # same-named framework file reachable — only value-column slugs route.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "| `authlib` or `python-jose` + `flask` | `flask` |\n",
                {"framework-flask.md": "ok", "framework-authlib.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertNotIn("framework-flask.md", unreachable)  # value-col slug
            self.assertIn("framework-authlib.md", unreachable)   # left-col dep

    def test_lone_backtick_left_column_dependency_is_not_routable(self):
        # A left-column dependency name that is a LONE backticked token followed
        # by the `|` cell separator (the exact shape the old lookahead-based
        # SLUG_RE leaked) must NOT make a same-named framework file reachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "| `express-oauth2-jwt-bearer` | `express-jwt` |\n",
                {
                    "framework-express-jwt.md": "ok",
                    "framework-express-oauth2-jwt-bearer.md": "orphan",
                },
            )
            unreachable, bad_links = check_router(skill)
            self.assertNotIn("framework-express-jwt.md", unreachable)  # value slug
            self.assertIn(
                "framework-express-oauth2-jwt-bearer.md", unreachable
            )  # lone left-col dep — must be an orphan

    def test_left_column_slug_in_prose_cell_is_not_routable(self):
        # `next` appears in the left detection cell ("Next.js / `next`"); the
        # value column slug is `nextjs`. framework-nextjs.md is reachable but a
        # framework-next.md typo must be reported as an orphan.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "| Next.js / `next` | `nextjs` |\n",
                {"framework-nextjs.md": "ok", "framework-next.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertNotIn("framework-nextjs.md", unreachable)  # value slug
            self.assertIn("framework-next.md", unreachable)  # left-col typo orphan

    def test_html_anchor_md_link_is_flagged(self):
        # An <a href="x.md"> HTML link is an intra-references .md link too and
        # must be caught — the autolink regex can't match it (space after <a).
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md":
                    '<a href="feature-mfa.md">mfa</a> '
                    "<a href='./feature-branding.md#logo'>brand</a> "
                    '<a href="https://auth0.com/x.md">external ok</a>'},
            )
            unreachable, bad_links = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)
            self.assertIn("./feature-branding.md", targets)
            self.assertNotIn("https://auth0.com/x.md", targets)

    def test_query_and_trailing_slash_md_links_are_flagged(self):
        # `x.md?query` and `x.md/` targets previously slipped past the inline
        # regex (the char after .md wasn't # / space / ) ) and went unflagged.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md":
                    "[q](feature-mfa.md?v=2) and [s](feature-branding.md/)"},
            )
            unreachable, bad_links = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)
            self.assertIn("feature-branding.md", targets)

    def test_framework_slug_does_not_manufacture_phantom_tooling_route(self):
        # A framework slug must NOT expand onto the tooling-{tooling} template.
        # An orphaned tooling-<frameworkslug>.md must be reported unreachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "| Package | Framework |\n| `@auth0/auth0-react` | `react` |\n"
                "Read: references/framework-{framework}.md\n"
                "Read: references/tooling-{tooling}.md\n"
                "| Project | Load |\n| `default` | `tooling-cli.md` |\n",
                {"framework-react.md": "ok", "tooling-cli.md": "ok",
                 "tooling-react.md": "orphan named after a framework slug"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn("tooling-react.md", unreachable)
            self.assertNotIn("framework-react.md", unreachable)
            self.assertNotIn("tooling-cli.md", unreachable)

    def test_slash_list_slugs_both_route(self):
        # A slash-list value cell like `php` / `php-api` routes BOTH files.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "| PHP web app / PHP API | `php` / `php-api` |\n",
                {"framework-php.md": "ok", "framework-php-api.md": "ok"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertEqual(unreachable, [])

if __name__ == "__main__":
    unittest.main()
