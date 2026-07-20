import tempfile, unittest
from pathlib import Path
from check_router_reachability import check_router

class ReachabilityTest(unittest.TestCase):
    def test_orphan_file_is_unreachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}},
                 "framework-php-api": {"index": "orphan", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-php-api/index.md", unreachable)
            self.assertEqual(bad_links, [])

    def test_template_expansion_reaches_files(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| a | `react` |\n| b | `php-api` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}},
                 "framework-php-api": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(unreachable, [])

    def test_reference_linking_existing_reference_is_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {"index": "see [x](feature-mfa.md)", "leaves": {}},
                 "feature-mfa": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-react/index.md", "feature-mfa.md"), bad_links)

    def test_reference_linking_nonexistent_md_is_flagged(self):
        # Dead cross-refs (target does not exist) must ALSO be caught.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index": "see [setup](setup.md) and [api](react-api.md)",
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-react/index.md", "setup.md"), bad_links)
            self.assertIn(("framework-react/index.md", "react-api.md"), bad_links)

    def test_external_and_asset_links_not_flagged(self):
        # https:// links and non-.md asset paths are fine.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        "[docs](https://auth0.com/docs/x.md) "
                        "[docs2](https://auth0.com/docs/y.md#anchor) "
                        "[tpl](../assets/acul/react-templates/login-id.tsx)",
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(bad_links, [])

    def test_path_prefixed_md_links_are_flagged(self):
        # Links with ./ ../ or references/ prefixes (and links to ../SKILL.md)
        # must ALL be flagged — the one-hop rule forbids any .md link.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        "[a](./references/setup.md) "
                        "[b](../SKILL.md) "
                        "[c](react-integration.md#protected-routes)",
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
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
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        "[ref]: feature-mfa.md\n"
                        "[titled](feature-branding.md \"Branding\")\n"
                        "[angle](<feature-dpop.md>)\n"
                        "see <feature-organizations.md> too\n"
                        "external autolink <https://auth0.com/x.md> is fine",
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)        # reference-style
            self.assertIn("feature-branding.md", targets)   # titled inline
            self.assertIn("feature-dpop.md", targets)       # inline <>
            self.assertIn("feature-organizations.md", targets)  # autolink
            # The external https autolink must NOT be flagged.
            self.assertNotIn("https://auth0.com/x.md", targets)

    def test_template_slug_universe_comes_from_router_not_hardcode(self):
        # A framework group whose slug the router NEVER mentions must be flagged
        # unreachable — even though it matches the framework-*  shape.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                # Router mentions only `react`; template read for {framework}.
                "Read: references/framework-{framework}/index.md\n"
                "| `@auth0/auth0-react` | `react` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}},
                 "framework-php-api": {"index": "orphan", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-php-api/index.md", unreachable)
            self.assertNotIn("framework-react/index.md", unreachable)

    def test_backticked_bare_md_target_is_reachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "| `terraform/` dir | `tooling-terraform.md` |\n",
                {},
                {"tooling-terraform": {"index": "ok", "leaves": {}},
                 "tooling-orphan": {"index": "orphan", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertNotIn("tooling-terraform/index.md", unreachable)
            self.assertIn("tooling-orphan/index.md", unreachable)

    def test_left_column_dependency_name_is_not_a_routable_slug(self):
        # A dependency name in the left (detection) column must NOT make a
        # same-named framework group reachable — only value-column slugs route.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `authlib` or `python-jose` + `flask` | `flask` |\n",
                {},
                {"framework-flask": {"index": "ok", "leaves": {}},
                 "framework-authlib": {"index": "orphan", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertNotIn("framework-flask/index.md", unreachable)  # value-col slug
            self.assertIn("framework-authlib/index.md", unreachable)   # left-col dep

    def test_lone_backtick_left_column_dependency_is_not_routable(self):
        # A left-column dependency name that is a LONE backticked token followed
        # by the `|` cell separator (the exact shape the old lookahead-based
        # SLUG_RE leaked) must NOT make a same-named framework group reachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `express-oauth2-jwt-bearer` | `express-jwt` |\n",
                {},
                {
                    "framework-express-jwt": {"index": "ok", "leaves": {}},
                    "framework-express-oauth2-jwt-bearer": {"index": "orphan", "leaves": {}},
                },
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertNotIn("framework-express-jwt/index.md", unreachable)  # value slug
            self.assertIn(
                "framework-express-oauth2-jwt-bearer/index.md", unreachable
            )  # lone left-col dep — must be an orphan

    def test_left_column_slug_in_prose_cell_is_not_routable(self):
        # `next` appears in the left detection cell ("Next.js / `next`"); the
        # value column slug is `nextjs`. framework-nextjs is reachable but a
        # framework-next typo must be reported as an orphan.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| Next.js / `next` | `nextjs` |\n",
                {},
                {"framework-nextjs": {"index": "ok", "leaves": {}},
                 "framework-next": {"index": "orphan", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertNotIn("framework-nextjs/index.md", unreachable)  # value slug
            self.assertIn("framework-next/index.md", unreachable)  # left-col typo orphan

    def test_html_anchor_md_link_is_flagged(self):
        # An <a href="x.md"> HTML link is an intra-references .md link too and
        # must be caught — the autolink regex can't match it (space after <a).
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        '<a href="feature-mfa.md">mfa</a> '
                        "<a href='./feature-branding.md#logo'>brand</a> "
                        '<a href="https://auth0.com/x.md">external ok</a>',
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)
            self.assertIn("./feature-branding.md", targets)
            self.assertNotIn("https://auth0.com/x.md", targets)

    def test_query_and_trailing_slash_md_links_are_flagged(self):
        # `x.md?query` and `x.md/` targets previously slipped past the inline
        # regex (the char after .md wasn't # / space / ) ) and went unflagged.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        "[q](feature-mfa.md?v=2) and [s](feature-branding.md/)",
                    "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            targets = {t for _, t in bad_links}
            self.assertIn("feature-mfa.md", targets)
            self.assertIn("feature-branding.md", targets)

    def test_framework_slug_does_not_manufacture_phantom_tooling_route(self):
        # A framework slug must NOT expand onto the tooling-{tooling} template.
        # An orphaned tooling-<frameworkslug> group must be reported unreachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "| Package | Framework |\n| `@auth0/auth0-react` | `react` |\n"
                "Read: references/framework-{framework}/index.md\n"
                "Read: references/tooling-{tooling}/index.md\n"
                "| Project | Load |\n| `default` | `tooling-cli.md` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}},
                 "tooling-cli": {"index": "ok", "leaves": {}},
                 "tooling-react": {"index": "orphan named after a framework slug", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("tooling-react/index.md", unreachable)
            self.assertNotIn("framework-react/index.md", unreachable)
            self.assertNotIn("tooling-cli/index.md", unreachable)

    def test_slash_list_slugs_both_route(self):
        # A slash-list value cell like `php` / `php-api` routes BOTH groups.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| PHP web app / PHP API | `php` / `php-api` |\n",
                {},
                {"framework-php": {"index": "ok", "leaves": {}},
                 "framework-php-api": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(unreachable, [])

    def test_broken_route_points_at_missing_file(self):
        # SKILL.md routes to a framework whose directory is absent — `present -
        # routed` can't catch this; the reverse `routed - present` check must.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `@auth0/auth0-react` | `react` |\n"
                "| Swift / iOS | `swift` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}}},  # framework-swift/ deliberately absent
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/index.md", broken_routes)
            self.assertEqual(unreachable, [])

    def test_variant_base_slug_is_not_a_broken_route(self):
        # A `(variant below)` base like `aspnetcore` has no framework-aspnetcore
        # group by design (it resolves to -auth/-api). It must NOT be a broken
        # route, while its terminal variants still are checked.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `*.csproj` ASP.NET | `aspnetcore` (variant below) |\n"
                "| ASP.NET web app / API | `aspnetcore-auth` / `aspnetcore-api` |\n",
                {},
                {"framework-aspnetcore-auth": {"index": "ok", "leaves": {}},
                 "framework-aspnetcore-api": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(broken_routes, [])  # aspnetcore base is exempt

    def test_variant_terminal_missing_file_is_still_a_broken_route(self):
        # The exemption is ONLY for the annotated base — a missing terminal
        # variant group must still be reported.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `*.csproj` ASP.NET | `aspnetcore` (variant below) |\n"
                "| ASP.NET web app / API | `aspnetcore-auth` / `aspnetcore-api` |\n",
                {},
                {"framework-aspnetcore-auth": {"index": "ok", "leaves": {}}},  # -api deliberately absent
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-aspnetcore-api/index.md", broken_routes)

    def test_no_broken_route_when_all_routed_files_exist(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n"
                "| `@auth0/auth0-react` | `react` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(broken_routes, [])

    def test_prose_references_path_is_flagged_as_second_hop(self):
        # A reference naming another reference by prose/backtick path (not a
        # markdown link) still invites a second hop and must be flagged.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index": "For B2B, see `references/pattern-multi-tenant.md` — router loads both.",
                    "leaves": {}},
                 "pattern-multi-tenant": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-react/index.md", "pattern-multi-tenant.md"), bad_links)

    def test_backticked_bare_filename_is_flagged_as_second_hop(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index": "delegate to `capability-voice.md` after apply",
                    "leaves": {}},
                 "feature-branding": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-react/index.md", "capability-voice.md"), bad_links)

    def test_read_verb_second_hop_is_flagged(self):
        # The router's OWN dispatch verb, appearing in a reference body, is the
        # most dangerous second-hop form — an agent would plausibly follow it.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index": "Read: references/feature-mfa.md for MFA setup.",
                    "leaves": {}},
                 "feature-mfa": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-react/index.md", "feature-mfa.md"), bad_links)

    def test_second_hop_forms_inside_code_fence_are_not_flagged(self):
        # Non-link second-hop forms inside a ``` fence are illustrative, not live
        # instructions, so they must NOT be flagged.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-react/index.md\n",
                {},
                {"framework-react": {
                    "index":
                        "Example of what the router does:\n"
                        "```\nRead: references/feature-mfa.md\n"
                        "see `pattern-security.md`\n```\n",
                    "leaves": {}},
                 "feature-mfa": {"index": "ok", "leaves": {}},
                 "pattern-security": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(bad_links, [])

    # ---- group (two-level) support -------------------------------------

    def _make_group_skill(self, root, skill_md, flat_refs, groups):
        # groups: {group_name: {"index": str, "leaves": {leaf_name: body}}}
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "SKILL.md").write_text(skill_md)
        for name, body in flat_refs.items():
            (skill / "references" / name).write_text(body)
        for gname, spec in groups.items():
            gdir = skill / "references" / gname
            gdir.mkdir()
            if spec.get("index") is not None:
                (gdir / "index.md").write_text(spec["index"])
            for leaf, body in spec.get("leaves", {}).items():
                (gdir / leaf).write_text(body)
        return skill

    def test_group_valid_dispatch_all_reachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": ("# Swift hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"),
                    "leaves": {"integrate.md": "ok", "migration.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(unreachable, [])
            self.assertEqual(bad_links, [])
            self.assertEqual(broken_routes, [])

    def test_group_orphan_leaf_is_unreachable(self):
        # A leaf the hub never dispatches to is an orphan.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok", "mfa.md": "orphan"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/mfa.md", unreachable)

    def test_group_hub_dispatch_to_missing_leaf_is_broken_route(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": ("# hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"),
                    "leaves": {"integrate.md": "ok"}}},  # migration.md absent
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/migration.md", broken_routes)

    def test_group_not_routed_from_skill_is_unreachable(self):
        # SKILL.md never routes to the base name -> whole group unreachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| React | `react` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}},
                 "framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/index.md", unreachable)

    def test_group_missing_index_is_broken_route(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {"index": None, "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/index.md", broken_routes)

    def test_hub_own_group_dispatch_not_flagged_as_sideways(self):
        # The hub Read:-dispatching to its OWN leaf is the allowed relaxation.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(bad_links, [])

    def test_hub_cross_group_link_is_flagged(self):
        # A hub linking to ANOTHER group's leaf is forbidden.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n| Android | `android` |\n",
                {},
                {"framework-swift": {
                    "index": ("# hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "cross: `Read: references/framework-android/integrate.md`\n"),
                    "leaves": {"integrate.md": "ok"}},
                 "framework-android": {
                    "index": "# hub\n| integrate | `Read: references/framework-android/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-swift/index.md", "framework-android/integrate.md"),
                          bad_links)

    def test_leaf_linking_to_its_own_index_is_flagged(self):
        # Leaves are sinks — even a back-link to their own hub is forbidden.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "back to `references/framework-swift/index.md`"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-swift/integrate.md", "framework-swift/index.md"),
                          bad_links)

    def test_stray_flat_file_is_a_failure(self):
        # The uniform model forbids any flat references/*.md; one present must fail.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| React | `react` |\n",
                {"framework-legacy.md": "should not exist as a flat file"},
                {"framework-react": {"index": "# react\ncontent", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("STRAY:framework-legacy.md", unreachable)

    def test_index_route_reaches_index_only_group(self):
        # Uniform model: an index-only group (index.md, no leaves) routed via
        # references/<name>/index.md is reachable with no orphans/broken routes.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| React | `react` |\n",
                {},
                {"framework-react": {"index": "# react\nwhole content here", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual((unreachable, bad_links, broken_routes), ([], [], []))

    def test_all_index_only_groups_pass(self):
        # Every reference is an index-only group (no flat refs, no leaves).
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}/index.md\n| React | `react` |\n",
                {},
                {"framework-react": {"index": "ok", "leaves": {}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual((unreachable, bad_links, broken_routes), ([], [], []))

if __name__ == "__main__":
    unittest.main()
