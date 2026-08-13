# Migration-skill test harness for node-auth0 → auth0-auth-js / auth0-server-js
#
# Runs a scan → rewrite → verify → tsc → tests loop against a fixture app.
# The agent-driven rewrite step requires Claude API access + Auth0 creds at run time.

FROM node:20-slim

# Install bash, git (needed by verify-migration.sh), and grep (scan-usage.sh requirement)
RUN apt-get update && \
    apt-get install -y bash git grep && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the before-fixture app
COPY evals/behavioral/fixtures/node-auth0-migration/before/ /app/

# Install dependencies for the fixture app (includes auth0@^5 from its package.json)
RUN npm install

# Install the TARGET SDKs at their published versions (per-request options are in PR #230/#244, unreleased)
RUN npm install --save \
    @auth0/auth0-auth-js@1.12.0 \
    @auth0/auth0-server-js@1.10.0

# Copy the migration skill scripts
COPY plugins/auth0/skills/migrating-node-auth0-to-auth0-server-js/scripts/scan-usage.sh /skill-scripts/scan-usage.sh
COPY plugins/auth0/skills/migrating-node-auth0-to-auth0-server-js/scripts/verify-migration.sh /skill-scripts/verify-migration.sh

RUN chmod +x /skill-scripts/*.sh

# The complete evaluation loop (gated on PR #230/#244 release):
#   1. /skill-scripts/scan-usage.sh /app          — discover migration surface
#   2. <agent-rewrite-step>                       — requires Claude CLI + Auth0 creds (injected at run time)
#   3. /skill-scripts/verify-migration.sh /app    — flag residue
#   4. npx tsc --noEmit                           — type-check
#   5. npm test                                   — behavioral tests
#
# Default CMD runs the non-agent parts (scan, tsc, test):
CMD ["/bin/bash", "-c", "/skill-scripts/scan-usage.sh /app && npx tsc --noEmit && npm test"]
