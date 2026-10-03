# Contributing to Jot / 随记

Jot is a human-editable notes and lightweight document space inside DeepSeek Harness. Bug reports, focused improvements, and documentation corrections are welcome. You can write issues and pull requests in Chinese or English.

## Development

Use Node.js `^22.19.0 || >=24.0.0` and the pnpm version declared in `package.json` (currently 11.22.0). The plugin targets DSH 0.2.0-rc.2; Web and Desktop are separate Host profiles.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

`pnpm dev` starts a standalone development preview. This is useful for editor work but does not verify native DSH integration. To exercise the built plugin in DSH, create a package with `pnpm pack --pack-destination artifacts` and follow the [installation guide](./README.en.md). Use separate test data and Host profiles for integration checks.

CI runs the same checks on Linux with Node 22.19.0 and 24, and on Windows and macOS with Node 24. These checks cover source behavior, build output, and package exports. They do not launch native DSH Desktop or a provider-backed agent session.

## Making a change

- Keep notes editable by the user. Agent access starts off and must honor the current human-controlled permission switch on every call.
- Preserve revision checks, recovery drafts, authenticated routes, and attachment boundaries. A failed operation must not silently overwrite saved work.
- Use DSH's public registrations and scoped plugin styles. Follow the Host's font, theme, and text scaling; check narrow sidebars and wide workbenches for UI changes.
- Keep native text clipboard behavior and use Command on macOS / Control on Windows and Linux. Acquire Host shortcut overrides only while the relevant editor has focus, and release them afterward.
- Include a regression test when changing behavior that could lose data or break a documented contract. Avoid tests that only repeat implementation details.

Describe the resulting behavior and the checks you ran in the pull request. For UI work, show the relevant state and identify whether the evidence came from a standalone preview, actual Web Host, or native Desktop. The [validation record](./docs/VALIDATION.md) documents the current limits of observed testing.

## Reporting problems

Include your Jot and DSH versions, operating system, Web/Desktop profile, steps to reproduce, and relevant UI plugins. Remove private note content, tokens, account details, and identifying paths from logs and screenshots. Use a minimal sample document where possible.

## Release checks

Before a release, run the checks above, verify the package version and published-file list, and exercise the final packaged bytes in the actual Host. Update the changelog and validation record with the work that was actually checked. Publishing is a separate maintainer action; CI does not publish npm packages automatically.

Contributions are distributed under the [MIT license](./LICENSE). Embedded PDF fonts retain their [SIL Open Font License](./assets/fonts/OFL.txt).
