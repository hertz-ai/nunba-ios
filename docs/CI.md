# CI — auto validation workflow

Source: `.github/workflows/validate.yml`. Every job is **required** —
nothing runs as best-effort. Red X on any job blocks the PR merge.

## Pipeline

```
manifest-integrity (ubuntu, ~30s)
    ├─→ js-validate (ubuntu, ~2min)
    │       jest + tsc + node --check on every js/shared/*.js
    ├─→ sync-drift (ubuntu, ~1min)
    │       clones Hevolve_React_Native, runs sync:check
    │       requires secret: ANDROID_REPO_TOKEN
    └─→ ios-build (macos-14, ~15-25min)
            xcodegen + pod install + xcodebuild build + xcodebuild test
            on iPhone 15 simulator
            └─→ ios-ipad-build (macos-14, ~10-15min)
                    same scheme on iPad Pro (12.9-inch) — catches
                    iPhone-only assumptions in a universal build
```

## What each job catches

| Job | Catches |
|-----|---------|
| `manifest-integrity` | Vendored file added to `js/shared/` without a manifest entry; manifest entry missing from disk; manifest JSON malformed |
| `js-validate` | jest test failures; broken TS contracts in `js/native-bridge/`; non-parseable JS files in `js/shared/` |
| `sync-drift` | Vendored file diverged from Android upstream — fails CI until `yarn sync` is run + committed, OR until the change is intentionally moved out of `js/shared/` into `js/ios/` |
| `ios-build` | Swift compile errors; missing bridge headers; broken Podfile; failing XCTest cases |
| `ios-ipad-build` | iPhone-only assumptions in code that builds for both — different simulator destination, same scheme |

## Required setup before first green build

### 1. `ANDROID_REPO_TOKEN` secret

The `sync-drift` job needs read access to the private Android sibling
repo. Create a fine-grained PAT:

1. Go to https://github.com/settings/personal-access-tokens/new
2. Resource owner: `hertz-ai`
3. Repository access: `Only select repositories` → `hertz-ai/Hevolve_React_Native`
4. Permissions → Repository permissions → Contents: **Read-only**
5. Generate, copy the token
6. Add as repo secret: https://github.com/hertz-ai/nunba-ios/settings/secrets/actions
   - Name: `ANDROID_REPO_TOKEN`
   - Value: (paste)

### 2. iOS-side build prerequisites

These are runtime, not setup:
- `macos-14` runner (free for public repos, billed for private)
- Xcode 16 (auto-installed on macos-14 image)
- xcodegen (installed via `brew install xcodegen` in the job)
- CocoaPods (Ruby gem — installed via `bundler-cache: true`)

### 3. Branch protection rules (recommended)

To make CI actually block merges:

1. https://github.com/hertz-ai/nunba-ios/settings/branches
2. Add rule for `main`
3. Require status checks to pass:
   - `Manifest integrity`
   - `JS (jest + tsc)`
   - `Sync drift vs Android`
   - `iOS build + XCTest`
   - `iOS build (iPad)`
4. Require pull request reviews before merging

## Local equivalents

One command runs the entire CI pipeline locally:

```bash
yarn validate:local              # everything (macOS only for iOS portion)
yarn validate:local:js           # JS-only — works on Windows/Linux
yarn validate:local:iphone       # iOS portion, iPhone simulator only
yarn validate:local:ipad         # iOS portion, iPad simulator only
```

Or run individual checks:

```bash
# Manifest integrity (~30s)
yarn validate:manifest

# JS validation (~1-2min)
yarn test
npx tsc --noEmit

# Sync drift (~5s; requires ../Hevolve_React_Native checkout)
yarn sync:check

# iOS — full pipeline (macOS only, ~10-15min cold)
cd ios
xcodegen generate
pod install
xcodebuild test \
  -workspace NunbaCompanion.xcworkspace \
  -scheme NunbaCompanion \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# Open the result bundle to inspect screenshots + logs
open ios/TestResults-iphone.xcresult
```

## Emulator smoke test

The XCUITest target (`NunbaCompanionUITests/SmokeUITests.swift`) launches
the app on a simulator, waits up to 30s for the React Native bridge +
root component to render, and captures a screenshot as a test artifact.
Two cases:

| Case | Catches |
|------|---------|
| `test_appLaunches_andRendersRoot` | Build succeeds but app crashes on launch (missing Info.plist keys, UIKit assertions, RN bridge wiring); JS bundle fails to load; root component never renders |
| `test_appLaunches_twice_withoutCrash` | "First-run only" bugs in AppDelegate; JS bundle caching issues; state leaks |

CI runs both on iPhone 15 + iPad Pro 12.9". Screenshots are uploaded
as workflow artifacts (`iphone-test-results` / `ipad-test-results`)
and retained for 14 days. The step summary on each run reports
how many screenshots were captured, so a passing run with zero
screenshots is also a fail signal.

## Troubleshooting first-run failures

The first time CI runs on a never-before-built iOS project, expect
failures. Common ones:

- **Pod install errors** → CocoaPods spec mismatches. Update `Podfile`
  with explicit version pins.
- **Bridging-header not found** → check `SWIFT_OBJC_BRIDGING_HEADER`
  setting in `ios/project.yml` and re-run `xcodegen generate`.
- **Linker errors on `RCTAppDelegate`** → React Native iOS pods may need
  `use_frameworks!` adjustment. See React Native upgrade helper for
  0.81.4-specific Podfile.
- **XCTest target can't find host app symbols** → verify `BUNDLE_LOADER`
  + `TEST_HOST` settings in `ios/project.yml` match the app target name.

Each failure is iterated by editing source + re-pushing — that's the
intended development loop. The workflow is the harness, not a
black box.
