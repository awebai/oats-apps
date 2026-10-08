// Real released kernel CLI over disposable local Git remotes. No harness launch.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
if (!process.argv[2]) {
  const { test } = await import('node:test');
  test('Released OATS 0.47.0 materialization', { skip: 'Run this file explicitly with the pinned executable path; see README.md' }, () => {});
} else {
const kernel = resolve(process.argv[2] || 'missing-kernel-bin');
assert.equal(JSON.parse(readFileSync(join(dirname(kernel), '../package.json'))).version, '0.47.0');
const repo = fileURLToPath(new URL('../..', import.meta.url));
const base = realpathSync(mkdtempSync(join(tmpdir(), 'library-kernel-')));
const dep = join(base, 'deployment'), seed = join(base, 'seed'), bare = join(base, 'fixture.git'), bin = join(base, 'bin');
const ref = pathToFileURL(bare).href;
const write = (path, value, mode) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), mode ? { mode } : {}); };
for (const dir of [dep, seed, bin, join(base, 'home'), join(base, 'tmux')]) mkdirSync(dir, { recursive: true });
// These executable tripwires satisfy presence checks, never app/harness behavior.
for (const name of ['aw', 'claude', 'pi', 'codex', 'tmux']) write(join(bin, name), '#!/bin/sh\nexit 97\n', 0o755);
const env = { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: join(base, 'home'), TMPDIR: base, TMUX_TMPDIR: join(base, 'tmux'), OATS_REMOTE_CACHE: join(base, 'cache'), OATS_HOME_DIR: join(base, 'oats-home'), OATS_PACKAGE_CATALOG: join(base, 'catalog.json'), OATS_TMUX_SESSION: `library-fixture-${process.pid}`, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
function command(executable, args, cwd) {
  const r = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(r.status, 0, `${args.join(' ')}\n${r.stdout}\n${r.stderr}`); return r.stdout.trim();
}
const git = (...args) => command('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], seed);
const cli = args => {
  const doc = JSON.parse(command(process.execPath, [kernel, ...args, '--dir', dep, '--json'], dep));
  assert.equal(doc.ok, true); return doc.result;
};
function compareTree(source, dest) {
  for (const item of readdirSync(source, { withFileTypes: true })) {
    const a = join(source, item.name), b = join(dest, item.name);
    if (item.isDirectory()) compareTree(a, b); else assert.deepEqual(readFileSync(b), readFileSync(a), item.name);
  }
}
try {
  write(join(base, 'catalog.json'), { packages: {} });
  git('init', '-q', '--bare', bare); git('init', '-q');
  git('remote', 'add', 'origin', bare);
  cpSync(join(repo, 'oats-package'), join(seed, 'oats-package'), { recursive: true });
  write(join(seed, 'oats-workspace.yaml'), `schemaVersion: 2\nname: library-fixture\nmembers: [${ref}]\nteams:\n  global:\n    description: Fixture team\npackages:\n  oats.apps: git:${ref}@fixture-v1\ndefaults:\n  knowledge: none\n  messaging: none\n  tasks: none\n`);
  write(join(seed, 'oats-membership.yaml'), `schemaVersion: 2\nworkspace: ${ref}\n`);
  write(join(seed, 'souls/library-worker/soul.yaml'), `schemaVersion: 2\nname: library-worker\ndescription: Library materialization fixture\nwork: directory\ncapabilities:\n  oats.library: {from: package}\n  fixture.messaging: {from: here}\nknowledge: none\ntasks: none\n`);
  write(join(seed, 'souls/library-worker/AGENTS.md'), '# Fixture soul\nKeep selected identity unchanged.\n');
  write(join(seed, 'capabilities/fixture.messaging/oats.json'), { capability: 'fixture.messaging', version: '1.0.0', description: 'Inert messaging slot fixture, not oats.aweb', compatibility: { oats: '>=0.47.0' }, layer: 'messaging' });
  git('add', '.'); git('commit', '-qm', 'Isolated materialization input'); git('tag', 'fixture-v1'); git('push', '-q', 'origin', 'HEAD:main', 'fixture-v1');
  write(join(dep, 'oats-local.yaml'), `schemaVersion: 2\nworkspace: ${ref}\n`);
  cli(['sync']);
  const lock = JSON.parse(readFileSync(join(dep, 'oats-lock.json')));
  assert.equal(lock.lockfileVersion, 3); assert.ok(lock.packages['oats.apps'].commit);
  const receipt = { kernel: '0.47.0', kernel_source: 'e6e75ed8ba5a0a07a4b3e26fc627cac9064c730b', package: 'oats.apps@1.0.0 scratch fixture tag only', locked_commit: lock.packages['oats.apps'].commit, locked_integrity: lock.packages['oats.apps'].integrity, harnesses: [], limitations: 'No launches, real provider hooks or app operations. Messaging slot is inert fixture.messaging, not oats.aweb. Only Library selected; combined content CI remains parent-owned. Working-tree rehearsal is not published adoption.' };
  for (const harness of ['claude', 'pi', 'codex']) {
    const args = ['spawn', 'library-worker', '--purpose', harness, '--harness', harness, '--no-launch'];
    const preview = cli([...args, '--preview']);
    assert.ok(preview.modules.some(x => x.name === 'oats.library'));
    assert.ok(!preview.modules.some(x => x.name === 'oats.folio'));
    const result = cli(args);
    const home = result.home;
    const recorded = JSON.parse(readFileSync(join(home, 'instance.json')));
    assert.equal(recorded.launch.harness, harness);
    compareTree(join(repo, 'oats-package/capabilities/oats-library'), join(home, '.oats/modules/oats.library'));
    compareTree(join(repo, 'oats-package/capabilities/oats-library/skills/library'), join(home, '.agents/skills/library'));
    const instructions = readFileSync(join(home, 'AGENTS.md'), 'utf8');
    assert.ok(instructions.includes(readFileSync(join(repo, 'oats-package/capabilities/oats-library/injects/library.md'), 'utf8').trim()));
    assert.ok(existsSync(join(home, 'CLAUDE.md')));
    assert.ok(existsSync(join(home, '.claude/skills/library/SKILL.md')));
    assert.ok(!existsSync(join(home, '.aw')), 'no identity/provider side effects');
    receipt.harnesses.push({ harness, preview: 'PASS', no_launch_spawn: 'PASS', module_bytes: 'PASS', skill_bytes: 'PASS', inject: 'PASS' });
  }
  console.log(JSON.stringify(receipt, null, 2));
} finally { rmSync(base, { recursive: true, force: true }); }

}
