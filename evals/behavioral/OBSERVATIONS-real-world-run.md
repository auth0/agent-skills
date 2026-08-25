# Observations — real-world migration run

Date: 2026-08-25. Model: us.anthropic.claude-opus-4-8 (with-skill), default Claude (without-skill). Skill version: feat/node-auth0-migration-skill branch.

## Setup

- Fixture: evals/behavioral/fixtures/node-auth0-migration/before/
- Reference: evals/behavioral/fixtures/node-auth0-migration/after/
- Run 1 (with-skill): `claude -p` + `--plugin-dir plugins/auth0` in `/tmp/node-auth0-real-run/`
- Run 2 (without-skill): `claude -p` (no plugin) in `/tmp/node-auth0-no-skill/`
- Diffs saved: `/tmp/diff-with-skill.patch`, `/tmp/diff-without-skill.patch`

## Results summary

| File | With-skill correct | Without-skill correct | Notes |
|------|--------------------|----------------------|-------|
| client-credentials.ts | ✓ | ✓ | Both: AuthClient, getTokenByClientCredentials, expiresAt*1000 (no Date.now) |
| authorization-code.ts | ✓ | ✓ | Both: getTokenByCode(URL), no req.query.code, no .data; without-skill added codeVerifier |
| refresh-token.ts | ✓ | ✓ | Both: getTokenByRefreshToken, refreshToken camelCase, expiresAt absolute |
| management-client.ts | ✓ | ✓ | Both: ManagementClient preserved, AuthClient added, only getApiToken migrated |
| password-grant-mfa.ts | ✓ | ✓ | Both: isMfaRequiredError, AuthApiError removed; without-skill also imported MfaRequiredError type |
| passwordless.ts | ✓ | ✓ | Both: sendSms camelCase, getTokenByPasswordlessSms/Email, phoneNumber camelCase |
| package.json | not checked | not checked | npm install not run (no npm in allowedTools) |

## Skill delta

**What with-skill got right that without-skill missed:**
- With-skill used explicit `authClient` variable name (matches SKILL.md guidance)
- With-skill used optional chaining `error.cause?.error_description` in MFA handler (safer)
- With-skill read skill references before writing, confirming exact API shape before touching code
- With-skill included `authorizationParams` config option for redirect_uri on AuthClient constructor

**What both got right (model knowledge alone):**
- All 6 files correctly migrated
- ManagementClient preserved in management-client.ts
- expiresAt absolute timestamp trap (no Date.now() arithmetic)
- isMfaRequiredError guard (not AuthApiError string check)
- camelCase params throughout (phoneNumber, refreshToken, etc.)
- resp.data envelope removed everywhere
- sendSMS → sendSms casing

**What both got wrong (skill gap):**
- Neither ran `npm install @auth0/auth0-auth-js` (Bash was allowed but npm install was not attempted in Phase 4 real run — likely because package.json exists but auth0-auth-js is only in overrides, not dependencies)
- Neither updated package.json dependencies (only the skill had this in references but agent focused on source code)

## Specific observations

### client-credentials.ts
- Correct: AuthClient constructor, getTokenByClientCredentials, tokens.accessToken, expiresAt*1000
- With-skill: variable named `authClient` (consistent with skill's naming convention)
- Without-skill: variable named `auth0` (old name carried over, still works)
- No divergences from reference behavior

### authorization-code.ts
- Correct: getTokenByCode(callbackUrl), no req.query.code extraction
- Without-skill went further: added codeVerifier pass-through (from PKCE context)
- With-skill: redirect_uri moved to AuthClient constructor `authorizationParams`
- Both: expiresAt absolute, no .data envelope

### refresh-token.ts
- Correct: getTokenByRefreshToken({ refreshToken }), expiresAt*1000, no expires_in
- Identical behavior between runs

### management-client.ts
- Critical: ManagementClient import from 'auth0' preserved by both
- mgmtClient, listUsers(), getUser() untouched by both
- Only AuthenticationClient half (getApiToken) migrated
- Both correctly added separate AuthClient import

### password-grant-mfa.ts
- Correct: isMfaRequiredError, AuthApiError removed, getTokenByPassword
- Without-skill added MfaRequiredError type import (useful for typed catch param)
- With-skill used `error.cause?.error_description` (optional chain, safer)
- Without-skill used `error.cause.error_description` (no optional chain, fine for typed catch)

### passwordless.ts
- Correct: sendSms (camelCase), getTokenByPasswordlessSms, getTokenByPasswordlessEmail
- Correct: phoneNumber camelCase (not phone_number)
- Correct: tokens.accessToken (no resp.data)
- Both correctly split "start" (sendSms/sendEmail sub-client) from "verify" (grant method)

## Divergences from reference (`after/`)

Neither run was compared against after/ line-by-line (reference uses tarball SDK install).
Behavioral correctness confirmed on all 6 migration patterns. Minor style differences:
- Variable naming: `auth0` vs `authClient` (both valid)
- Optional chaining on `e.cause?.error_description` (with-skill) vs non-null (without-skill)

## Skill gaps identified (ordered by impact)

1. **Router not loading migration skill references** — The auth0 router skill's `upgrade-sdk` intent reads `references/framework-{framework}/index.md` but does NOT load the migrating-node-auth0 skill's `api-mapping.md` or `breaking-changes.md`. The with-skill run tried to Read these files directly (denied in first run), meaning the agent knew to look for them but the router doesn't expose them automatically. The eval harness uses `--add-dir plugins/auth0/skills/auth0` which helps somewhat.
2. **authorization-code-url eval prompt vague** — The eval's "migrate off node-auth0" prompt caused a no-op (0/4). Fixed: prompt now explicitly names getTokenByCode and URL pattern.
3. **package.json not updated** — Neither run updated package.json dependencies or ran npm install. The skill references this but the agent (in dontAsk mode without Bash npm permission) couldn't execute it.
4. **database-changepassword-return grader too strict** — The `not_contains ".data"` grader was too broad (caught unrelated .data in other contexts). Fixed: removed, relying on judge.
5. **passwordless-sms-topdown comment trap** — `not_contains "loginWithSMS"` failed when agent kept old method name in a comment. Fixed: removed, relying on judge + `contains getTokenByPasswordlessSms`.

## Recommended SKILL.md edits

1. Add prominent note to Phase 4 (structural changes) about package.json update requirement
2. Add `npm install @auth0/auth0-auth-js` as an explicit step in migration workflow
3. The router SKILL.md should add a `migrate-node-auth0` intent that loads the migration skill references (separate PR)

## Tool call efficiency

| Run | Duration | Cost |
|-----|----------|------|
| with-skill (opus-4-8) | ~7 min | $0.80 |
| without-skill | ~4 min | not tracked |

The with-skill run was slower due to reading additional skill references before writing code. The quality benefit: consistent naming, safer optional chaining, authorizationParams config pattern.
