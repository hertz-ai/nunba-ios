/**
 * Tests for scripts/sync-from-android.js
 *
 * Builds two temp dirs — a fake "Android repo" with source files,
 * and a temp iOS repo — wires them together via a manifest, runs
 * the script in --check / --dry-run / sync modes, and asserts the
 * filesystem state and exit codes.
 */

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_SRC = path.join(REPO_ROOT, 'scripts', 'sync-from-android.js');

function makeFixture({manifest, androidFiles}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nunba-sync-'));
  const iosRoot = path.join(tmpRoot, 'ios');
  const androidRoot = path.join(tmpRoot, 'android');
  fs.mkdirSync(path.join(iosRoot, 'docs'), {recursive: true});
  fs.mkdirSync(path.join(iosRoot, 'scripts'), {recursive: true});
  fs.mkdirSync(path.join(iosRoot, 'js', 'shared'), {recursive: true});
  fs.mkdirSync(androidRoot, {recursive: true});

  // Adjust manifest's android_repo_path to point at our fake.
  const manifestPath = path.join(iosRoot, 'docs', 'SHARED_JS_MANIFEST.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...manifest,
      android_repo_path: '../android',
    })
  );

  fs.copyFileSync(SCRIPT_SRC, path.join(iosRoot, 'scripts', 'sync-from-android.js'));

  for (const [rel, content] of Object.entries(androidFiles || {})) {
    const full = path.join(androidRoot, rel);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  }

  return {tmpRoot, iosRoot, androidRoot};
}

function run(iosRoot, args = []) {
  const proc = spawnSync(
    'node',
    [path.join(iosRoot, 'scripts', 'sync-from-android.js'), ...args],
    {encoding: 'utf8'}
  );
  return {
    code: proc.status,
    stdout: proc.stdout || '',
    stderr: proc.stderr || '',
  };
}

function cleanup(tmpRoot) {
  fs.rmSync(tmpRoot, {recursive: true, force: true});
}

describe('sync-from-android.js', () => {
  test('--check passes when source matches destination', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {'x.js': 'console.log(1);\n'},
    });
    fs.mkdirSync(path.join(iosRoot, 'js', 'shared', 'stores'), {recursive: true});
    fs.writeFileSync(
      path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'),
      'console.log(1);\n'
    );

    const r = run(iosRoot, ['--check']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('OK: no drift');
    cleanup(tmpRoot);
  });

  test('--check fails (exit 1) when destination is missing a file', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {'x.js': 'console.log(1);\n'},
    });
    // Don't pre-create the destination file.

    const r = run(iosRoot, ['--check']);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('DRIFT');
    cleanup(tmpRoot);
  });

  test('--check fails when destination diverges from source', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {'x.js': 'console.log(1);\n'},
    });
    fs.mkdirSync(path.join(iosRoot, 'js', 'shared', 'stores'), {recursive: true});
    fs.writeFileSync(
      path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'),
      'console.log(2);\n'  // different
    );

    const r = run(iosRoot, ['--check']);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('DRIFT');
    cleanup(tmpRoot);
  });

  test('default mode copies new files', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js', 'y.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {
        'x.js': 'export const x = 1;\n',
        'y.js': 'export const y = 2;\n',
      },
    });

    const r = run(iosRoot);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Synced 2 files');

    expect(
      fs.readFileSync(path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'), 'utf8')
    ).toBe('export const x = 1;\n');
    expect(
      fs.readFileSync(path.join(iosRoot, 'js', 'shared', 'stores', 'y.js'), 'utf8')
    ).toBe('export const y = 2;\n');
    cleanup(tmpRoot);
  });

  test('default mode overwrites diverged files', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {'x.js': 'NEW content\n'},
    });
    fs.mkdirSync(path.join(iosRoot, 'js', 'shared', 'stores'), {recursive: true});
    fs.writeFileSync(
      path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'),
      'OLD content\n'
    );

    const r = run(iosRoot);
    expect(r.code).toBe(0);
    expect(
      fs.readFileSync(path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'), 'utf8')
    ).toBe('NEW content\n');
    cleanup(tmpRoot);
  });

  test('--dry-run does not copy', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['x.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {'x.js': 'console.log(1);\n'},
    });

    const r = run(iosRoot, ['--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Dry run complete');
    expect(r.stdout).toContain('WOULD-COPY-NEW');

    // File should NOT have been copied.
    expect(
      fs.existsSync(path.join(iosRoot, 'js', 'shared', 'stores', 'x.js'))
    ).toBe(false);
    cleanup(tmpRoot);
  });

  test('reports MISSING-SRC for manifest entries with no source file', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {
        groups: [
          {
            name: 'stores',
            destination_prefix: 'stores/',
            files: ['nonexistent.js'],
          },
        ],
        deliberately_excluded: [],
      },
      androidFiles: {},  // no sources
    });

    const r = run(iosRoot);
    // sync mode: missing source counts as drift → exit 1, with warning
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('MISSING-SRC');
    cleanup(tmpRoot);
  });

  test('exits non-zero on unknown flag', () => {
    const {tmpRoot, iosRoot} = makeFixture({
      manifest: {groups: [], deliberately_excluded: []},
      androidFiles: {},
    });
    const r = run(iosRoot, ['--bogus-flag']);
    expect(r.code).not.toBe(0);
    cleanup(tmpRoot);
  });

  test('exits non-zero when Android repo path does not exist', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nunba-sync-'));
    try {
      const iosRoot = path.join(tmpRoot, 'ios');
      fs.mkdirSync(path.join(iosRoot, 'docs'), {recursive: true});
      fs.mkdirSync(path.join(iosRoot, 'scripts'), {recursive: true});
      fs.writeFileSync(
        path.join(iosRoot, 'docs', 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../this-does-not-exist',
          groups: [],
          deliberately_excluded: [],
        })
      );
      fs.copyFileSync(SCRIPT_SRC, path.join(iosRoot, 'scripts', 'sync-from-android.js'));
      const r = run(iosRoot);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('Android repo not found');
    } finally {
      fs.rmSync(tmpRoot, {recursive: true, force: true});
    }
  });
});
