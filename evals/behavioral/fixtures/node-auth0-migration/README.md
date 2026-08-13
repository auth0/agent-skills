# node-auth0 Migration Test Harness

A containerized evaluation environment for the `migrating-node-auth0-to-auth0-server-js` skill. Runs an end-to-end migration workflow: scan → agent-driven rewrite → verify → type-check → tests.

## What it does

1. **Installs the source and target SDKs** at published versions:
   - `auth0@^5` (node-auth0 v5, the migration source)
   - `@auth0/auth0-auth-js@1.12.0` (auth0-auth-js)
   - `@auth0/auth0-server-js@1.10.0` (auth0-server-js)

2. **Copies the before-fixture app** (`before/`) into `/app` and installs its dependencies during build.

3. **Includes the skill's verification scripts** (`scan-usage.sh` and `verify-migration.sh`) at `/skill-scripts/`.

4. **Runs a validation loop** (by default: scan → tsc → tests; the full loop including agent-rewrite and the auth0-server-js eval cases is gated on release).

## Version pins and why

The test harness uses **published versions** of auth0-auth-js (1.12.0) and auth0-server-js (1.10.0) because:

- **Per-request options** (signal, headers, customFetch) are not yet released. They are in PRs #230 (auth0-auth-js) and #244 (auth0-server-js).
- The before-fixture app and the live agent-driven rewrite will test these unreleased features once the PRs are merged and published.
- Until then, the test harness validates the core migration patterns using the latest stable releases.

The auth0-server-js eval cases (which require per-request options) are also gated on the #230/#244 release.

## How to build

From the **repository root** (build context must include both the fixture and skill scripts):

```bash
docker build -f evals/behavioral/fixtures/node-auth0-migration/Dockerfile \
  -t node-auth0-migration-harness .
```

## How to run

**Default mode** (scan + tsc + tests, no agent):

```bash
docker run --rm node-auth0-migration-harness
```

**Full migration loop** (requires Claude API key + Auth0 credentials):

```bash
docker run --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e AUTH0_DOMAIN="your-tenant.auth0.com" \
  -e AUTH0_CLIENT_ID="..." \
  -e AUTH0_CLIENT_SECRET="..." \
  node-auth0-migration-harness \
  /bin/bash -c "
    /skill-scripts/scan-usage.sh /app && \
    <insert-agent-rewrite-invocation-here> && \
    /skill-scripts/verify-migration.sh /app && \
    npx tsc --noEmit && \
    npm test
  "
```

The agent-rewrite step (step 2 in the loop) is not yet scripted; it requires invoking the Claude CLI or SDK with the migration skill context.

## What's gated

- **Agent-driven rewrite**: Requires Claude API access and Auth0 credentials (not baked into the container).
- **auth0-server-js eval cases**: Require per-request options from PRs #230 and #244 (unreleased).

Once those PRs are merged and published, update the version pins in the Dockerfile and uncomment the full loop in the CMD.
