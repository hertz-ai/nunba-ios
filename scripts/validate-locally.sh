#!/usr/bin/env bash
#
# validate-locally.sh — runs the same checks the CI workflow runs,
# but on your local machine. Mirrors .github/workflows/validate.yml
# job-for-job so you can catch failures before pushing.
#
# Usage:
#   ./scripts/validate-locally.sh                 # everything
#   ./scripts/validate-locally.sh --skip-ios      # JS-only (no Xcode needed)
#   ./scripts/validate-locally.sh --ipad-only     # iPad simulator only
#   ./scripts/validate-locally.sh --iphone-only   # iPhone simulator only
#
# macOS-only when --skip-ios is NOT passed (Xcode + xcodegen + pod
# install required for the iOS pipeline).

set -euo pipefail

SKIP_IOS=false
SKIP_IPAD=false
SKIP_IPHONE=false

for arg in "$@"; do
  case "$arg" in
    --skip-ios)    SKIP_IOS=true ;;
    --ipad-only)   SKIP_IPHONE=true ;;
    --iphone-only) SKIP_IPAD=true ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { echo; echo "── $* ──"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# ─── 1. Manifest integrity ────────────────────────────────────

step "1/5  Manifest integrity"
node scripts/validate-manifest.js || fail "manifest integrity"

# ─── 2. JS validation ────────────────────────────────────────

step "2/5  yarn install"
if [ ! -d node_modules ]; then
  yarn install
fi

step "3/5  jest + tsc + js syntax"
yarn test --passWithNoTests --ci || fail "jest"
npx tsc --noEmit -p tsconfig.json || fail "tsc"
for f in $(find js/shared -name '*.js'); do
  node --check "$f" >/dev/null 2>&1 || fail "syntax check: $f"
done
echo "OK: js validation"

# ─── 4. Sync drift ───────────────────────────────────────────

step "4/5  Sync drift vs Android"
ANDROID_PATH="$(node -e "console.log(require('./docs/SHARED_JS_MANIFEST.json').android_repo_path)")"
if [ -d "$ANDROID_PATH" ]; then
  node scripts/sync-from-android.js --check || fail "sync drift detected"
else
  echo "SKIP: Android repo not found at $ANDROID_PATH (clone Hevolve_React_Native as a sibling to enable)"
fi

# ─── 5. iOS build + emulator smoke ───────────────────────────

if [ "$SKIP_IOS" = true ]; then
  echo
  echo "✅ JS-side validation passed (iOS skipped via --skip-ios)"
  exit 0
fi

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo
  echo "SKIP: iOS validation requires macOS. Pass --skip-ios to suppress."
  exit 0
fi

step "5/5  iOS build + simulator smoke"

# 5a. xcodegen
if ! command -v xcodegen >/dev/null; then
  fail "xcodegen not installed (brew install xcodegen)"
fi

cd ios
xcodegen generate

# 5b. pod install
if [ ! -d Pods ] || [ Podfile -nt Podfile.lock ]; then
  pod install
fi

# 5c. Build for simulator(s) + run tests
run_simulator_tests() {
  local label="$1"      # "iphone" | "ipad"
  local search="$2"     # search string for `xcrun simctl list`

  step "   → $label"
  local device_id
  device_id=$(xcrun simctl list devices available | grep -i "$search" | head -1 | grep -o '[A-F0-9-]\{36\}' || true)
  if [ -z "$device_id" ]; then
    fail "$label simulator not found (search: $search)"
  fi
  echo "Booting $label simulator: $device_id"
  xcrun simctl boot "$device_id" 2>/dev/null || true
  xcrun simctl bootstatus "$device_id" -b

  local result_path="TestResults-${label}.xcresult"
  rm -rf "$result_path"

  set -o pipefail
  xcodebuild test \
    -workspace NunbaCompanion.xcworkspace \
    -scheme NunbaCompanion \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,id=$device_id" \
    -resultBundlePath "$result_path" \
    COMPILER_INDEX_STORE_ENABLE=NO

  echo
  echo "  Screenshots in $result_path (open with: open $result_path)"
}

if [ "$SKIP_IPHONE" = false ]; then
  run_simulator_tests iphone "iPhone 15"
fi

if [ "$SKIP_IPAD" = false ]; then
  run_simulator_tests ipad "iPad Pro (12.9-inch)"
fi

cd "$REPO_ROOT"

echo
echo "✅ All local validation passed — safe to push."
