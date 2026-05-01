/**
 * Tests for scripts/validate-manifest.js
 *
 * Spawns the script as a subprocess so we exercise the real CLI
 * surface (exit codes, stderr) — the script uses process.exit(),
 * which is hostile to in-process invocation.
 */

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'validate-manifest.js');

/**
 * Run validate-manifest.js against a temp clone of the repo where
 * we can mutate the manifest + js/shared/ tree without touching
 * the real working copy.
 */
function runWithFixture(setup) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nunba-vm-'));
  try {
    // Copy the manifest, the script, and the directories the script
    // touches. We DON'T copy node_modules or anything else.
    const tmpDocs = path.join(tmpRoot, 'docs');
    const tmpScripts = path.join(tmpRoot, 'scripts');
    const tmpShared = path.join(tmpRoot, 'js', 'shared');
    fs.mkdirSync(tmpDocs, {recursive: true});
    fs.mkdirSync(tmpScripts, {recursive: true});
    fs.mkdirSync(tmpShared, {recursive: true});

    fs.copyFileSync(
      path.join(REPO_ROOT, 'docs', 'SHARED_JS_MANIFEST.json'),
      path.join(tmpDocs, 'SHARED_JS_MANIFEST.json')
    );
    fs.copyFileSync(
      SCRIPT,
      path.join(tmpScripts, 'validate-manifest.js')
    );

    setup({tmpRoot, tmpDocs, tmpShared});

    const proc = spawnSync('node', [path.join(tmpScripts, 'validate-manifest.js')], {
      encoding: 'utf8',
      env: process.env,
    });
    return {
      code: proc.status,
      stdout: proc.stdout || '',
      stderr: proc.stderr || '',
    };
  } finally {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
  }
}

describe('validate-manifest.js', () => {
  test('exit 0 when manifest matches js/shared/ exactly', () => {
    const result = runWithFixture(({tmpDocs, tmpShared}) => {
      // Single-group manifest, single file, both present.
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../whatever',
          groups: [
            {
              name: 'stores',
              destination_prefix: 'stores/',
              files: ['testStore.js'],
            },
          ],
          deliberately_excluded: [],
        })
      );
      fs.mkdirSync(path.join(tmpShared, 'stores'), {recursive: true});
      fs.writeFileSync(
        path.join(tmpShared, 'stores', 'testStore.js'),
        '// stub\n'
      );
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('OK: manifest matches');
  });

  test('exit 1 on orphan file (in shared/ but not in manifest)', () => {
    const result = runWithFixture(({tmpDocs, tmpShared}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../whatever',
          groups: [{name: 'stores', destination_prefix: 'stores/', files: []}],
          deliberately_excluded: [],
        })
      );
      // Orphan file: present on disk, not listed in manifest.
      fs.mkdirSync(path.join(tmpShared, 'stores'), {recursive: true});
      fs.writeFileSync(path.join(tmpShared, 'stores', 'orphan.js'), '// x');
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ORPHAN');
    expect(result.stderr).toContain('orphan.js');
  });

  test('exit 1 on missing file (in manifest but not on disk)', () => {
    const result = runWithFixture(({tmpDocs}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../whatever',
          groups: [
            {
              name: 'stores',
              destination_prefix: 'stores/',
              files: ['expected.js'],
            },
          ],
          deliberately_excluded: [],
        })
      );
      // Don't create the file — simulating "manifest entry exists,
      // file was deleted".
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('MISSING');
    expect(result.stderr).toContain('expected.js');
  });

  test('exit 2 when manifest is malformed JSON', () => {
    const result = runWithFixture(({tmpDocs}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        '{not valid json'
      );
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('not valid JSON');
  });

  test('exit 2 when manifest missing required keys', () => {
    const result = runWithFixture(({tmpDocs}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({android_repo_path: '../x'})  // no groups
      );
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('missing required key');
  });

  test('exit 2 when groups[].files is not an array', () => {
    const result = runWithFixture(({tmpDocs}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../x',
          groups: [{name: 'stores', files: 'not-an-array'}],
          deliberately_excluded: [],
        })
      );
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('no .files array');
  });

  test('ignores README.md inside js/shared/', () => {
    const result = runWithFixture(({tmpDocs, tmpShared}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../x',
          groups: [],
          deliberately_excluded: [],
        })
      );
      // README.md in shared/ should NOT be reported as orphan.
      fs.writeFileSync(path.join(tmpShared, 'README.md'), '# vendored');
    });
    expect(result.code).toBe(0);
  });

  test('handles nested directories under shared/', () => {
    const result = runWithFixture(({tmpDocs, tmpShared}) => {
      fs.writeFileSync(
        path.join(tmpDocs, 'SHARED_JS_MANIFEST.json'),
        JSON.stringify({
          android_repo_path: '../x',
          groups: [
            {
              name: 'services',
              destination_prefix: 'services/',
              files: ['nested/deep.js'],
            },
          ],
          deliberately_excluded: [],
        })
      );
      fs.mkdirSync(path.join(tmpShared, 'services', 'nested'), {recursive: true});
      fs.writeFileSync(
        path.join(tmpShared, 'services', 'nested', 'deep.js'),
        '// deep'
      );
    });
    expect(result.code).toBe(0);
  });
});
