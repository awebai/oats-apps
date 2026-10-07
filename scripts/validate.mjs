import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const packageSchema = ajv.compile(json(join(repository, 'schemas/oats-package.schema.json')));
const capabilitySchema = ajv.compile(json(join(repository, 'schemas/capability-manifest.schema.json')));
function assert(condition, message) { if (!condition) throw new Error(message); }
function schema(check, value, label) {
  assert(check(value), `${label}: ${ajv.errorsText(check.errors)}`);
}
function contained(root, path, type) {
  assert(typeof path === 'string' && path.length && !isAbsolute(path) && !/^[A-Za-z]:/.test(path) && !/[\\\0]/.test(path) && !path.split('/').some(x => x === '..' || x === '.' || !x), 'resource must be a contained relative path');
  const base = realpathSync(root), target = realpathSync(join(root, path));
  assert(target.startsWith(base + sep), 'resource escapes its capability root');
  const stat = statSync(target);
  assert(type === 'directory' ? stat.isDirectory() : stat.isFile(), `expected ${type}`);
  return target;
}
function tree(root, path, ancestors = new Set()) {
  const target = realpathSync(path);
  assert(target === root || target.startsWith(root + sep), 'resource tree escapes its capability root');
  assert(!ancestors.has(target), 'resource tree has a symlink cycle');
  const stat = statSync(target);
  assert(stat.isDirectory() || stat.isFile(), 'resource must be a regular file or directory');
  if (stat.isDirectory()) for (const item of readdirSync(target)) tree(root, join(target, item), new Set([...ancestors, target]));
}
export function validate(root = repository) {
  const payload = realpathSync(join(root, 'oats-package'));
  const pkg = json(contained(payload, 'oats-package.json', 'file'));
  schema(packageSchema, pkg, 'package');
  assert(pkg.package === 'oats.apps', 'wrong package identity');
  const expected = ['capabilities/oats-folio', 'capabilities/oats-library'];
  assert(JSON.stringify(pkg.capabilities) === JSON.stringify(expected), 'package must export the two dedicated app roots');
  assert(!pkg.souls, 'member expert must not be distributed as a package soul');
  assert(json(join(root, 'package.json')).version === pkg.version, 'root/package versions differ');
  for (const dir of expected) {
    const capRoot = contained(payload, dir, 'directory');
    tree(capRoot, capRoot);
    const cap = json(contained(capRoot, 'oats.json', 'file'));
    schema(capabilitySchema, cap, dir);
    assert(cap.capability === dir.replace('capabilities/oats-', 'oats.'), 'wrong capability identity');
    assert(cap.version === pkg.version && cap.compatibility?.oats === pkg.compatibility.oats, 'version/floor mismatch');
    for (const key of ['layer', 'hooks', 'commands', 'command', 'binding', 'operations', 'agents', 'environment', 'helperInjection']) assert(!Object.hasOwn(cap, key), `${key} is outside the additive documentation-only v1 surface`);
    if (cap.inject !== undefined) contained(capRoot, cap.inject, 'file');
    for (const skill of cap.skills || []) {
      const dir = contained(capRoot, skill, 'directory');
      contained(dir, 'SKILL.md', 'file');
    }
  }
  return pkg;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const pkg = validate(); console.log(`Validated ${pkg.package}@${pkg.version}: two additive capabilities.`); }
  catch (error) { console.error(`Validation failed: ${error.message}`); process.exitCode = 1; }
}
