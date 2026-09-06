#!/usr/bin/env bash
# agent-rewrite.sh — the concrete MIGRATION_AGENT_CMD for run-loop.sh stage 2.
#
# Drives the auth0 skill's migrate-node-auth0 reference workflow over the app in the
# current working directory (run-loop.sh cd's into APP_DIR before eval'ing this),
# rewriting node-auth0 usage in place to @auth0/auth0-auth-js / auth0-server-js.
#
# Requirements at run time:
#   - `claude` CLI on PATH, authenticated (ANTHROPIC_API_KEY or logged-in session)
#   - the agent-skills repo mounted so the plugin dir resolves
#
# Env knobs:
#   PLUGIN_DIR   path to plugins/auth0 (default: derived for the container layout /skill/plugins/auth0)
#   SKILL_DIR    path to the auth0 skill (for --add-dir references access)
#   AGENT_MODEL  optional model id passed to --model
#
# Usage (local):
#   MIGRATION_AGENT_CMD='bash /path/to/agent-rewrite.sh' \
#   APP_DIR=.../before SKILL_SCRIPTS=.../scripts \
#   bash run-loop.sh
#
# Usage (container): the Dockerfile copies this to /skill-scripts and sets
#   MIGRATION_AGENT_CMD='bash /skill-scripts/agent-rewrite.sh'.

set -uo pipefail

PLUGIN_DIR="${PLUGIN_DIR:-/skill/plugins/auth0}"
SKILL_DIR="${SKILL_DIR:-$PLUGIN_DIR/skills/auth0}"
AGENT_MODEL="${AGENT_MODEL:-}"

PROMPT='Migrate this Node.js/Express app off the node-auth0 (auth0@5) SDK to the modern Auth0 SDKs
using the auth0 skill (migrate-node-auth0 intent). Rewrite the source files IN PLACE.

Rules:
- AuthenticationClient / oauth.* / passwordless.* usage -> @auth0/auth0-auth-js (AuthClient) or,
  for redirect-login + session apps, @auth0/auth0-server-js (ServerClient). Follow the skill router.
- ManagementClient stays on the auth0 package (out of scope, do not touch).
- Apply the four cross-cutting rewrites (return shape, casing, absolute expiresAt, typed errors).
- Where the app reads HTTP response metadata on a success path, use the opt-in fullResponse envelope.
- After editing, the code must pass: tsc --noEmit, npm test, and the skill verify-migration.sh scan.
Edit the files directly; do not print a diff and stop.'

ARGS=(
  -p "$PROMPT"
  --permission-mode dontAsk
  --no-session-persistence
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep"
  --plugin-dir "$PLUGIN_DIR"
  --add-dir "$SKILL_DIR"
)
[ -n "$AGENT_MODEL" ] && ARGS+=(--model "$AGENT_MODEL")

echo "agent-rewrite: invoking claude in $(pwd)"
claude "${ARGS[@]}"
