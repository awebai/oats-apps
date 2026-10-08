// Uses the released public CLI, a disposable local Git remote, and no provider hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('../../', import.meta.url));
test('released OATS 0.47.0 materializes Folio for Claude, Pi and Codex without launch', { skip: !process.env.FOLIO_OATS_ROOT, timeout: 90000 }, () => {
  const kernel = resolve(process.env.FOLIO_OATS_ROOT);
  assert.equal(JSON.parse(readFileSync(join(kernel, 'package.json'))).version, '0.47.0');
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'folio-materialize-')));
  const source = join(scratch, 'source'), deploy = join(scratch, 'deployment'), user = join(scratch, 'user'), bin = join(scratch, 'bin');
  const tripwires = ['aw', 'claude', 'pi', 'codex', 'tmux'];
  const env = { HOME: user, PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, XDG_CACHE_HOME: join(scratch, 'cache'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ALLOW_PROTOCOL: 'file', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1' };
  function put(path, body) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof body === 'string' ? body : JSON.stringify(body)); }
  function git(...args) { return execFileSync('git', args, { cwd: source, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  function oats(...args) {
    try { return JSON.parse(execFileSync(process.execPath, [join(kernel, 'bin/oats.mjs'), ...args, '--json'], { cwd: scratch, env, encoding: 'utf8', timeout: 20000 })); }
    catch (error) { throw new Error(`${args[0]} failed: ${error.stdout || ''} ${error.stderr || ''}`); }
  }
  try {
    // These executable tripwires satisfy presence checks, never app/harness behavior.
    mkdirSync(bin); for (const name of tripwires) writeFileSync(join(bin, name), '#!/bin/sh\nexit 97\n', { mode: 0o755 });
    mkdirSync(source); mkdirSync(user);
    cpSync(join(repo, 'oats-package/capabilities/oats-folio'), join(source, 'capabilities/oats-folio'), { recursive: true });
    const ref = 'file://' + source;
    put(join(source, 'oats-workspace.yaml'), { schemaVersion: 2, name: 'folio-fixture', members: [ref], defaults: { knowledge: 'none', messaging: 'none', tasks: 'none' } });
    put(join(source, 'oats-membership.yaml'), { schemaVersion: 2, workspace: ref });
    put(join(source, 'souls/fixture/soul.yaml'), { schemaVersion: 2, name: 'fixture', description: 'Synthetic Folio materialization fixture', work: 'directory', capabilities: { 'oats.core': 'off', 'oats.folio': { from: 'here' } }, knowledge: 'none', messaging: 'none', tasks: 'none' });
    put(join(source, 'souls/fixture/AGENTS.md'), 'Synthetic soul for isolated content materialization.\n');
    git('init', '-b', 'main'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic materialization fixture');
    oats('onboard', deploy, '--workspace', ref);
    git('clone', source, join(deploy, 'source'));
    for (const harness of ['claude', 'pi', 'codex']) {
      oats('spawn', 'fixture', '--dir', deploy, '--purpose', harness, '--harness', harness, '--no-launch');
      const home = join(deploy, 'agents/fixture/instances', `fixture-${harness}`);
      assert.ok(existsSync(join(home, 'instance.json')));
      const composed = readFileSync(join(home, 'AGENTS.md'), 'utf8');
      assert.ok(composed.includes(readFileSync(join(repo, 'oats-package/capabilities/oats-folio/injects/folio.md'), 'utf8').trim()));
      const skill = '.agents/skills/folio/SKILL.md';
      assert.equal(readFileSync(join(home, skill), 'utf8'), readFileSync(join(repo, 'oats-package/capabilities/oats-folio/skills/folio/SKILL.md'), 'utf8'));
      assert.deepEqual(readdirSync(join(home, '.oats/modules')).sort(), ['oats.folio']);
      for (const name of readdirSync(join(repo, 'oats-package/capabilities/oats-folio/skills/folio/references'))) assert.equal(readFileSync(join(home, '.agents/skills/folio/references', name), 'utf8'), readFileSync(join(repo, 'oats-package/capabilities/oats-folio/skills/folio/references', name), 'utf8'));
    }
    console.log('Real released 0.47.0 CLI: 3 no-launch homes; byte-identical Folio inject/skill/references; local member fixture only. Combined package/provider composition, live spawn/retire and app acceptance NOT RUN here.');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
