
# Auth0 Swift Integration

Native login for Apple platforms (iOS, macOS, tvOS, watchOS, visionOS) with
Auth0.swift: Web Auth via the system browser, Keychain storage via
`CredentialsManager`. Also covers upgrading an existing integration across a
major version.

**Do not use for:** Android (framework-android), React Native / Expo, Flutter,
web SPAs (React, Angular, Vue), or Node.js servers — route to that framework.

## Critical rules

- **Credential privacy:** never echo the Auth0 domain, client ID, or any secret
  in response text or terminal output. Redirect CLI output to a private temp
  file (`umask 077; OUT=$(mktemp)`), read it with the Read tool, write values
  straight into `Auth0.plist`, then `rm -f "$OUT"`. Mask the tenant when
  confirming it (`your-te****.us.auth0.com`).
- **No credentials in code:** put `ClientId` and `Domain` in `Auth0.plist` and
  call `Auth0.webAuth()` / `Auth0.authentication()` with no arguments. Native
  apps use PKCE — never add a client secret.
- **Hook into existing code:** search for existing login/logout handlers and
  extend them rather than adding parallel ones.
- **Don't stall on choices:** every decision below has a default — SwiftUI,
  SwiftPM, custom-scheme callback. Ask only when the project contradicts a
  default and you can ask; otherwise proceed and state the assumption.
- **Greenfield (no Xcode project, no `Package.swift`):** scaffold a SwiftUI app
  as a SwiftPM package (`Package.swift` with an executable/app target), add the
  dependency, then write the code below — don't stop to ask for a project.
- **Credentials already given** (in the prompt or an existing `Auth0.plist`):
  write/read `Auth0.plist` and skip app creation in Tenant setup; still list the
  callback/logout URLs the user must register.

## Install

Detect the dependency manager: `Podfile` → CocoaPods, `Cartfile` → Carthage,
`Package.swift` → SwiftPM; an `.xcodeproj` with none of these → Xcode-managed
SwiftPM (tell the user to add `https://github.com/auth0/Auth0.swift` via File →
Add Package Dependencies); nothing at all → greenfield SwiftPM. Resolve the latest release first
(`curl -s https://api.github.com/repos/auth0/Auth0.swift/releases/latest`; tags
are bare, e.g. `3.1.0`) and **pin to it** — `from: "<tag>"`, `~> <tag>` — never
an unbounded range or a remembered version. Perform the edits and run the
install command yourself.

## Tenant setup (Auth0 CLI)

Do not run `auth0 login` from the agent (interactive); ask the user to run it,
then check with `auth0 tenants list --csv --no-input` (private temp file) and
confirm the active tenant, masked. If an `Auth0.plist` already exists, read it
and skip app creation. Otherwise read `PRODUCT_BUNDLE_IDENTIFIER` and
`DEVELOPMENT_TEAM` from `project.pbxproj` (skip values containing `$(` or
`Tests`), then:

```bash
auth0 apps create --name "BUNDLE_ID-ios" --type native --auth-method none \
  --callbacks "https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
  --logout-urls "https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
  --json --no-input > "$OUT"
# Universal Links: Auth0 hosts apple-app-site-association once Team ID is set
auth0 api patch applications/CLIENT_ID \
  --data '{"mobile":{"ios":{"team_id":"TEAM_ID","app_bundle_identifier":"BUNDLE_ID"}}}' \
  --no-input > /dev/null 2>&1
```

- macOS targets use `/macos/` instead of `/ios/` in both URLs.
- Updating an existing app: `auth0 apps show CLIENT_ID --json` first and
  **append** to the existing `callbacks` / `allowed_logout_urls` — `apps update`
  replaces the lists.
- If the CLI keeps failing, ask the user to drop the `Auth0.plist` downloaded
  from the Dashboard into the project root instead of typing credentials.

## Read the SDK docs (required before writing code)

Auth0.swift's user docs are root-level Markdown (its `docs/` directory is
generated DocC, not guides): `README.md` (install, `Auth0.plist`, callback
URLs, associated domains, login/logout, credential storage), `EXAMPLES.md`
(every feature: Web Auth options, Credentials Manager, biometrics, errors, MFA,
organizations, passkeys, DPoP), `FAQ.md`, `V3_MIGRATION_GUIDE.md`.

1. If installed, read them from the checkout: `.build/checkouts/Auth0.swift/`
   (SwiftPM), `~/Library/Developer/Xcode/DerivedData/*/SourcePackages/checkouts/Auth0.swift/`
   (Xcode), or `Carthage/Checkouts/Auth0.swift/`. CocoaPods installs only the
   Swift sources, so use step 2.
2. Otherwise fetch `https://raw.githubusercontent.com/auth0/Auth0.swift/<tag>/README.md`
   (and `EXAMPLES.md`, …) — the installed version's tag from `Package.resolved`
   / `Podfile.lock` / `Cartfile.resolved`, or the latest release for a new
   install.
3. For Auth0 concepts, fetch `https://auth0.com/docs/quickstart/native/ios-swift.md`
   and `https://auth0.com/docs/libraries/auth0-swift.md`.

Prefer what these say over anything remembered — method names and return types
changed between majors (e.g. v3 renamed `clearSession()` → `logout()` and made
`store(credentials:)` throw). If none can be read, say so and continue.

## What to build

Unless the user asks for less, the integration has all of:

- Login with `webAuth().start()` and logout that clears the session cookie
  **and** the stored credentials.
- One shared `CredentialsManager`: store after login, `credentials()` to read
  (auto-renews), `canRenew()` to restore the session on launch.
- An explicit scope including `offline_access` (refresh tokens).
- Typed error handling — `WebAuthError` (treat user cancel as a no-op) and
  `CredentialsManagerError` (no credentials / renewal failed → clear and show
  login) — not a bare `catch`.
- Biometric protection on credential retrieval (`EXAMPLES.md` → Biometric
  authentication), including `NSFaceIDUsageDescription` in `Info.plist`.
- SwiftUI: an `ObservableObject` auth service injected at the `@main` app;
  UIKit: a plain service class called from the view controllers. Detect which
  from `@main struct … App` vs `AppDelegate`.

## Agent-only rules

- **Callback scheme:** default to custom scheme (`BUNDLE_ID://`, works
  everywhere, no `.useHTTPS()`); use HTTPS Universal Links only when the user
  wants it (production; iOS 17.4+ / macOS 14.4+, paid Apple developer account)
  — and offer it as the hardening step. Universal Links need all of: HTTPS callback URLs, Team ID
  device settings, the `applinks:` + `webcredentials:` associated-domains
  entitlement (append to an existing array; set `CODE_SIGN_ENTITLEMENTS` if you
  create the file), and `.useHTTPS()` on **both** login and logout — skipping one
  fails silently after login.
- Remaining manual Xcode steps to hand the user: add `Auth0.plist` to the app
  target; register `$(PRODUCT_BUNDLE_IDENTIFIER)` under Info → URL Types for
  custom schemes; on macOS, add the Outgoing Connections (Client) capability.
- Never store tokens in `UserDefaults` or files — only `CredentialsManager`.
- CocoaPods: open the `.xcworkspace`, not the `.xcodeproj`.
- Verify with `xcodebuild build -scheme <SCHEME> -destination "platform=iOS Simulator,name=<available iPhone>"`;
  fix up to 5 times before asking. Biometrics need a physical device to test.

## Major-version upgrade

`V3_MIGRATION_GUIDE.md` at the target tag lists every breaking change with
before/after code; read it in full. The skill adds only the process:

1. Run `git status --porcelain` and require a clean tree (offer to stash or
   commit), create a backup branch, and get a green build on the current
   version first. If the project isn't on disk but its code is in the
   conversation, write those files (`Package.swift`, sources) into the working
   directory and migrate them there — edit files, don't answer in chat only.
2. Target: the user's tag if given (must exist, be in the target major, and not
   be a downgrade — otherwise stop and ask), else the latest release of that
   major. Pre-releases need an exact pin (`exact:` / `'3.0.0-beta.2'`); range
   specifiers won't resolve them.
3. Read **every** file that `import Auth0` and list which changed APIs it uses
   (grep misses multi-line builder chains). Apply only those sections, in the
   project's existing style (callbacks / async / Combine); cross-check each
   signature against the SDK source at the tag. Never touch unused APIs.
4. Removed APIs that need backend or product work (e.g. the client-side
   Management API client, old MFA methods): leave a `// TODO:` and report it —
   never delete the call site silently, never embed a Management API token.
5. Apply all known changes, then build with `xcodebuild build` (or
   `swift build` for a package); stop after 10 build-fix cycles and show the
   remaining errors. Run the tests. If no toolchain is available, say so.
6. Summarise: changes per area, every silent behaviour change the guide lists
   (v3: default scope now includes `offline_access`, `minTTL` default 60 s),
   `try?` that replaced a discarded `Bool`, and the TODOs. Offer — don't apply —
   new optional APIs.
