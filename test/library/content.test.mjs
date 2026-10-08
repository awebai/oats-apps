import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const capRoot = join(root, 'oats-package/capabilities/oats-library');
const refs = join(capRoot, 'skills/library/references');
const manifestBytes = readFileSync(new URL('fixtures/library-live.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const cap = JSON.parse(readFileSync(join(capRoot, 'oats.json')));
const receipt = JSON.parse(readFileSync(new URL('fixtures/argv-receipt.json', import.meta.url)));
const commands = readFileSync(join(refs, 'commands.md'), 'utf8');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(x => x.isDirectory() ? files(join(dir, x.name)) : [join(dir, x.name)]);
const prose = files(capRoot).filter(x => x.endsWith('.md')).map(x => readFileSync(x, 'utf8')).join('\n');

test('exact public manifest fixture and native receipt cover all 23 tools', () => {
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), '0019130d90bbbc61fde49c144b4f883eabac837889b0c69f515d206b35552329');
  assert.equal(manifest.tools.length, 23);
  assert.deepEqual(receipt.tools.map(x => x.name), manifest.tools.map(x => x.name));
  assert.match(receipt.version, /^aw 1\.36\.26/);
  assert.equal(receipt.source_commit, '8d70c50693ce10228ea341f68bc7ebc54a55fa9b');
  for (const [i, row] of receipt.tools.entries()) {
    assert.equal(row.help, 'PASS exact original manifest'); assert.match(row.help_sha256, /^[a-f0-9]{64}$/);
    assert.equal(row.dispatcher, 'PASS'); assert.deepEqual(row.parameters, manifest.tools[i].params);
  }
});
test('curated command table preserves exact tools, body fields, required fields and path/query flags', () => {
  const rows = commands.split('\n').filter(x => /^\| `/.test(x));
  assert.equal(rows.length, 23);
  const names = [];
  for (const row of rows) {
    const [syntax, body, effect] = row.split('|').slice(1, 4).map(x => x.trim());
    const name = syntax.match(/^`([^ \x60]+)/)[1]; names.push(name);
    const tool = manifest.tools.find(t => t.name === name); assert.ok(tool, name);
    const flags = [...syntax.matchAll(/--([a-z_\-]+)/g)].map(x => x[1]).filter(x => x !== 'body-file');
    assert.deepEqual(flags.sort(), tool.params.filter(x => x.in !== 'body').map(x => x.name).sort(), name);
    const fields = body === '—' ? [] : body.split(',').map(x => x.trim());
    const expected = tool.params.filter(x => x.in === 'body').map(x => x.name + (tool.input_schema.required?.includes(x.name) ? '!' : ''));
    assert.deepEqual(fields, expected, name);
    assert.equal(syntax.includes('--body-file'), expected.length > 0, name);
    assert.equal(effect.startsWith('anonymous'), tool.auth === 'none', name);
    if (tool.mutation) assert.ok(!effect.includes(' read'), name);
  }
  assert.deepEqual(names, manifest.tools.map(t => t.name));
});
test('payload stays additive and contains only curated docs/manifest with unique skill identity', () => {
  assert.equal(cap.capability, 'oats.library'); assert.equal(cap.version, '1.0.0'); assert.equal(cap.compatibility.oats, '>=0.47.0');
  assert.deepEqual(cap.skills, ['skills/library']);
  for (const path of files(capRoot)) {
    assert.ok(path.endsWith('.md') || path === join(capRoot, 'oats.json'), path);
    assert.equal(statSync(path).mode & 0o111, 0, 'no executable payload');
  }
  for (const field of ['layer', 'hooks', 'commands', 'binding', 'operations', 'environment']) assert.ok(!(field in cap));
  assert.deepEqual(cap.requires.map(x => x.command), ['aw']);
  assert.match(prose, /oats\.aweb/); assert.match(prose, /aw >=1\.36\.26/);
  const ownName = readFileSync(join(capRoot, 'skills/library/SKILL.md'), 'utf8').match(/^name: (.+)$/m)[1];
  const sibling = join(root, 'oats-package/capabilities/oats-folio');
  for (const path of files(sibling).filter(x => x.endsWith('SKILL.md'))) assert.notEqual(readFileSync(path, 'utf8').match(/^name: (.+)$/m)?.[1], ownName);
});
test('all local Markdown links remain within shipped content and resolve', () => {
  for (const path of files(capRoot).filter(x => x.endsWith('.md'))) {
    for (const [, target] of readFileSync(path, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      assert.ok(!target.includes('://'), 'references should be packaged locally');
      assert.ok(statSync(fileURLToPath(new URL(target, pathToFileURL(path)))).isFile(), target);
    }
  }
});
test('manual security/evidence cases are anchored in controlling prose, not executable readiness', () => {
  const cases = JSON.parse(readFileSync(new URL('fixtures/review-cases.json', import.meta.url)));
  assert.equal(new Set(cases.map(x => x.id)).size, cases.length);
  for (const c of cases) assert.ok(readFileSync(join(refs, c.reference), 'utf8').includes(c.passage), `${c.id}: absent controlling passage`);
  for (const id of ['unsupported', 'missing', 'malformed', 'mismatch', 'empty', 'partial', 'full', 'transport', 'anonymous']) assert.match(cases.find(x => x.id === id).expect, /unknown/);
});
test('no automatic installation/mint/selector-change recipes or raw discovery instructions are composed', () => {
  assert.doesNotMatch(prose, /aw\s+(?:plugin\s+(?:install|update|remove)|id\s+grant\s+(?:create|mint)|team\s+switch)\b/);
  assert.doesNotMatch(prose, /(?:unset|export)\s+(?:AWEB|AW)_/);
  assert.doesNotMatch(prose, /BEGIN (?:ED25519 |OPENSSH )?PRIVATE KEY|\/Users\/|\/home\/[^<]/);
  for (const tool of manifest.tools.filter(x => x.description.length > 90)) assert.ok(!prose.includes(tool.description), 'raw manifest prose copied into instructions');
  assert.match(prose, /never composed|Never compose/);
});
