#!/usr/bin/env node
/**
 * validate-manifest.js — verifies docs/SHARED_JS_MANIFEST.json matches
 * the actual contents of js/shared/ exactly.
 *
 * Failure modes caught:
 *   1. File exists in js/shared/ but is NOT listed in the manifest
 *      → "orphan" file (got copied without a manifest entry)
 *   2. File listed in manifest but does NOT exist in js/shared/
 *      → "missing" file (manifest references a sync target that
 *      was deleted without manifest update)
 *   3. Manifest is not valid JSON
 *   4. Manifest is missing required top-level keys
 *
 * Exit codes:
 *   0  — manifest is consistent with js/shared/
 *   1  — drift detected; CI should fail
 *   2  — manifest is malformed; CI should fail
 *
 * Run locally:
 *   node scripts/validate-manifest.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'SHARED_JS_MANIFEST.json');
const SHARED_DIR = path.join(REPO_ROOT, 'js', 'shared');

// README.md is documentation, not vendored content.
const IGNORE_FILES = new Set(['README.md']);

function fail(code, msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(code);
}

// ─── 1. Manifest is valid JSON with required keys ──────────────────

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  fail(2, `manifest is not valid JSON: ${err.message}`);
}

const REQUIRED_KEYS = ['android_repo_path', 'groups', 'deliberately_excluded'];
for (const key of REQUIRED_KEYS) {
  if (!(key in manifest)) {
    fail(2, `manifest missing required key: ${key}`);
  }
}

if (!Array.isArray(manifest.groups)) {
  fail(2, 'manifest.groups must be an array');
}

// ─── 2. Build the expected file set from the manifest ──────────────

const expectedFiles = new Set();
for (const group of manifest.groups) {
  if (!Array.isArray(group.files)) {
    fail(2, `manifest group "${group.name}" has no .files array`);
  }
  const dstPrefix = group.destination_prefix || '';
  for (const file of group.files) {
    expectedFiles.add(path.posix.join(dstPrefix, file));
  }
}

// ─── 3. Walk js/shared/ and collect actual files ───────────────────

function walk(dir, prefix = '') {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  let files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (IGNORE_FILES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full, rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

if (!fs.existsSync(SHARED_DIR)) {
  fail(2, `js/shared/ directory missing at ${SHARED_DIR}`);
}

const actualFiles = new Set(walk(SHARED_DIR));

// ─── 4. Diff ───────────────────────────────────────────────────────

const orphans = [...actualFiles].filter((f) => !expectedFiles.has(f)).sort();
const missing = [...expectedFiles].filter((f) => !actualFiles.has(f)).sort();

let driftCount = 0;

if (orphans.length > 0) {
  console.error(
    `\n${orphans.length} ORPHAN file(s) in js/shared/ — present on disk but NOT in manifest:`
  );
  for (const f of orphans) console.error(`  + ${f}`);
  console.error(
    '\n  Fix: add these paths to docs/SHARED_JS_MANIFEST.json (in the right group),'
  );
  console.error('       OR delete them if they were copied by mistake.');
  driftCount += orphans.length;
}

if (missing.length > 0) {
  console.error(
    `\n${missing.length} MISSING file(s) — listed in manifest but NOT in js/shared/:`
  );
  for (const f of missing) console.error(`  - ${f}`);
  console.error(
    '\n  Fix: run "yarn sync" to copy them in,'
  );
  console.error('       OR remove these entries from docs/SHARED_JS_MANIFEST.json.');
  driftCount += missing.length;
}

if (driftCount > 0) {
  fail(1, `manifest drift detected (${driftCount} file mismatch${driftCount === 1 ? '' : 'es'})`);
}

console.log(
  `OK: manifest matches js/shared/ exactly (${actualFiles.size} files in ${manifest.groups.length} groups)`
);
process.exit(0);
