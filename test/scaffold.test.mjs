import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../scripts/validate.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'oats-apps-'));
  try { cpSync(join(root, 'oats-package'), join(dir, 'oats-package'), { recursive: true }); cpSync(join(root, 'package.json'), join(dir, 'package.json')); fn(dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
function change(dir, fn) {
  const file = join(dir, 'oats-package/capabilities/oats-folio/oats.json');
  const cap = JSON.parse(readFileSync(file, 'utf8')); fn(cap); writeFileSync(file, JSON.stringify(cap));
}
test('both independently named additive exports validate', () => assert.equal(validate().capabilities.length, 2));
test('slot claims and executable surfaces are refused', () => {
  for (const [key, value] of Object.entries({ layer: 'messaging', hooks: { launch: 'run.mjs' }, commands: { check: 'run.mjs' } })) fixture(dir => {
    change(dir, cap => { cap[key] = value; }); assert.throws(() => validate(dir), /documentation-only/);
  });
});
test('invented dependency fields and unknown schema properties fail', () => {
  fixture(dir => { change(dir, cap => { cap.requires = [{ capability: 'oats.aweb' }]; }); assert.throws(() => validate(dir)); });
  fixture(dir => { change(dir, cap => { cap.readiness = 'check.mjs'; }); assert.throws(() => validate(dir)); });
});
test('declared resources cannot escape the owning capability, including symlinks', () => {
  fixture(dir => { change(dir, cap => { cap.inject = '../../oats-package.json'; }); assert.throws(() => validate(dir), /contained relative/); });
  fixture(dir => { const capRoot = join(dir, 'oats-package/capabilities/oats-folio'); symlinkSync(resolve(dir, 'package.json'), join(capRoot, 'escape.md')); change(dir, cap => { cap.inject = 'escape.md'; }); assert.throws(() => validate(dir), /escapes/); });
});
