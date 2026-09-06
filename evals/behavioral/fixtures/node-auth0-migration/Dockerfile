# Migration-skill test harness for node-auth0 → auth0-auth-js / auth0-server-js
#
# Runs a scan → rewrite → verify → tsc → tests loop against a fixture app.
# The agent-driven rewrite step requires Claude API access + Auth0 creds at run time.

FROM node:20-slim

# Install bash, git (needed by run-loop.sh's preflight stash), and grep (scan-usage.sh requirement)
RUN apt-get update && \
    apt-get install -y bash git grep && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# SDK_SOURCE selects where the target SDKs come from:
#   local     — install from npm-pack tarballs staged under vendor/ (the shipped, unreleased 1.12.1 API)
#   published — install the pinned published versions from the npm registry (CI fallback once a release cuts)
ARG SDK_SOURCE=local

# Copy the before-fixture app
COPY evals/behavioral/fixtures/node-auth0-migration/before/ /app/

# Copy the local SDK tarballs (used only when SDK_SOURCE=local; harmless otherwise)
COPY evals/behavioral/fixtures/node-auth0-migration/vendor/ /app/vendor/

# Install dependencies for the fixture app (includes auth0@^6 from its package.json)
RUN npm install

# Install the TARGET SDKs.
#   local:     install server-js from its tarball; the `overrides` map in before/package.json
#              pins @auth0/auth0-auth-js to the vendored auth-js tarball so the peer resolves
#              to the local build, not the registry.
#   published: install the pinned published versions (flip back once 1.12.1 is on npm).
RUN if [ "$SDK_SOURCE" = "local" ]; then \
      npm install --save ./vendor/auth0-auth0-server-js-1.12.1.tgz; \
    else \
      npm install --save @auth0/auth0-auth-js@1.12.1 @auth0/auth0-server-js@1.12.1; \
    fi

# Copy the harness oracle scripts + the whole plugin (so the agent step can load it).
# scan-usage.sh / verify-migration.sh are the harness's deterministic scan/verify oracle;
# they live in this fixture dir (not in the skill) — the shipped skill inlines the same
# commands into references/framework-node-auth0/migration.md.
COPY evals/behavioral/fixtures/node-auth0-migration/scan-usage.sh /skill-scripts/scan-usage.sh
COPY evals/behavioral/fixtures/node-auth0-migration/verify-migration.sh /skill-scripts/verify-migration.sh
COPY evals/behavioral/fixtures/node-auth0-migration/agent-rewrite.sh /skill-scripts/agent-rewrite.sh
COPY evals/behavioral/fixtures/node-auth0-migration/run-loop.sh /skill-scripts/run-loop.sh
COPY plugins/auth0/ /skill/plugins/auth0/

RUN chmod +x /skill-scripts/*.sh

# The complete evaluation loop:
#   1. /skill-scripts/scan-usage.sh /app          — discover migration surface
#   2. <agent-rewrite-step>                       — requires Claude CLI + Auth0 creds (injected at run time)
#   3. /skill-scripts/verify-migration.sh /app    — flag residue
#   4. npx tsc --noEmit                           — type-check
#   5. npm test                                   — behavioral tests
#
# Default CMD runs the non-agent parts (scan, tsc, test):
CMD ["/bin/bash", "-c", "/skill-scripts/scan-usage.sh /app && npx tsc --noEmit && npm test"]
