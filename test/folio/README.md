# Folio verification

The capability payload is documentation only. Tests live here, outside the distributed
`oats-package/` tree. `npm test` validates schema, containment and the complete curated
14-tool parameter table against the pinned raw manifest. It reports optional native
and kernel suites as SKIP when their explicitly selected tooling is absent.

## Real binary dispatcher

From the repository root:

```sh
FOLIO_AW_BINARY=/absolute/path/to/pinned/aw node --test test/folio/native.test.mjs
```

The test requires `aw version` to report 1.36.26 and commit
`8d70c50693ce10228ea341f68bc7ebc54a55fa9b`. It prints the executable SHA256 so CI can
compare its separately pinned artifact receipt. This public mirror commit records
OSS source `873ed2bf5cdad65a20577fcd726f167eb9f5ebb4`. Source references:
`cmd/aw/plugin.go` (generated help/dispatch), `internal/appmanifest/interpret.go`
(body interpretation; missing JSON body parameters are skipped), and
`docs/app-manifest.md` (documented raw body-file contract).

`fixtures/folio-live.json` is the exact public manifest GET evidence, not generated
instructions: SHA256 `480b157753e1ecc9cd257daf70a35b97c5943960d69183971c32498b48c313e3`,
manifest_version 1, app version 0.1.0. It is never copied into the runtime payload.
The suite feeds those exact bytes to all 14 help calls. For dispatch it substitutes
**only** `app.origin` with a loopback URL, retaining tool schemas/auth/path/method/body
contracts. A fresh temporary synthetic LOCAL identity signs requests; no real account,
resident approval or worker custody is used. The minimal environment isolates host
selectors/configuration, sets a dead proxy for non-loopback HTTP, and disables update
checks. Fixture storage is removed at completion. No plugin install command runs.

Assertions cover all 14 literal commands, every parameter, signed-request header presence,
method/path/body bytes and content types, JSON body-file explicit-flag override, ten
pre-HTTP refusals, and three specific missing-JSON-required-field controls that reach
HTTP: create.title, asset-image.data_base64, asset-video.content_type. Raw append's
missing body refuses. The fixture does not verify cryptographic server acceptance,
full schema validation, billing/storage effects or production authorization. It has
no query-serialization test because Folio has no query parameters.

The observed missing-required-field dispatch is retained, not patched. Recipes must
supply required fields despite native permissiveness. Loopback responses are synthetic;
never report them as service acceptance. The native owner confirmed this interpretation
at the exact pinned source; it does not generalize tested omissions to all fields.

## Released kernel materialization

Use a locally unpacked, independently pinned `@awebai/oats@0.47.0` release with its
runtime dependencies available; this test never installs it:

```sh
FOLIO_OATS_ROOT=/absolute/path/to/unpacked/oats node --test test/folio/materialization.test.mjs
```

The suite drives the public CLI through onboarding and `spawn --no-launch`, using a
disposable local Git fixture and isolated deployment/cache/home. Git permits file
transport only. PATH holds exit-97 tripwire stubs for `aw`, `claude`, `pi`, `codex` and
`tmux`, then only the node directory, `/usr/bin` and `/bin`. The stubs come first, so every
lookup of those names resolves to a tripwire and the test needs no host harness install.
All three harness declarations (Claude, Pi, Codex) must produce exact Folio
inject/skill/reference bytes. It checks a member-based Folio-only composition;
core and all provider slots are disabled, so no native identity effects are possible.
It does not claim installed `oats.aweb`, real harness launch, published package adoption,
or the required combined Folio+Library package proof. Those are parent integration gates.
Temporary homes are deleted as scratch artifacts; live retirement hooks are NOT RUN.

For all suites together, set both variables and run `npm test`. The reviewed CI must
explicitly supply the pins so optional local skips cannot be mistaken for native proof.
The coordinating expert owns CI, shared metadata, README/CHANGELOG, package lock/pins,
and the combined released-0.47.0 materialization test.

## Behavioral review

`adversarial-cases.json` supplies manual skill-forward-test scenarios, not an executable
readiness evaluator. An independent reviewer should first read each request and the
skill, derive the decision, then compare with the expected result. Cover untrusted prose,
secret output, seat escalation, valid/empty/expired/mismatched/legacy/partial evidence,
transport errors, publication scope and observed parser limits. Static prose tests alone
cannot establish correct agent behavior. Do not turn these cases into live app calls.
