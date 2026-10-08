// Real pinned dispatcher against synthetic loopback state; never an app acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
const exec = promisify(execFile);
const raw = readFileSync(new URL('./fixtures/folio-live.json', import.meta.url));
const manifest = JSON.parse(raw);
export const manifestHash = '480b157753e1ecc9cd257daf70a35b97c5943960d69183971c32498b48c313e3';
const markdown = '# Synthetic UTF-8 café\n$(never-execute) `literal`\n' + 'A paragraph.\n'.repeat(400);
export const cases = [
  ['create', [], { slug: 'fixture', title: 'Synthetic', body: markdown, template: { name: 'fixture', slots: {} } }, 'POST', '/v1/documents'],
  ['list', [], undefined, 'GET', '/v1/documents'],
  ['show', ['--slug', 'fixture'], undefined, 'GET', '/v1/documents/fixture'],
  ['versions', ['--slug', 'fixture'], undefined, 'GET', '/v1/documents/fixture/versions'],
  ['append', ['--slug', 'fixture'], markdown, 'POST', '/v1/documents/fixture/versions'],
  ['append-template', ['--slug', 'fixture'], { name: 'fixture', slots: { text: markdown } }, 'POST', '/v1/documents/fixture/versions/template'],
  ['present', [], { slug: 'fixture', version: 7, ttl_seconds: 300, editable: false }, 'POST', '/v1/present'],
  ['revoke', ['--token', 'synthetic-token'], undefined, 'POST', '/v1/present/synthetic-token/revoke'],
  ['theme-get', [], undefined, 'GET', '/v1/theme'],
  ['theme-set', [], { tokens: { color: 'fixture' }, preset: 'fixture', logo: {}, clear_logo: false, header: 'Synthetic', footer: 'Synthetic' }, 'PUT', '/v1/theme'],
  ['asset-image', [], { content_type: 'image/png', data_base64: 'c3ludGhldGlj' }, 'POST', '/v1/assets'],
  ['asset-video', [], { content_type: 'video/mp4', filename: 'fixture.mp4', max_duration_seconds: 5 }, 'POST', '/v1/assets/video/direct-upload'],
  ['asset-get', ['--asset_id', 'fixture'], undefined, 'GET', '/v1/assets/fixture'],
  ['billing', [], undefined, 'GET', '/v1/billing'],
];
function did(publicKey) {
  const bytes = Buffer.concat([Buffer.from([0xed, 1]), publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)]);
  let n = BigInt('0x' + bytes.toString('hex')), out = '';
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  while (n) { out = alphabet[Number(n % 58n)] + out; n /= 58n; }
  return 'did:key:z' + out;
}
function canonical(obj) { return JSON.stringify(Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))); }

test('exact Folio evidence bytes and finite inventory', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), manifestHash);
  assert.deepEqual(cases.map(c => c[0]), manifest.tools.map(t => t.name));
  assert.equal(manifest.tools.length, 14);
});

test('aw 1.36.26 literal help, dispatch, body types, and refusals', { skip: !process.env.FOLIO_AW_BINARY, timeout: 60000 }, async () => {
  const binary = realpathSync(resolve(process.env.FOLIO_AW_BINARY));
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'folio-native-')));
  const store = join(scratch, '.aw');
  const plugin = join(store, 'plugins/folio/manifest.json');
  function put(path, value) { mkdirSync(resolve(path, '..'), { recursive: true, mode: 0o700 }); writeFileSync(path, value, { mode: 0o600 }); }
  // An allowlist constructs a new synthetic process context; no host selector or secret is inherited.
  const env = { HOME: scratch, AW_HOME: store, AW_NO_UPDATE_CHECK: '1', PATH: '/usr/bin:/bin', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1' };
  const run = (...args) => exec(binary, args, { cwd: scratch, env, timeout: 6000 });
  const seen = [];
  const server = createServer(async (req, res) => {
    const parts = []; for await (const part of req) parts.push(part);
    seen.push({ method: req.method, path: req.url, body: Buffer.concat(parts).toString(), contentType: req.headers['content-type'], signed: !!req.headers.authorization, certificate: !!req.headers['x-awid-team-certificate'] });
    res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true,"version":7}');
  });
  try {
    const version = (await run('version')).stdout;
    assert.match(version, /^aw 1\.36\.26\n/);
    assert.match(version, /8d70c50693ce10228ea341f68bc7ebc54a55fa9b/);
    const binaryHash = createHash('sha256').update(readFileSync(binary)).digest('hex');
    console.log(`Pinned native binary sha256=${binaryHash}; source=8d70c50693ce10228ea341f68bc7ebc54a55fa9b; manifest=${manifestHash}`);
    put(plugin, raw);
    for (const tool of manifest.tools) {
      const help = (await run('folio', tool.name, '--help')).stdout;
      for (const param of tool.params) assert.ok(help.includes('--' + param.name), `${tool.name}: ${param.name}`);
      if (tool.body) assert.match(help, /--body-file/);
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Only the origin differs for dispatch. Auth, tool definitions, and schemas stay exact.
    put(plugin, raw.toString().replace('https://folio.aweb.ai', origin));
    const member = generateKeyPairSync('ed25519'), controller = generateKeyPairSync('ed25519');
    const memberDid = did(member.publicKey), team = 'fixture:example.invalid';
    const certPath = 'team-certs/fixture__example.invalid.pem';
    const certificate = { version: 1, certificate_id: randomUUID(), team_id: team, team_did_key: did(controller.publicKey), member_did_key: memberDid, alias: 'fixture', identity_scope: 'local', issued_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
    certificate.signature = sign(null, Buffer.from(canonical(certificate)), controller.privateKey).toString('base64').replace(/=+$/, '');
    put(join(store, certPath), JSON.stringify(certificate));
    const seed = member.privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64');
    put(join(store, 'signing.key'), `-----BEGIN ED25519 PRIVATE KEY-----\n${seed}\n-----END ED25519 PRIVATE KEY-----\n`);
    const membership = { team_id: team, alias: 'fixture', workspace_id: 'fixture', cert_path: certPath };
    put(join(store, 'workspace.yaml'), JSON.stringify({ aweb_url: origin, memberships: [membership] }));
    put(join(store, 'teams.yaml'), JSON.stringify({ active_team: team, memberships: [{ team_id: team, alias: 'fixture', cert_path: certPath }] }));
    for (const [verb, flags, body, method, path] of cases) {
      const args = ['folio', verb, ...flags];
      if (body !== undefined) { const file = join(scratch, 'body'); put(file, typeof body === 'string' ? body : JSON.stringify(body)); args.push('--body-file', file); }
      await run(...args);
      const actual = seen.at(-1);
      assert.equal(actual.method, method); assert.equal(actual.path, path);
      assert.ok(actual.signed && actual.certificate);
      if (typeof body === 'string') { assert.equal(actual.body, body); assert.equal(actual.contentType, 'text/markdown; charset=utf-8'); }
      else if (body !== undefined) { assert.deepEqual(JSON.parse(actual.body), body); assert.match(actual.contentType, /application\/json/); }
      else assert.equal(actual.body, '');
    }
    assert.equal(seen.length, 14);
    const file = join(scratch, 'body');
    put(file, JSON.stringify({ slug: 'fixture', title: 'file' }));
    await run('folio', 'create', '--body-file', file, '--title', 'override');
    assert.equal(JSON.parse(seen.at(-1).body).title, 'override');
    const refusals = [
      [['show'], /missing path param "slug"/], [['versions'], /missing path param "slug"/],
      [['append-template', '--body-file', file], /missing path param "slug"/],
      [['revoke'], /missing path param "token"/], [['asset-get'], /missing path param "asset_id"/],
      [['asset-get', '--asset-id', 'fixture'], /unknown flag.*asset-id/],
      [['show', 'fixture'], /unexpected positional/],
      [['present', '--slug', 'fixture', '--version', 'bad'], /body param version: strconv.ParseInt/],
      [['append', '--slug', 'fixture'], /missing raw body param "body"/],
    ];
    const count = seen.length;
    for (const [args, pattern] of refusals) await assert.rejects(run('folio', ...args), error => { assert.match(error.stderr, pattern); return true; });
    put(file, '[]');
    await assert.rejects(run('folio', 'create', '--body-file', file), error => { assert.match(error.stderr, /JSON object/); return true; });
    assert.equal(seen.length, count, 'invalid argv must not reach HTTP');
    // The pinned client does not enforce required JSON body fields. This is a
    // recorded boundary, not permission to omit them in a service request.
    for (const args of [['create', '--slug', 'fixture'], ['asset-image', '--content_type', 'image/png'], ['asset-video']]) await run('folio', ...args);
    assert.equal(seen.length, count + 3);
    console.log('14 exact-manifest help + 14 loopback signed dispatches; JSON override, 10 pre-HTTP refusals, 3 missing-JSON-required-field dispatches. Synthetic credentials only; no live service authority or acceptance claim.');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(scratch, { recursive: true, force: true }); }
});
