# Migration Process — Edge Cases & Procedures

Detailed guidance for scenarios that go beyond the standard 8-step workflow.

---

## Multi-Major-Version Jumps

When migrating across multiple major versions (e.g., v1 → v3), apply migrations sequentially:

1. Migrate v1 → v2 (fetch v2 guide, apply, build)
2. Migrate v2 → v3 (fetch v3 guide, apply, build)

**Why sequential?** Each major version's migration guide assumes you're coming from the immediately prior version. Skipping versions may miss intermediate renames or behavioral changes that compound.

**Exception:** If the latest migration guide explicitly states it covers migration from multiple prior versions (e.g., "Migrating from v1 or v2 to v3"), follow that single guide.

---

## Rollback Procedure

If the migration fails beyond repair or the user decides to abort:

```bash
# Option 1: Reset to the backup branch
git checkout auth0-swift-migration-backup
git branch -D <current-branch>  # only if user confirms

# Option 2: Revert all migration changes
git checkout -- .
git clean -fd  # removes new untracked files — confirm with user first

# Option 3: Stash changes for later
git stash push -m "auth0-swift-migration-in-progress"
```

Always confirm with the user before any destructive git operation.

---

## Xcode-Managed SPM Dependencies

When the project uses Xcode's built-in SPM (no `Package.swift` at root):

1. The version constraint lives inside `project.pbxproj`
2. Direct editing of pbxproj is fragile — prefer instructing the user to update via Xcode UI
3. After the user updates, verify resolution:
   ```bash
   grep -A2 "Auth0.swift" *.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved 2>/dev/null || \
   grep -A2 "Auth0.swift" **/Package.resolved 2>/dev/null
   ```

---

## Workspace with Multiple Targets

For projects with multiple targets (app + extensions + widgets):

1. All targets importing Auth0 must be migrated simultaneously
2. Search ALL targets for Auth0 imports:
   ```bash
   grep -rl "import Auth0" --include="*.swift" .
   ```
3. Group affected files by target (check which target membership each file has)
4. Apply the same migration changes to all targets
5. Build each scheme individually if needed:
   ```bash
   xcodebuild -list  # shows all schemes
   ```

---

## CocoaPods Subspecs

Some versions of Auth0.swift expose subspecs. During migration:

1. Check if the Podfile uses subspecs: `pod 'Auth0/WebAuth'`, `pod 'Auth0/Authentication'`
2. Check the new version's podspec to see if subspecs still exist or were merged
3. If subspecs were removed, simplify to `pod 'Auth0', '~> N.0'`

---

## Carthage Binary Frameworks

For Carthage users migrating to a version that ships XCFrameworks:

1. Remove old framework references from Xcode
2. Use `--use-xcframeworks` flag:
   ```bash
   carthage update Auth0.swift --use-xcframeworks
   ```
3. Re-add the XCFrameworks to the target's "Frameworks, Libraries, and Embedded Content"

---

## When the Migration Guide is Missing

If no official migration guide exists for the target version:

1. **Check the CHANGELOG** for breaking changes listed under the major version
2. **Compare release notes** between current and target versions
3. **Use build errors as the guide** — bump the version, build, and fix errors one by one
4. **Check API diff** if available:
   ```bash
   # Compare public API between tags
   curl -s "https://api.github.com/repos/auth0/Auth0.swift/compare/CURRENT_TAG...TARGET_TAG" | python3 -c "
   import sys, json
   data = json.load(sys.stdin)
   for f in data.get('files', []):
       if f['filename'].endswith('.swift') and '/Sources/' in f['filename']:
           print(f['filename'], f['status'])
   "
   ```

---

## Handling Deprecated APIs

When the migration guide marks APIs as deprecated (not removed):

1. **Do NOT change deprecated APIs during migration** — they still compile
2. Note them for the user as follow-up work
3. Only replace deprecated APIs if the user explicitly asks, or if they produce build warnings that the user wants resolved
4. Deprecated → removed happens in the NEXT major version, so they're safe for now

---

## Swift Version Compatibility

Major Auth0.swift versions may require newer Swift versions:

1. Check the migration guide or release notes for Swift version requirements
2. Verify the project's Swift version:
   ```bash
   grep "SWIFT_VERSION" *.xcodeproj/project.pbxproj | head -5
   ```
3. If a Swift version bump is needed, inform the user — this may require an Xcode update
4. Swift version changes can introduce their own compiler errors unrelated to Auth0 — distinguish between Auth0 migration issues and Swift version issues

---

## JWTDecode Dependency

Auth0.swift depends on JWTDecode.swift. Major version bumps of Auth0.swift may bump the JWTDecode dependency too:

1. If the project directly imports JWTDecode, check for breaking changes in that library as well
2. If other pods/packages depend on JWTDecode, version conflicts may arise — resolve by aligning versions
3. For CocoaPods, run `pod update Auth0 JWTDecode` to update both together
