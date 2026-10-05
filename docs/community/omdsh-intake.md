# Oh My DSH intake declaration

[简体中文](omdsh-intake.zh-CN.md) | English

This proposed author declaration requests project intake, not an organization role or repository transfer. Source, Issues, releases and npm publishing remain under Totoro-qaq. It is not Hub approval or installation authority.

## Artifact and lifecycle

The existing package provides a Profile Bundle through `cordis.patch.yml`; no SDK, adapter dependency, or runtime entry is added. The requested `harness-profile` / `profile-bundle` transaction is **Workshop's candidate-Profile envelope**, not an assertion that ordinary installation in a user's current Profile is transactional. Failure injection and Workshop rollback are unverified; `failureIsolation` is null.

Activation is conservatively `restart-host`, consistent with the installation guide. `dispose: supported` covers registered routes, tools and client contributions; notes and attachments are intentionally retained on uninstall. Hot reload and restart-free package upgrades are not certified; `hotReload` is null.

## Permissions and data

- Read/write the human-selected local note directory, including notes, attachments, drafts and AI-undo sidecars. Permanent deletion requires a human action and is not part of uninstall.
- Register authenticated Host HTTP routes and human-controlled optional agent tools. AI access starts off and is checked per call; Jot does not automatically inject notes into every model turn.
- Contribute the workbench, conversation sidebar, slash action and keyboard commands through official client surfaces.
- On explicit human action, open a verified attachment copy in a native application and export files. Jot adds no third-party cloud sync, translation route, or telemetry endpoint.

## Evidence and intake gate

The exact tested hosts are official macOS Desktop 0.2.0-rc.2 and Web 0.2.1-alpha.1; see [VALIDATION.md](../VALIDATION.md) for version-specific evidence and native-platform limits. The concrete UI capability is saving a public note and reopening its exact text. The existing compatibility range is not changed.

Review and publish this metadata at a public immutable commit before creating v2 submission JSON. Already-published npm 0.2.6 does not contain the new `dshWorkshop` declaration. Bind an exact matching artifact/version and full 40-character commit; do not submit an unpushed proposal as a public-source fact.

Validate using the pinned Workshop implementation, show the complete Issue to the author, then request explicit approval for that Issue. Workshop creates its own pending-review PR; do not edit Catalog/Registry directly. Its inspected baseline remains 0.1.0-rc.6, outside Jot's support. Modern Host checks do not grant that baseline's Harness approval, and no compatibility downgrade is proposed.

References: [author procedure](https://hub.omdsh.dev/agent-submission-prompt.zh.md), [package schema](https://github.com/omdsh-dev/dsh-hub-workshop/blob/main/package-manifest.schema.json), [intake gates](https://github.com/omdsh-dev/dsh-hub-workshop/blob/main/INTAKE.md).
