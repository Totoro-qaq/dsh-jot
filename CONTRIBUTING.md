# Contributing to Jot / 随记

Jot is a human-editable notes and lightweight document space inside DeepSeek Harness. Bug reports, focused improvements, and documentation corrections are welcome. You can write issues and pull requests in Chinese or English.

## Development

Use Node.js `^22.19.0 || >=24.0.0` and the pnpm version declared in `package.json` (currently 11.22.0). Jot declares DSH 0.2.0-rc.2 and 0.2.1-alpha.1 compatibility; development DSH packages use 0.2.1-alpha.1. Web and Desktop are separate Host profiles, and their actual checks must name the runtime tested.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

`pnpm dev` starts a standalone development preview with workbench/sidebar, dark-theme and English toggles. This is useful for editor work but does not verify native DSH integration. Action icons live in `src/client/icons.tsx`; run `pnpm icons` after changing them so the shipped `assets/icons/*.svg` stay in sync (a test enforces this). To exercise the built plugin in DSH, create a package with `pnpm pack --pack-destination artifacts` and follow the [installation guide](./README.en.md). Use separate test data and Host profiles for integration checks.

CI runs the same checks on Linux with Node 22.19.0 and 24, and on Windows and macOS with Node 24. These checks cover source behavior, build output, and package exports. They do not launch native DSH Desktop or a provider-backed agent session.

## Making a change

- Keep notes editable by the user. Agent access starts off and must honor the current human-controlled permission switch on every call.
- Preserve revision checks, recovery drafts, authenticated routes, and attachment boundaries. A failed operation must not silently overwrite saved work, and merely opening a note must not save it.
- Preserve state-response ordering across concurrent reads and writes. An older GET or 304 must not roll the library back after a newer accepted response or a successful mutation.
- Clean up only untouched empty new notes. Human edits to pin/folder metadata and writing then clearing text count as edits. A busy panel must retain a pending New command and consume it once when ready; modal ownership still blocks background commands.
- Keep `jot.json` readable by earlier releases: its note fields are validated strictly, so put new metadata in a separate file (as `jot.activity.json` does).
- Use DSH's public registrations and scoped plugin styles. Follow the Host's font, theme, and text scaling; check narrow sidebars and wide workbenches for UI changes.
- Keep native text clipboard behavior and use Command on macOS / Control on Windows and Linux. Acquire Host shortcut overrides only while the relevant editor has focus, and release them afterward.
- Include a regression test when changing behavior that could lose data or break a documented contract. Avoid tests that only repeat implementation details.

Describe the resulting behavior and the checks you ran in the pull request. For UI work, show the relevant state and identify whether the evidence came from a standalone preview, actual Web Host, or native Desktop. The [validation record](./docs/VALIDATION.md) documents the current limits of observed testing.

## Reporting problems

Include your Jot and DSH versions, operating system, Web/Desktop profile, steps to reproduce, and relevant UI plugins. Remove private note content, tokens, account details, and identifying paths from logs and screenshots. Use a minimal sample document where possible.

## Release checks

Before a release, verify the package version and published-file list, and update the changelog and validation record. Run the source checks and repeat the actual Host checks affected by the change; release-only automation changes do not require editor screenshots or a new product version.

Publish a stable GitHub Release for its reviewed `vX.Y.Z` tag. [`publish.yml`](./.github/workflows/publish.yml) checks out that exact tag, verifies package identity/version and main-branch ancestry, runs the source/build/package checks and uploads the checked archive to npm with OIDC provenance. Configure the npm trusted publisher once for **Totoro-qaq / dsh-jot / publish.yml**, with direct **npm publish** allowed; no `NPM_TOKEN` secret is needed. Package settings can require one initial security verification for this binding.

To retry an interrupted upload, run **Publish npm → Run workflow** from `main` and enter the same stable tag. An existing npm version is skipped without rewriting it or moving `latest`; registry lookup failures stop the run. Missing old versions cannot move `latest` backwards. This also supports retrying `v0.2.6`, whose tag predates the publishing tools. Prerelease GitHub Releases are skipped.

Keep each archive hash, compiled Host/Client hash and observation together. Documentation and screenshots may change a release archive's hash while its compiled code remains the same; record both. Current per-version results are in [docs/VALIDATION.md](./docs/VALIDATION.md).

For UI releases, verify all three Jot commands in the Host's keyboard settings, their initially unbound state, custom binding persistence, full-workbench/sidebar routing, title focus and dialog guards. Check gray text, highlights, menus and table borders in the Host's actual dark theme. Exercise row/column controls, repeated undo/redo with a save between each operation, committed column widths, Escape during a live drag and Auto fit. A preview or a Node test does not replace these interactions.

Use isolated test Homes and public sample notes. Give local packages content-hash filenames and compare installed Host/Client hashes with the frozen build. The official rc.2 Desktop fixes its default port; a separate test profile can override `webserver.port` to `0` when another instance is running. Keep browser data and instance locks separate with `--user-data-dir`; account login remains a separate prerequisite. Never copy account credentials to make a screenshot work.

README images must be captured separately in Chinese and English in a real Host. A sidebar image should show a public, actual provider-backed dialogue. Identify fixtures and direct tool checks accurately; neither proves that the model invoked Jot's tools. Record Windows/Linux native interaction and hosted CI separately from macOS Web/Desktop evidence.

Contributions are distributed under the [MIT license](./LICENSE). Embedded PDF fonts retain their [SIL Open Font License](./assets/fonts/OFL.txt).
