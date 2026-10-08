// Released OATS kernel over a disposable local Git remote: the whole oats.apps package,
// resolved and locked once, composes Folio and Library together and each one alone. No launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const capability = { 'oats.folio': 'oats-folio', 'oats.library': 'oats-library' };
const souls = { 'apps-worker': ['oats.folio', 'oats.library'], 'folio-worker': ['oats.folio'], 'library-worker': ['oats.library'] };

test('released OATS 0.47.0 composes oats.folio and oats.library from one locked package, together and alone, for Claude, Pi and Codex', { skip: !process.env.OATS_APPS_KERNEL && 'set OATS_APPS_KERNEL to the bin/oats.mjs of an unpacked @awebai/oats@0.47.0', timeout: 180000 }, () => {
  const kernel = resolve(process.env.OATS_APPS_KERNEL);
  assert.equal(JSON.parse(readFileSync(join(dirname(kernel), '../package.json'))).version, '0.47.0');
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'apps-kernel-')));
  const dep = join(base, 'deployment'), seed = join(base, 'seed'), bare = join(base, 'fixture.git'), bin = join(base, 'bin');
  const ref = pathToFileURL(bare).href;
  const write = (path, value, mode) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), mode ? { mode } : {}); };
  for (const dir of [dep, seed, bin, join(base, 'home'), join(base, 'tmux')]) mkdirSync(dir, { recursive: true });
  // Executable tripwires satisfy presence checks; any real invocation exits 97.
  for (const name of ['aw', 'claude', 'pi', 'codex', 'tmux']) write(join(bin, name), '#!/bin/sh\nexit 97\n', 0o755);
  const env = { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: join(base, 'home'), TMPDIR: base, TMUX_TMPDIR: join(base, 'tmux'), OATS_REMOTE_CACHE: join(base, 'cache'), OATS_HOME_DIR: join(base, 'oats-home'), OATS_PACKAGE_CATALOG: join(base, 'catalog.json'), OATS_TMUX_SESSION: `apps-fixture-${process.pid}`, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  function command(executable, args, cwd) {
    const r = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(r.status, 0, `${args.join(' ')}\n${r.stdout}\n${r.stderr}`); return r.stdout.trim();
  }
  const git = (...args) => command('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], seed);
  const cli = args => {
    const doc = JSON.parse(command(process.execPath, [kernel, ...args, '--dir', dep, '--json'], dep));
    assert.equal(doc.ok, true); return doc.result;
  };
  function sameTree(source, dest) {
    assert.deepEqual(readdirSync(dest).sort(), readdirSync(source).sort(), dest);
    for (const item of readdirSync(source, { withFileTypes: true })) {
      const a = join(source, item.name), b = join(dest, item.name);
      if (item.isDirectory()) sameTree(a, b); else assert.deepEqual(readFileSync(b), readFileSync(a), b);
    }
  }
  try {
    write(join(base, 'catalog.json'), { packages: {} });
    git('init', '-q', '--bare', bare); git('init', '-q'); git('remote', 'add', 'origin', bare);
    cpSync(join(repo, 'oats-package'), join(seed, 'oats-package'), { recursive: true });
    write(join(seed, 'oats-workspace.yaml'), `schemaVersion: 2\nname: apps-fixture\nmembers: [${ref}]\nteams:\n  global:\n    description: Fixture team\npackages:\n  oats.apps: git:${ref}@fixture-v1\ndefaults:\n  knowledge: none\n  messaging: none\n  tasks: none\n`);
    write(join(seed, 'oats-membership.yaml'), `schemaVersion: 2\nworkspace: ${ref}\n`);
    for (const [soul, selected] of Object.entries(souls)) {
      write(join(seed, `souls/${soul}/soul.yaml`), `schemaVersion: 2\nname: ${soul}\ndescription: oats.apps materialization fixture\nwork: directory\ncapabilities:\n${selected.map(name => `  ${name}: {from: package}\n`).join('')}  fixture.messaging: {from: here}\nknowledge: none\ntasks: none\n`);
      write(join(seed, `souls/${soul}/AGENTS.md`), '# Fixture soul\nKeep selected identity unchanged.\n');
    }
    write(join(seed, 'capabilities/fixture.messaging/oats.json'), { capability: 'fixture.messaging', version: '1.0.0', description: 'Inert messaging slot fixture, not oats.aweb', compatibility: { oats: '>=0.47.0' }, layer: 'messaging' });
    git('add', '.'); git('commit', '-qm', 'Isolated materialization input'); git('tag', 'fixture-v1'); git('push', '-q', 'origin', 'HEAD:main', 'fixture-v1');
    write(join(dep, 'oats-local.yaml'), `schemaVersion: 2\nworkspace: ${ref}\n`);
    cli(['sync']);
    const lock = JSON.parse(readFileSync(join(dep, 'oats-lock.json')));
    assert.equal(lock.lockfileVersion, 3);
    assert.equal(lock.packages['oats.apps'].commit, git('rev-parse', 'fixture-v1^{commit}'), 'the package is locked at the tagged fixture commit');
    for (const [soul, selected] of Object.entries(souls)) {
      for (const harness of ['claude', 'pi', 'codex']) {
        const args = ['spawn', soul, '--purpose', harness, '--harness', harness, '--no-launch'];
        const preview = cli([...args, '--preview']);
        for (const name of Object.keys(capability)) assert.equal(preview.modules.some(x => x.name === name), selected.includes(name), `${soul}/${harness} preview ${name}`);
        const home = cli(args).home;
        assert.equal(JSON.parse(readFileSync(join(home, 'instance.json'))).launch.harness, harness);
        const instructions = readFileSync(join(home, 'AGENTS.md'), 'utf8');
        for (const [name, dir] of Object.entries(capability)) {
          const root = join(repo, 'oats-package/capabilities', dir), skill = dir.replace('oats-', '');
          assert.equal(existsSync(join(home, '.oats/modules', name)), selected.includes(name), `${soul}/${harness} module ${name}`);
          assert.equal(existsSync(join(home, '.agents/skills', skill)), selected.includes(name), `${soul}/${harness} skill ${skill}`);
          const inject = readFileSync(join(root, 'injects', `${skill}.md`), 'utf8').trim();
          assert.equal(instructions.includes(inject), selected.includes(name), `${soul}/${harness} inject ${name}`);
          if (!selected.includes(name)) continue;
          sameTree(root, join(home, '.oats/modules', name));
          sameTree(join(root, 'skills', skill), join(home, '.agents/skills', skill));
          assert.ok(existsSync(join(home, '.claude/skills', skill, 'SKILL.md')));
        }
        assert.ok(!existsSync(join(home, '.aw')), 'no identity or provider side effects');
      }
    }
    console.log(`Released OATS 0.47.0: oats.apps locked at ${lock.packages['oats.apps'].commit}; 9 no-launch homes (both, Folio only, Library only x Claude/Pi/Codex) with byte-identical modules, skills and injects. Inert messaging fixture, not oats.aweb; no launch, provider hook or app operation.`);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
