# OMDSH declaration checks — 2026-10-05

Scope: proposed intake metadata, packaging of its explanatory documents, and documentation only. Runtime source, dependencies, build configuration and Host range are unchanged. Author review precedes committing/pushing this proposal and precedes any public submission.

`node --test tests/workshop.test.mjs` initially executed all three checks and failed 0/3 because `package.json#dshWorkshop` was absent. The identical target passed 3/3 after adding the declaration.

The checks cover the existing Profile Bundle/artifact, safe public evidence paths and permission labels, named Host versions, and null failure-injection/hot-reload evidence. They do not certify Workshop's own transaction envelope.

`pnpm check` passed 315 tests, typecheck and Host/Client builds; `pnpm pack:check` passed. `validateWorkshopManifest()` from Workshop commit `6c3ec7b496d57272c65d79581722051b6c8f4a41` returned no errors. No runtime-coverage percentage is claimed for this metadata-only proposal.

The declaration is not present in already-published npm 0.2.6. Source-bound v2 submission waits for an approved public commit and matching artifact coordinate. No checkpoint commits or public application have been made in this preparation phase.
