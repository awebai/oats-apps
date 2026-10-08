# Library verification

`npm test` runs packaging/schema checks and the Library content contract tests.
They compare the curated command table against the exact public manifest and
check documentation boundaries. These tests are not an agent behavior evaluator,
a delegation implementation, or service acceptance.

To reproduce the native argv proof, explicitly supply the exact aw binary:

```text
node test/library/argv-preflight.mjs <absolute-aw-1.36.26-binary>
```

The probe refuses other version/commit reports. It uses an isolated child process
environment, temporary plugin store and generated synthetic LOCAL signing
identity, then removes the scratch files. It uses exact manifest bytes for help,
and changes only app.origin for loopback dispatcher requests. It does not call
plugin install, approve a resident app, mint a grant, or contact a business
service. The loopback endpoint records only synthetic request data and auth
presence, not headers/signatures. No real credentials are used or retained.

The receipt records binary/hash/source and per-tool exact-help hashes. The
manifest is test data only; its descriptions are never composed as instructions.
The exact manifest came from the task's public Library evidence, corresponding
to Library source `565d1e69bd8fee27ba99f374141e1b74e3d8cbf0`; native source is
public mirror `8d70c50693ce10228ea341f68bc7ebc54a55fa9b`, whose commit identifies
upstream `873ed2bf5cdad65a20577fcd726f167eb9f5ebb4`.

Required body omission coverage is deliberately specific: publish-blueprint with
both files/schema absent reaches HTTP with an empty body. Required path omissions
for every path tool fail before transport. Literal underscore flags, rejection
of positionals/hyphen aliases, repeated-query versus JSON-string serialization,
body-file object parsing, explicit flag overrides, and body array/object flag
coercion are exercised. Library has no raw-mode or integer field, so no such
positive cases are claimed. Service schema validation, grant custody/current
authority, local-target materialization and live app workflows are NOT RUN.

`review-cases.json` is the manual adversarial/security review matrix for the
curated prose. The content tests ensure each case points to its controlling
passage; an independent reviewer assesses the expected behavior. They do not
claim an automated model followed those rules. Missing, invalid, partial,
mismatched and expired evidence cases are intentionally documentation decisions,
not a shipped readiness executable.

Real released OATS 0.47.0 scratch materialization must also be run using
`materialize.mjs` with an explicit kernel entry path. It performs no-launch
spawns with inert local provider fixtures across Claude, Pi and Codex. Its
scope is single-capability content copying and soul composition, not actual
provider effects, runtime admission, or published package adoption. The parent
owns the separate combined-capability CI gate and actual release process.
