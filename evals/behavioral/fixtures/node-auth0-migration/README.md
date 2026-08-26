# node-auth0 Migration Test Harness

A containerized evaluation environment for the `migrating-node-auth0-to-auth0-server-js` skill. It
runs an end-to-end migration workflow: scan → (optional agent-driven rewrite) → verify → type-check
→ tests, against the **shipped** auth0-auth-js / auth0-server-js 1.12.1 API.

## Layout

```text
node-auth0-migration/
├── Dockerfile          # build the harness image (SDK_SOURCE=local|published)
├── run-loop.sh         # build-until-green orchestrator (scan → agent → tsc → test → verify)
├── before/             # node-auth0 v5 fixture app (the migration SOURCE, tsc-clean)
│   └── src/*.ts        # 7 files: each exercises a migration trap
├── after/              # hand-authored REFERENCE migration (the Tier-2 target)
│   └── src/*.ts        # compiles against @auth0/auth0-auth-js 1.12.1; passes verify-migration.sh
└── vendor/             # local npm-pack tarballs of the shipped-but-unreleased SDKs
    ├── auth0-auth0-auth-js-1.12.1.tgz
    └── auth0-auth0-server-js-1.12.1.tgz
```

## SDKs and where they come from

`@auth0/auth0-auth-js@1.12.1` and `@auth0/auth0-server-js@1.12.1` are published on npm, but the
per-request `RequestOptions` + `fullResponse` envelope surface this harness exercises landed **after**
that release and is not in the published tarball yet. The harness therefore defaults to installing from
local tarballs so it can test the real shipped surface without waiting on the next release.

- `auth0@^5` — the migration source (node-auth0 v5), from the public registry.
- `@auth0/auth0-auth-js@1.12.1` / `@auth0/auth0-server-js@1.12.1` — the migration targets.

`SDK_SOURCE` (Docker build ARG) selects the target install path:

- `local` (default) — installs the server-js tarball from `vendor/`. `before/package.json` and
  `after/package.json` carry an `overrides` map pinning `@auth0/auth0-auth-js` to the vendored
  auth-js tarball, so server-js's peer resolves to the local build, not the registry.
- `published` — installs the pinned published versions. Flip to this once the per-request surface ships in a public release.

### Refreshing the tarballs

Run from the SDK checkout (`auth0-auth-js`) after any SDK change:

```bash
npm run build
npm pack --pack-destination <this-dir>/vendor  # in packages/auth0-auth-js
npm pack --pack-destination <this-dir>/vendor  # in packages/auth0-server-js
```

## Tiers

- **Tier 1 — behavioral evals** (`../../run-evals.mjs node-auth0-migration`): grades the *text* an
  agent generates. No SDK install. Fast signal loop.
- **Tier 2 — this harness**: proves generated/reference code **compiles and passes the residue
  scan** against the shipped 1.12.1 API. The `after/` directory is the reference migration; it
  compiles clean under `tsc --noEmit` against the vendored auth-js and passes `verify-migration.sh`.
- **Tier 2b — agent-driven rewrite**: gated on `MIGRATION_AGENT_CMD` (see below). Once the harness is
  green on `after/`, wire an agent to reproduce the migration from `before/` and re-run the loop.

## How to build

From the **repository root** (build context must include both the fixture and the skill scripts):

```bash
docker build -f evals/behavioral/fixtures/node-auth0-migration/Dockerfile \
  -t node-auth0-migration-harness .
# published-registry variant (post-release):
#   --build-arg SDK_SOURCE=published
```

## How to run

**Default mode** (scan + tsc + tests, no agent):

```bash
docker run --rm node-auth0-migration-harness
```

**Agent-driven loop (Tier 2b)** — set `MIGRATION_AGENT_CMD` to a concrete invocation that loads the
skill and rewrites the app in `/app`. `run-loop.sh` runs the agent, then type-checks, tests, and
enforces the residue scan:

```bash
docker run --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e MIGRATION_AGENT_CMD='claude -p "Migrate this node-auth0 app to @auth0/auth0-auth-js using the migration skill" --append-system-prompt "$(cat /skill/SKILL.md)"' \
  node-auth0-migration-harness \
  bash /skill-scripts/run-loop.sh /app
```

(The exact CLI flags depend on how the skill is mounted; Tier 2b is tracked separately from the
tarball-plumbing green bar.)

## What's gated

- **Agent-driven rewrite (Tier 2b)**: requires Claude access; not baked into the image.
- **Live e2e (Tier 3)**: needs a bootable app + a real Auth0 tenant; tracked in a separate design doc.

Once 1.12.1 is published to npm, build with `--build-arg SDK_SOURCE=published` and drop the reliance
on `vendor/`.
