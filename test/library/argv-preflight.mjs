// Opt-in native CLI contract probe. All identities and requests are synthetic.
// No host environment, identity, plugin store, or service endpoint is inherited.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
const exec = promisify(execFile);
if (!process.argv[2]) {
  const { test } = await import('node:test');
  test('Pinned aw executable preflight', { skip: 'Run this file explicitly with the pinned executable path; see README.md' }, () => {});
} else {
const binary = realpathSync(resolve(process.argv[2] || 'missing-aw-binary'));
const digest = data => createHash('sha256').update(data).digest('hex');
const rawManifest = readFileSync(new URL('fixtures/library-live.json', import.meta.url));
assert.equal(digest(rawManifest), '0019130d90bbbc61fde49c144b4f883eabac837889b0c69f515d206b35552329');
const manifest = JSON.parse(rawManifest);
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'library-argv-')));
const env = { HOME: scratch, AW_HOME: join(scratch, '.aw'), AW_CONFIG_PATH: join(scratch, 'absent-config.yaml'), PATH: '/usr/bin:/bin', TMPDIR: scratch };
const captures = [];
const server = createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  captures.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString(), signed: Boolean(req.headers.authorization), certificate: Boolean(req.headers['x-awid-team-certificate']) });
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"fixture":true}');
});
const run = async args => {
  try { const r = await exec(binary, args, { cwd: scratch, env, timeout: 10000 }); return { code: 0, out: r.stdout, err: r.stderr }; }
  catch (r) { return { code: r.code, out: r.stdout || '', err: r.stderr || '' }; }
};
const ok = async args => { const r = await run(args); assert.equal(r.code, 0, `${args.join(' ')}: ${r.err}`); return r; };
const fail = async (args, pattern) => {
  const count = captures.length, r = await run(args);
  assert.notEqual(r.code, 0, args.join(' ')); assert.match(r.err, pattern); assert.equal(captures.length, count, 'invalid argv reached transport');
  return r.err.trim();
};
// Base58 multicodec Ed25519 DID for an ephemeral local fixture, never registered.
function did(publicKey) {
  const bytes = Buffer.concat([Buffer.from([0xed, 0x01]), publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)]);
  let n = BigInt('0x' + bytes.toString('hex')), out = ''; const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  while (n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; }
  return 'did:key:z' + out;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
try {
  const version = (await ok(['version'])).out;
  assert.match(version, /^aw 1\.36\.26\n/); assert.match(version, /8d70c50693ce10228ea341f68bc7ebc54a55fa9b/);
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fixture = structuredClone(manifest); fixture.app.origin = origin;
  const plugin = join(scratch, '.aw/plugins/library'); mkdirSync(plugin, { recursive: true });
  // Fixture injection, not a plugin install or an approval. Only origin differs.
  writeFileSync(join(plugin, 'manifest.json'), rawManifest);
  const exactHelp = {};
  for (const tool of manifest.tools) exactHelp[tool.name] = (await ok(['library', tool.name, '--help'])).out;
  assert.equal(captures.length, 0, 'exact-manifest help must not contact service');
  writeFileSync(join(plugin, 'manifest.json'), JSON.stringify(fixture));
  const member = generateKeyPairSync('ed25519'), controller = generateKeyPairSync('ed25519');
  const memberDID = did(member.publicKey), team = 'default:fixture.invalid';
  const cert = { version: 1, certificate_id: randomUUID(), team_id: team, team_did_key: did(controller.publicKey), member_did_key: memberDID, alias: 'fixture', identity_scope: 'local', issued_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
  cert.signature = sign(null, Buffer.from(canonical(cert)), controller.privateKey).toString('base64').replace(/=+$/, '');
  mkdirSync(join(scratch, '.aw/team-certs'), { recursive: true });
  writeFileSync(join(scratch, '.aw/team-certs/default__fixture.invalid.pem'), JSON.stringify(cert), { mode: 0o600 });
  const seed = member.privateKey.export({ format: 'jwk' }).d;
  writeFileSync(join(scratch, '.aw/signing.key'), `-----BEGIN ED25519 PRIVATE KEY-----\n${Buffer.from(seed, 'base64url').toString('base64')}\n-----END ED25519 PRIVATE KEY-----\n`, { mode: 0o600 });
  const membership = `  - team_id: ${team}\n    alias: fixture\n    workspace_id: fixture\n    cert_path: team-certs/default__fixture.invalid.pem\n`;
  writeFileSync(join(scratch, '.aw/workspace.yaml'), `aweb_url: ${origin}\nmemberships:\n${membership}`);
  writeFileSync(join(scratch, '.aw/teams.yaml'), `active_team: ${team}\nmemberships:\n${membership}`);
  const values = { tags: ['alpha', 'beta'], files: [{ path: 'instructions.md', content_utf8: 'fixture data only' }], schema: 'fixture', content: { schema: 'aweb.library.profile-asset-changeset.v1', assets: [{ path: 'instructions.md', content_utf8: 'fixture', base_asset_digest: 'sha256:fixture' }] }, new_blueprint: { ref: 'fixture' }, target: 'custodial', runtime_kind: 'fixture' };
  const receipt = { version: version.trim(), binary_sha256: digest(readFileSync(binary)), manifest_sha256: digest(rawManifest), source_commit: '8d70c50693ce10228ea341f68bc7ebc54a55fa9b', upstream_commit: '873ed2bf5cdad65a20577fcd726f167eb9f5ebb4', fixture: 'origin-only loopback rewrite; synthetic LOCAL signing identity; no service authority tested', tools: [], errors: {} };
  const bodyPath = join(scratch, 'body.json');
  for (const tool of manifest.tools) {
    const help = { out: exactHelp[tool.name] };
    for (const param of tool.params) assert.ok(help.out.includes('--' + param.name), `${tool.name} help missing ${param.name}`);
    const args = ['library', tool.name], body = {}, query = [];
    let path = tool.path;
    for (const param of tool.params) {
      const value = values[param.name] ?? 'fixture';
      if (param.in === 'body') body[param.name] = value;
      else if (param.in === 'path') { args.push('--' + param.name, value); path = path.replace('{' + param.name + '}', value); }
      else for (const item of Array.isArray(value) ? value : [value]) { args.push('--' + param.name, item); query.push(`${param.name}=${item}`); }
    }
    if (Object.keys(body).length) { writeFileSync(bodyPath, JSON.stringify(body)); args.push('--body-file', bodyPath); }
    const count = captures.length; await ok(args); assert.equal(captures.length, count + 1);
    const capture = captures.at(-1);
    assert.equal(capture.method, tool.method); assert.equal(capture.url, path + (query.length ? '?' + query.join('&') : ''));
    assert.deepEqual(capture.body ? JSON.parse(capture.body) : {}, body);
    assert.equal(capture.signed, tool.auth !== 'none'); assert.equal(capture.certificate, tool.auth !== 'none');
    receipt.tools.push({ name: tool.name, help: 'PASS exact original manifest', help_sha256: digest(help.out), dispatcher: 'PASS', method: capture.method, auth: tool.auth || 'team-cert', parameters: tool.params });
    for (const p of tool.params.filter(p => p.in === 'path')) {
      const omitted = args.slice(); const index = omitted.indexOf('--' + p.name); omitted.splice(index, 2);
      await fail(omitted, new RegExp(`missing path param "${p.name}"`));
    }
  }
  receipt.errors.positional = await fail(['library', 'get-blueprint', 'fixture'], /unexpected positional argument/);
  receipt.errors.hyphen_alias = await fail(['library', 'get-blueprint', '--blueprint-ref', 'fixture'], /unknown flag/);
  receipt.errors.missing_value = await fail(['library', 'get-blueprint', '--blueprint_ref'], /missing value/);
  writeFileSync(bodyPath, '# raw Markdown');
  receipt.errors.raw_markdown = await fail(['library', 'register', '--body-file', bodyPath], /single JSON object/);
  writeFileSync(bodyPath, '[]');
  receipt.errors.array_body = await fail(['library', 'register', '--body-file', bodyPath], /JSON object/);
  writeFileSync(bodyPath, '{} {}');
  receipt.errors.trailing_json = await fail(['library', 'register', '--body-file', bodyPath], /single JSON object/);
  writeFileSync(bodyPath, '{"display_name":"file","owner":"fixture"}');
  await ok(['library', 'register', '--body-file', bodyPath, '--display_name', 'flag']);
  assert.equal(JSON.parse(captures.at(-1).body).display_name, 'flag');
  receipt.body_flag_override = 'PASS';
  await ok(['library', 'create-shelf-profile', '--files', '[]', '--tags', '["one","two"]']);
  assert.deepEqual(JSON.parse(captures.at(-1).body).tags, ['one', 'two']);
  receipt.array_body_flag = 'JSON array';
  receipt.errors.invalid_array_flag = await fail(['library', 'create-shelf-profile', '--files', 'not-json'], /body param files: expected array/);
  receipt.errors.invalid_object_flag = await fail(['library', 'propose', '--content', '[]'], /body param content: expected object/);
  await ok(['library', 'list-blueprints', '--tags', '["one","two"]']);
  assert.equal(captures.at(-1).url, '/v1/blueprints?tags=%5B%22one%22%2C%22two%22%5D');
  receipt.array_query = 'Repeated --tags yields repeated query keys; JSON-looking value is a literal query string, not parsed';
  await ok(['library', 'publish-blueprint']);
  assert.equal(captures.at(-1).body, '');
  receipt.required_body = 'publish-blueprint omitting files and schema reached loopback with empty body; only these omissions exercised; service validation NOT RUN';
  assert.equal(manifest.tools.filter(t => t.body?.mode === 'raw').length, 0);
  receipt.raw_body = 'No Library raw-mode tool; Markdown JSON body refusal verified';
  console.log(JSON.stringify(receipt, null, 2));
} finally { await new Promise(done => server.close(done)); rmSync(scratch, { recursive: true, force: true }); }

}
