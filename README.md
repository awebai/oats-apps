# oats.apps

One OATS package with two independently selectable additive capabilities:
`oats.folio` and `oats.library`. This PR is structural scaffolding only: neither
capability contains app instructions yet, and v1.0.0 has not been released.

The planned v1 ships curated injects and skills, with no executable hooks,
readiness check or slot provider. Composition must select `oats.aweb` separately;
`aw >=1.36.26` and resident approval are documented workflow prerequisites.
The manifest host-command requirement checks presence, not version or authority.
OATS 0.47.0 is the initial materialization test target; the declared floor must
be confirmed by content/materialization tests before release. No earlier floor,
installed adoption or app workflow acceptance is claimed by this scaffold.

A host plugin installation, resident approval, recorded grant snapshot and current
authority are different evidence. The future skills will describe supported
read-only observations and unknown states without probing business operations.
Additive readiness is a separate future contract: [oats#775](https://github.com/awebai/oats/issues/775).

## Development

Use Node.js 22, `npm ci`, then `npm test`. Validation checks canonical schema
snapshots, both exports, containment and the documentation-only surface. CI runs
validation, syntax checks and scaffold tests. Build content only after both
maintainers approve this scaffold; one developer owns each capability directory.
The member soul `oats-apps-expert` follows the package-expert convention and is
separate from the versioned distribution payload. Its knowledge ownership must
be assigned through workspace governance, not fabricated by this repository.

Maintainers publish the reviewed v1.0.0 tag after content acceptance; catalog,
generated mirrors and clean-room smoke integration follow in a separate OATS PR.
This repository never installs apps for residents or changes app services.
