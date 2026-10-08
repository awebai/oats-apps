# oats.apps

One OATS package with two independently selectable additive capabilities:
`oats.folio` and `oats.library`. Each teaches an existing aweb app through
`aw folio …` or `aw library …`. v1.0.0 has not been released yet.

v1 ships curated injects and skills, with no executable hooks, readiness check
or slot provider. Composition must select `oats.aweb` separately;
`aw >=1.36.26` and resident approval are documented workflow prerequisites.
The manifest host-command requirement checks presence, not version or authority.
The command contracts are verified against aw 1.36.26, and the OATS floor
`>=0.47.0` is proved by CI against the released OATS 0.47.0 (see Development).
No earlier floor, installed adoption, live app acceptance or service validation
is claimed.

A host plugin installation, resident approval, recorded grant snapshot and current
authority are different evidence. The skills describe supported read-only
observations and unknown states without probing business operations.
Additive readiness is a separate future contract: [oats#775](https://github.com/awebai/oats/issues/775).

## Development

Use Node.js 22, `npm ci`, then `npm test`. Validation checks canonical schema
snapshots, both exports, containment and the documentation-only surface; the
static content tests check each curated command table against the app manifest.
One developer owns each capability directory and its `test/` subtree.

The pinned suites skip under plain `npm test` and need explicit pins:

```bash
FOLIO_AW_BINARY=<aw 1.36.26> FOLIO_OATS_ROOT=<unpacked @awebai/oats@0.47.0> \
OATS_APPS_KERNEL=<that package>/bin/oats.mjs \
  node --test test/folio/native.test.mjs test/folio/materialization.test.mjs test/package/materialization.test.mjs
node test/library/argv-preflight.mjs <aw 1.36.26>
node test/library/materialize.mjs <that package>/bin/oats.mjs
```

CI's `pinned-floor` job fetches `@awebai/aw-linux-x64@1.36.26` and
`@awebai/oats@0.47.0` from the registry and checks each against its pinned
integrity. It runs all five suites and fails if any of them skips.
`test/package/materialization.test.mjs` resolves and locks the whole package
from a local Git tag, then spawns without launch for Claude, Pi and Codex: both
capabilities together, and each alone. The messaging slot there is an inert
fixture, not `oats.aweb`. No suite launches a harness, runs a provider hook or
contacts an app.
The member soul `oats-apps-expert` follows the package-expert convention and is
separate from the versioned distribution payload. It explicitly selects `knowledge: none` in v1. Its OKF owner/node and soul
binding come together in later reviewed knowledge-base and soul changes, with
both maintainer verdicts; no placeholder owner or empty node is shipped.

Maintainers publish the reviewed v1.0.0 tag after content acceptance; catalog,
generated mirrors and clean-room smoke integration follow in a separate OATS PR.
This repository never installs apps for residents or changes app services.
