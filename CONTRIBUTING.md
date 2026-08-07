# Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md).

## How to Contribute

### Add or edit Auth0 guidance

This repository ships one consolidated `auth0` skill. **Do not add a separate
skill directory** under `plugins/auth0/skills/`. Add a reference to
`plugins/auth0/skills/auth0/references/` and wire it into the router instead.
See [Architecture](./docs/architecture.md) for the model.

When working in Claude Code, invoke the
[`author-auth0-skill`](./.claude/skills/author-auth0-skill/SKILL.md)
contributor skill before changing Auth0 guidance. It classifies the change
(framework, feature, tooling, pattern, or existing reference), identifies the
exact router and eval changes, and lists the validation gate. For example:

```
/author-auth0-skill Add support for <framework or capability>
```

The detailed, authoritative requirements are in [Adding a Capability to the
Unified Skill](#adding-a-capability-to-the-unified-skill) below. Contributors
working without Claude Code should follow that section directly.

### Editing the unified skill

1. Fork the repository and make your change in `plugins/auth0/skills/auth0/`.
2. Keep every reference reachable from the router and follow the depth-3 tree
   rules below.
3. Ensure examples are correct and test them where practical.
4. Update `plugins/auth0/README.md` when the change adds visible coverage.
5. Run the validation commands before opening a pull request.

### Code style

- Use TypeScript for examples where applicable.
- Include comments that clarify non-obvious logic.
- Follow Auth0 coding conventions.
- Test code examples before submitting.

## Adding a Capability to the Unified Skill

All Auth0 guidance ships in the single `auth0` skill
(`plugins/auth0/skills/auth0/`). See [docs/architecture.md](./docs/architecture.md)
for why. To add or change coverage:

### Pick the right reference prefix
Every reference is a directory `<name>/` with an `index.md` (see "Adding a
reference"); pick the prefix that fits:
- `feature-<name>/` — a capability spanning frameworks (e.g. mfa, dpop).
- `framework-<name>/` — a single SDK/framework integration.
- `tooling-<name>/` — a provisioning tool (cli, mcp, terraform).
- `pattern-<name>/` — cross-cutting guidance.

### Make it routable (required — CI enforces this)
Every reference in `references/` MUST be reachable from `SKILL.md`. Navigation is
a **depth-3 tree**: every reference is a directory `<name>/` with an `index.md`.
An **index-only** reference puts its whole content in `index.md` and has no
leaves (one hop from the router). A large reference is a **leaf group** whose
`index.md` is a hub plus document-section leaves (see "Adding a reference" below).
An index-only `index.md` and any leaf inside a leaf group may contain **no** link
to any `.md` file — they are sinks; inline the content instead of linking. The
only second hop allowed is a leaf-group hub `index.md` dispatching to leaves **in
its own directory**; cross-group links are forbidden. Claude Code follows the
router to `index.md` (and, for a leaf group, on to one leaf) — nothing deeper is
guaranteed.

- **New feature:** add an intent row in Step 1 and a load block in Step 4 of
  `SKILL.md`.
- **New framework:** add detection in **all three tiers** of Step 2 — Tier 1
  (Auth0 SDK package), Tier 2 (non-Auth0 workspace dependency), Tier 3 (prompt
  keyword) — and, if it has a web-vs-API split, a row in "Variant
  disambiguation." The reachability checker derives routable slugs directly from
  these router tables (the backticked value column), so simply naming your
  `<slug>` in a table makes `framework-<slug>/index.md` reachable — there is no
  separate list to update.

### Adding a reference
Every reference is a directory named after its stem, containing an `index.md`.
Adding a new reference means creating `references/<name>/index.md`. Start
index-only — the whole reference lives in `index.md` — and only split it into a
**leaf group** once it grows large (roughly >1000 lines) so the router pulls just
the slice a task needs instead of the whole file:

```
references/framework-<name>/
├── index.md          # hub: shared prerequisites + intent→leaf dispatch table
├── integrate.md      # document-section leaves (one per section, not per intent)
├── api-reference.md
├── patterns.md
├── setup.md
└── migration.md      # only if the SDK has a major-version migration
```

Rules for splitting a large reference into a leaf group:
- **Leaves are document sections**, not intents (`integrate`, `api-reference`,
  `patterns`, `setup`, `migration`, …). Feature references split by sub-topic
  (`guide`, `api-reference`, `advanced`, `examples`).
- **`index.md` is a lean hub:** shared setup every leaf needs, then a dispatch
  table with one row per router intent, each an imperative
  `` `Read: references/<stem>/<leaf>.md` `` pointing at that intent's primary
  leaf. Intent strings must match Step 1 **exactly** (`feature:mfa`, not `mfa`).
  A "Then, as needed" list of `Read:` bullets makes the secondary leaves
  reachable. Every leaf must appear in at least one `Read:` line or it's an
  orphan.
- **Lossless + self-contained:** every line of the original file lands in exactly
  one destination; leaves repeat any shared context inline rather than linking to
  the hub or each other. If two sections cross-reference too heavily to separate,
  merge them into one leaf rather than add a link.
- **Add a routing case** in `evals/routing-cases.json` with the two-hop
  `expect_refs` (`<name>/index.md` + the intent leaf [+ tooling]), and move the
  slug from the index-only presence check in `validate-skill.sh` to its grouped
  loop. For an index-only reference, the presence check is simply
  `<name>/index.md`.

The router always emits `Read: references/{framework}/index.md` (or
`{feature}` / `{tooling}`) regardless of whether the target is index-only or a
leaf group — a global note in Step 4 tells the agent to follow the `index.md`'s
dispatch table to a leaf if it has one. The reachability and routing-eval
checkers resolve a leaf-group slug automatically; you don't edit `SKILL.md`'s
routing tables.

### Validate
```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

## Local Development

### Validating Skills

This repository uses [skillsaw](https://github.com/stbenjam/skillsaw) to enforce frontmatter and structure conventions. The same check runs in CI (`.github/workflows/skillsaw.yml`) and **must pass before a PR can merge**, so run it locally first:

```bash
# Validate the whole repository in strict mode (matches CI)
uvx skillsaw --strict
```

Rules are configured in [`.skillsaw.yaml`](./.skillsaw.yaml), with repository-specific custom rules in [`.skillsaw/rules.py`](./.skillsaw/rules.py).

### Testing with AI Assistants

Test your skills work correctly with AI assistants:

1. Install the plugin/skill locally:

   ```bash
   # Install entire plugin
   npx skills add ./plugins/auth0

   # Or copy the unified skill to Claude's local skills directory
   mkdir -p ~/.claude/skills
   cp -r ./plugins/auth0/skills/auth0 ~/.claude/skills/
   ```

2. Ask an AI assistant to use the skill
3. Verify the generated code is correct

## Pull Request Process

1. Ensure your changes follow the contribution guidelines
2. Update documentation as needed
3. Add your changes to CHANGELOG.md (if applicable)
4. Request review from maintainers
5. Address any feedback

## Code of Conduct

Please follow [Auth0's Code of Conduct](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md).

## Questions?

If you have questions about contributing, please [open an issue](https://github.com/auth0/agent-skills/issues/new) with the "question" label.
