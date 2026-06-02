# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this repo is

A collection of **Agent Skills** that teach coding assistants how to implement
Auth0 authentication correctly. Everything ships as a single Claude Code /
Cursor / Copilot plugin (`auth0`) whose skills live in
`plugins/auth0/skills/`. The deliverable is the skills themselves.

## Repository layout

```
plugins/auth0/skills/<skill-name>/
├── SKILL.md            # Required: the skill (only file allowed in skill root)
├── references/         # Optional: supporting docs (kebab-case .md files)
├── scripts/            # Optional: executable helpers
├── assets/             # Optional: static resources (templates, data)
└── tests/              # Optional: validation artifacts
```

Key top-level docs:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — **authoritative** rules for adding or
  editing a skill: required frontmatter, directory structure, naming, and the
  validation command. Read this before changing any skill.
- [`PLUGIN.md`](./PLUGIN.md) — plugin/marketplace architecture.
- [`README.md`](./README.md) — user-facing install and skill catalog.

## Before you change a skill

1. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md). The conventions there are
   enforced and not optional.
2. Match the patterns of neighboring skills rather than inventing new structure.
   The reference-file convention (`setup.md` / `integration.md` / `api.md`) and
   the shared section layout exist on purpose — keep them consistent.

## Required SKILL.md frontmatter

These fields are **enforced by the linter** — a skill missing any of them fails
CI:

- `name`, `description`
- `license` (use `Apache-2.0` to match the repository `LICENSE` unless a
  specific package requires otherwise)
- `metadata.author` in `Name <email>` format
- `metadata.openclaw.emoji` and `metadata.openclaw.homepage`

The `requires`, `os`, and `install` fields under `metadata.openclaw` are
[ClawHub](https://clawhub.ai) metadata used when a skill is installed via
`npx clawhub install`. If a skill's workflow invokes `auth0` CLI commands,
declare `requires.bins: [auth0]` (and the matching `install` block) so ClawHub
can prompt the user to install the CLI. See `CONTRIBUTING.md` for the full
example.

## Validating your changes

This repo uses [skillsaw](https://github.com/stbenjam/skillsaw) for validation;
the same check runs in CI (`.github/workflows/skillsaw.yml`) and must pass
before merge. Run it locally first:

```bash
uvx skillsaw --strict
```

Rules live in [`.skillsaw.yaml`](./.skillsaw.yaml) and
[`.skillsaw/rules.py`](./.skillsaw/rules.py).

## Conventions for agents

- When you add a skill, also document it in the plugin `README.md`
  (`plugins/auth0/README.md`); the linter enforces this.
- Keep documentation single-sourced. `CONTRIBUTING.md` is the source of truth
  for contribution rules — link to it instead of restating its details.
