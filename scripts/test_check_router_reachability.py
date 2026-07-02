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
                    "[tpl](../assets/acul/react-templates/login-id.tsx)"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertEqual(bad_links, [])

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
