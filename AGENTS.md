# Working on oats.apps

The distributed payload is oats-package/. One package exports two additive
capabilities, each self-contained in its own directory. The member expert soul
lives under souls/ and is not distributed as a package soul.

Run npm ci, npm test before handoff. Keep the schema snapshots pinned to the
source named in schemas/README.md; do not change them to make a manifest pass.
No layer, hooks, commands, binding or operations in v1. Document oats.aweb
composition and aw>=1.36.26 as prerequisites; no capability dependency field is
supported. Never put host paths, credentials or raw app content in this repo.

Folio and Library content developers own their respective capability directories
and app-specific test directories. Shared package metadata, validators, CI and
release notes stay with the coordinating expert; request changes rather than
editing another developer's surface. Both maintainers review each PR. No live
installs, app operations, tags or deployment changes by developers.
