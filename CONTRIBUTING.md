# Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md).

## How to Contribute

### Adding a New Skill

1. Create a new directory under `plugins/auth0/skills/`
2. Add a `SKILL.md` file following the [Agent Skills specification](https://agentskills.io/specification)
3. Optionally add additional reference files
4. Update the README.md to list your skill in the appropriate table
5. Submit a pull request

### Skill Structure

Per the Agent Skills specification, **only `SKILL.md` may live in the skill root**. All other content must go in one of these subdirectories:

```
plugins/auth0/skills/my-skill/
├── SKILL.md           # Required: Main skill file (the ONLY file allowed in root)
├── references/        # Optional: Additional documentation (kebab-case .md files)
│   ├── setup.md
│   ├── integration.md
│   └── api.md
├── scripts/           # Optional: Executable helper code
│   └── helper.js
├── assets/            # Optional: Static resources (templates, images, data files)
└── tests/             # Optional: Validation artifacts (test transcripts, fixtures)
```

Markdown files in subdirectories must be **kebab-case** (e.g. `route-protection.md`). Framework integration skills conventionally split their reference docs into `setup.md`, `integration.md`, and `api.md` — follow that naming so skills stay consistent.

### SKILL.md Requirements

Your `SKILL.md` must include:

1. **YAML Frontmatter** with the following fields. `name`, `description`, `license`, `metadata.author`, and the full `metadata.openclaw` block (with `emoji` and `homepage`) are **required and enforced by the linter** — a skill missing any of them will fail validation:

   ```yaml
   ---
   name: my-skill
   description: Brief description of what this skill does and when to use it.
   license: Apache-2.0
   metadata:
     author: Auth0 <support@auth0.com>   # required, must be "Name <email>" format
     version: '1.0.0'                      # recommended; most skills pin this
     openclaw:                             # required block
       emoji: "\U0001F510"
       homepage: https://github.com/auth0/agent-skills
       requires:                           # optional: declare external dependencies
         bins:
           - auth0                         # declare `auth0` if the skill runs CLI commands
       os:                                 # optional: darwin, linux, win32
         - darwin
         - linux
       install:                            # optional: how to install required bins
         - id: brew
           kind: brew
           formula: auth0/auth0-cli/auth0
           bins: [auth0]
           label: 'Install Auth0 CLI (brew)'
   ---
   ```

   Notes:
   - `license` must be `Apache-2.0` unless a specific package requires otherwise (matches the repository `LICENSE`).
   - `metadata.author` must follow `Name <email>`; separate multiple authors with commas, not semicolons.
   - The `requires`, `os`, and `install` fields under `metadata.openclaw` are [ClawHub](https://clawhub.ai) metadata used when installing the skill via `npx clawhub install`. If your skill's workflow invokes `auth0` CLI commands, declare `requires.bins: [auth0]` (and the matching `install` block) so ClawHub can prompt the user to install the CLI. Apply this consistently.

2. **Clear Instructions**: Step-by-step guidance for the AI agent

3. **Code Examples**: Working code samples for each SDK where applicable

4. **Error Handling**: Common errors and how to handle them

### Code Style

- Use TypeScript for examples where applicable
- Include comments explaining complex logic
- Follow Auth0's coding conventions
- Test code examples before submitting

### Updating Existing Skills

1. Fork the repository
2. Make your changes
3. Ensure all code examples are correct
4. Update version in metadata if significant changes
5. Submit a pull request with clear description of changes

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

   # Or copy to Claude skills directory
   cp -r ./plugins/auth0/skills/my-skill ~/.claude/skills/
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

## Adding a Capability to the Unified Skill

All Auth0 guidance ships in the single `auth0` skill
(`plugins/auth0/skills/auth0/`). See [docs/architecture.md](./docs/architecture.md)
for why. To add or change coverage:

### Pick the right reference prefix
- `feature-<name>.md` — a capability spanning frameworks (e.g. mfa, dpop).
- `framework-<name>.md` — a single SDK/framework integration.
- `tooling-<name>.md` — a provisioning tool (cli, mcp, terraform).
- `pattern-<name>.md` — cross-cutting guidance.

### Make it routable (required — CI enforces this)
Every reference in `references/` MUST be reachable from `SKILL.md`. Navigation is
a **depth-2 tree**: a reference is either a flat, self-contained `*.md` file (one
hop from the router) or a **group** (see "Adding a grouped reference" below). A
flat file and any leaf inside a group may contain **no** link to any `.md` file —
they are sinks; inline the content instead of linking. The only second hop
allowed is a group's hub `index.md` dispatching to leaves **in its own
directory**; cross-group links are forbidden. Claude Code follows the router to a
file (or to a hub, then one leaf) — nothing deeper is guaranteed.

- **New feature:** add an intent row in Step 1 and a load block in Step 4 of
  `SKILL.md`.
- **New framework:** add detection in **all three tiers** of Step 2 — Tier 1
  (Auth0 SDK package), Tier 2 (non-Auth0 workspace dependency), Tier 3 (prompt
  keyword) — and, if it has a web-vs-API split, a row in "Variant
  disambiguation." The reachability checker derives routable slugs directly from
  these router tables (the backticked value column), so simply naming your
  `<slug>` in a table makes `framework-<slug>.md` reachable — there is no
  separate list to update.

### Adding a grouped reference
When a reference grows large (roughly >40K), split it into a **group** so the
router pulls only the slice a task needs instead of the whole file. A group is a
directory named after the reference stem:

```
references/framework-<name>/
├── index.md          # hub: shared prerequisites + intent→leaf dispatch table
├── integrate.md      # document-section leaves (one per section, not per intent)
├── api-reference.md
├── patterns.md
├── setup.md
└── migration.md      # only if the SDK has a major-version migration
```

Rules:
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
- **Add a routing case** in `tests/routing-cases.json` with the two-hop
  `expect_refs` (`<stem>/index.md` + the intent leaf [+ tooling]), and move the
  slug from the flat presence list in `validate-skill.sh` to its grouped loop.

The router's per-intent `Read: references/framework-{framework}.md` token is
unchanged — a global note in Step 4 tells the agent to read `index.md` when the
target is a directory. The reachability and routing-eval checkers resolve a
grouped slug automatically; you don't edit `SKILL.md`'s routing tables.

### Validate
```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```
