import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const capRoot = fileURLToPath(new URL('../../oats-package/capabilities/oats-folio/', import.meta.url));
const skillRoot = join(capRoot, 'skills/folio');
const manifest = JSON.parse(readFileSync(new URL('./fixtures/folio-live.json', import.meta.url)));
const read = path => readFileSync(path, 'utf8');
function files(root) { return readdirSync(root).flatMap(name => { const path = join(root, name); return statSync(path).isDirectory() ? files(path) : [path]; }); }

test('distributed payload is curated documentation with contained, resolvable references', () => {
  const cap = JSON.parse(read(join(capRoot, 'oats.json')));
  assert.equal(cap.capability, 'oats.folio'); assert.equal(cap.version, '1.0.0');
  assert.equal(cap.compatibility.oats, '>=0.47.0');
  assert.deepEqual(cap.requires.map(r => r.command), ['aw']);
  assert.deepEqual(cap.skills, ['skills/folio']);
  assert.equal(cap.inject, 'injects/folio.md');
  for (const forbidden of ['layer', 'hooks', 'operations', 'commands', 'binding', 'environment']) assert.ok(!Object.hasOwn(cap, forbidden));
  for (const path of files(capRoot)) {
    assert.ok(path.endsWith('.md') || path === join(capRoot, 'oats.json'), 'no executable or raw manifest in payload');
    assert.ok(!(statSync(path).mode & 0o111), 'payload files are not executable');
  }
  for (const path of files(skillRoot)) {
    for (const match of read(path).matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1]; assert.ok(!target.includes('://'), 'skill references stay self-contained');
      assert.ok(statSync(new URL(target, 'file://' + path)).isFile());
    }
  }
  assert.match(read(join(skillRoot, 'SKILL.md')), /^---\nname: folio\ndescription: .+\n---\n/);
});

test('curated contract matches every manifest tool, path, location, type, and requirement', () => {
  const contract = read(join(skillRoot, 'references/commands.md'));
  const rows = contract.split('\n').filter(line => /^\| `[a-z-]+` \| (GET|POST|PUT)/.test(line));
  assert.equal(rows.length, 14);
  for (const tool of manifest.tools) {
    const row = rows.find(line => line.startsWith(`| \`${tool.name}\` |`)); assert.ok(row, tool.name);
    const cells = row.split('|').slice(1, -1).map(s => s.trim());
    assert.equal(cells[1], `${tool.method} \`${tool.path}\``);
    assert.equal(cells[4], `${tool.mutation ? 'yes' : 'no'} / ${tool.scopes[0]}`);
    const properties = tool.input_schema.properties;
    const required = tool.input_schema.required || [];
    const documentedFlags = [...cells[2].matchAll(/`--([^`]+)` (string|integer|boolean|object)/g)].map(m => [m[1], m[2]]);
    const documentedBody = [...cells[3].matchAll(/`([^`]+)`: (string|integer|boolean|object)(\*)?/g)].map(m => [m[1], m[2], !!m[3]]);
    assert.deepEqual(documentedFlags, tool.params.filter(p => p.in === 'path').map(p => [p.name, properties[p.name].type]), tool.name);
    assert.deepEqual(documentedBody, tool.params.filter(p => p.in === 'body').map(p => [p.name, properties[p.name].type, required.includes(p.name)]), tool.name);
    assert.ok(tool.params.every(p => ['path', 'body'].includes(p.in)));
  }
});

test('empty inventory and explicit exclusion stay separate authority observations', () => {
  const rows = read(join(skillRoot, 'references/seat-and-evidence.md')).split('\n').filter(line => line.startsWith('| ')).map(line => line.split('|').slice(1, -1).map(s => s.trim()));
  const row = observation => rows.find(cells => cells[0] === observation);
  assert.deepEqual(row('Valid matching empty inventory'), ['Valid matching empty inventory', 'None included', 'Unknown']);
  assert.deepEqual(row('Matching mint output lists `folio` in `skipped_apps`'), ['Matching mint output lists `folio` in `skipped_apps`', 'Excluded at mint', 'No for that exclusion; other authority unproven']);
  const emptyCase = JSON.parse(read(new URL('./adversarial-cases.json', import.meta.url))).find(c => /no tools were included/.test(c.request));
  assert.doesNotMatch(emptyCase.expected, /no for/i);
});

test('payload states custody rules without spelling out resident custody file layout', () => {
  for (const path of files(capRoot)) assert.doesNotMatch(read(path), /app-tools\.json|app-approvals\.json|grants\/<|tools: string\[\]/, path);
});
