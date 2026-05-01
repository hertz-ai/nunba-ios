#!/usr/bin/env node
/**
 * sync-from-android.js — vendor JS files from Hevolve_React_Native into js/shared/.
 *
 * Reads docs/SHARED_JS_MANIFEST.json and copies each listed source file from
 * the Android repo into js/shared/. Files that already exist are overwritten —
 * js/shared/ is vendored and never hand-edited.
 *
 * Usage:
 *   node scripts/sync-from-android.js                # do the sync
 *   node scripts/sync-from-android.js --dry-run      # show what would change
 *   node scripts/sync-from-android.js --check        # exit non-zero on drift (CI mode)
 *
 * Why Node and not jq+bash: jq isn't on every dev's machine, and Node is
 * already required to build this RN project. Using Node also means CI on
 * Windows doesn't need WSL.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'SHARED_JS_MANIFEST.json');
const SHARED_DIR = path.join(REPO_ROOT, 'js', 'shared');

const MODE = (() => {
  const arg = process.argv[2];
  if (!arg) return 'sync';
  if (arg === '--dry-run') return 'dry-run';
  if (arg === '--check') return 'check';
  console.error(`Unknown flag: ${arg}`);
  process.exit(2);
})();

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`ERROR: manifest not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const androidRepo = path.resolve(REPO_ROOT, manifest.android_repo_path);

if (!fs.existsSync(androidRepo) || !fs.statSync(androidRepo).isDirectory()) {
  console.error(`ERROR: Android repo not found at ${androidRepo}`);
  console.error(
    "       Update 'android_repo_path' in the manifest, or clone the Android repo as a sibling."
  );
  process.exit(1);
}

let driftCount = 0;
let copyCount = 0;
let missingSrc = 0;

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

function filesEqual(a, b) {
  const sa = fs.statSync(a);
  const sb = fs.statSync(b);
  if (sa.size !== sb.size) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

for (const group of manifest.groups) {
  const srcPrefix = group.source_prefix || '';
  const dstPrefix = group.destination_prefix || '';

  console.log(`── ${group.name} ─────────────────────`);

  for (const file of group.files) {
    const src = path.join(androidRepo, srcPrefix, file);
    const dst = path.join(SHARED_DIR, dstPrefix, file);
    const rel = path.posix.join(dstPrefix, file);

    if (!fs.existsSync(src)) {
      console.error(`  [MISSING-SRC] ${src}`);
      missingSrc += 1;
      continue;
    }

    ensureDir(path.dirname(dst));

    if (!fs.existsSync(dst)) {
      switch (MODE) {
        case 'sync':
          fs.copyFileSync(src, dst);
          console.log(`  [NEW] ${rel}`);
          copyCount += 1;
          break;
        case 'dry-run':
          console.log(`  [WOULD-COPY-NEW] ${rel}`);
          break;
        case 'check':
          console.log(`  [DRIFT] missing ${rel}`);
          driftCount += 1;
          break;
      }
      continue;
    }

    if (!filesEqual(src, dst)) {
      switch (MODE) {
        case 'sync':
          fs.copyFileSync(src, dst);
          console.log(`  [UPDATED] ${rel}`);
          copyCount += 1;
          break;
        case 'dry-run':
          console.log(`  [WOULD-UPDATE] ${rel}`);
          break;
        case 'check':
          console.log(`  [DRIFT] ${rel} diverges from Android`);
          driftCount += 1;
          break;
      }
    }
  }
}

console.log();
switch (MODE) {
  case 'sync':
    console.log(
      `Synced ${copyCount} files from ${androidRepo} into ${SHARED_DIR}`
    );
    if (missingSrc > 0) {
      console.error(
        `WARNING: ${missingSrc} manifest entries had no source — manifest may be stale.`
      );
      process.exit(1);
    }
    break;
  case 'dry-run':
    console.log('Dry run complete. Run without --dry-run to apply.');
    break;
  case 'check':
    if (driftCount > 0) {
      console.error(
        `FAIL: ${driftCount} files drifted. Run "yarn sync" to update.`
      );
      process.exit(1);
    }
    console.log('OK: no drift.');
    break;
}
