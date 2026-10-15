# DSH 0.2.1-alpha.3 compatibility: implementation evidence

Date: 2026-10-15 (Asia/Shanghai). Source plan: the authorized isolated Jot
compatibility task; journeys were derived during this run. Starting commit:
`db0f6113d635c48382676bf2a5ff2d323a86d6f7` (`dsh-jot@0.2.12`). The package
version remains **0.2.12**. No publication or upstream repository write occurred.

## Scope and source contracts

- A developer builds and tests against the actual installed alpha.3 SDKs,
  rather than declaring alpha.3 while retaining older installed types.
- A host supplies all 13 directly used DSH SDK packages through `*` peers;
  `engines.dsh` retains the existing bounded host range.
- A person upgrading alpha.3 Web follows the HMR replacement lifecycle;
  the guide distinguishes the running manager, stopped-Host CLI operations,
  and the separately validated rc.2 macOS Desktop.
- Notes, attachments, human editing and the default-off AI gate retain their
  existing storage and lifecycle behavior.

The [official alpha.3 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.3)
and installed npm metadata require Cordis `~4.0.5-alpha.2`; the SDKs that depend
on Schemastery require `~3.18.5-alpha.2`. Exact development pins follow those
versions. Their peer alternatives retain the existing rc.2/alpha.1 contracts
and add the required alpha.2 runtime versions. All 13 DSH development SDK pins
are exactly `0.2.1-alpha.3`.

Comparing installed alpha.2 and alpha.3 declaration files found no changes in
locale, shortcuts, layout, sidebar, right sidebar, native commands, workspace
paths, or command UI. The renderer adds a keyed-hook member overload; UI
session adds access hooks. Jot's existing slot registrations, session adapter,
tab lifetimes and authenticated `connection.requestRejection` call still
compile. No business source change was needed.

The [official HMR upgrade guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-alpha.3/docs/upgrade-guide/v0.2.1-alpha.2/plugin-install-over-installed/guide.md)
requires removal before installing an already installed bundle through the
running manager. The CLI takes a separate package-operation path, so the
documentation does not claim its `add` command returns `already-installed`.
It tells CLI users to stop the matching Host, remove then reinstall for Web,
and start the same profile. Custom Jot `directory` settings should be restored
after reinstallation. Actual host acceptance is recorded separately below.

## RED and GREEN checkpoints

1. SDK baseline RED: `node --test tests/dsh-compatibility.test.mjs` executed
   **42 tests: 13 pass, 29 fail**, exit 1. Failures were the declared and
   installed SDK alpha.2 baseline and Cordis/Schemastery alpha.1 baseline.
   Peer delegation checks already passed. Checkpoint: `adf1f9f`.
2. SDK baseline GREEN: the same target passed **42/42**, followed by a passing
   `pnpm typecheck`, after updating exact pins, regenerating the lockfile and
   running frozen installation. Checkpoint: `f4b630d`.
3. Bilingual upgrade RED: the same target executed **46 tests: 42 pass,
   4 fail**, exit 1. Both languages lacked the Web replacement sequence and
   explicit alpha.3 Web/rc.2 Desktop boundary. Checkpoint: `acc2610`.
4. Bilingual upgrade GREEN: after the minimal README/guide changes, the same
   target passed **46/46**, exit 0. Checkpoint: `2dca5f4`.
5. Accepted-host declaration RED: after the real alpha.3 Host checks,
   `node --test tests/dsh-compatibility.test.mjs tests/workshop.test.mjs`
   executed **49 tests: 48 pass, 1 fail**, exit 1. Workshop's precise host list
   still omitted the newly accepted alpha.3 Web Host. Checkpoint: `741ac20`.
6. Accepted-host declaration GREEN: after adding only alpha.3 to that list
   and recording the bounded candidate acceptance, the same target passed
   **49/49**, exit 0. `hotReload` remains null and activation remains
   `restart-host`. Checkpoint: `85e9c99`.

These checkpoints were created on `compat/dsh-0.2.1-alpha.3` and remain
reachable from its HEAD. They have not been squashed.

## Verification

| Guarantee | Command or target | Observed result |
| --- | --- | --- |
| Exact declared and installed SDK/runtime versions; host-owned peers | `node --test tests/dsh-compatibility.test.mjs` | 46 pass, 0 fail, 0 skipped, including bilingual upgrade checks |
| Reproducible dependency installation | `pnpm install --frozen-lockfile --ignore-scripts` | PASS; lockfile accepted without resolution |
| Types, existing editing/storage/AI/lifecycle regressions and bundles | `pnpm check` | PASS: typecheck, 435 tests, Host and Client build |
| Client factory, Host exports, shared React and generated notices | `pnpm pack:check` | PASS |
| Package production | `pnpm pack --pack-destination artifacts/alpha3` | PASS for the local candidate; no publication |
| Precise accepted hosts without a changed-code hot-replacement claim | Compatibility + Workshop target | 49 pass, 0 fail, 0 skipped |
| Real alpha.3 Web notes and bounded lifecycle acceptance | Real Host/UI receipts, summarized in `docs/VALIDATION.md` | PASS within the scope below |

The first full check after changing dependencies caught an alpha.2 generated
workspace-path license filename. `pnpm build` regenerated the notice and
license through the existing generator; the next check passed **431/431**
tests. The four added documentation contracts then brought the final suite to
**435/435**. Generated-license checkpoint: `aee18c5`.

pnpm 11.22 recorded 34 release-age exclusions while resolving the newly
published official SDK graph. Every entry names one exact official alpha.3
SDK or its required Cordis/Schemastery/Cosmokit runtime version. No wildcard,
global release-age override, or unrelated dependency update was added.

## Coverage and actual Host acceptance

```sh
node --import tsx --test --experimental-test-coverage --test-coverage-include='src/**' tests/*.test.ts tests/*.test.mjs
```

The coverage run passed **431/431** tests before the four documentation-only
contracts were added. Full-source coverage: **77.47% lines / 84.88% branches /
76.36% functions**. No business source changed, and this is not a global 80%
coverage claim. The later real-host run supplies bounded interactive evidence;
it does not change the measured Node coverage.

The official alpha.3 Web Host ran the 0.2.12 Jot candidate together with the
0.4.4 Bridge candidate in an isolated Home. Installed Host and Client hashes
match the candidate. `jot-qa/receipt.json` records **13 passing UI checks**:
real creation/editing/Save, browser reload and body search, two task items,
table insertion and row append, 45-paragraph scrolling, actual attachment
upload, real Markdown ZIP/PDF/DOCX downloads, and 768px/375px interactions.
Attachment readback is explicitly an authenticated HTTP byte check; Markdown
and DOCX text and the PDF header were independently inspected. No external
Office application or Host Office-engine download was used.

`toggle-verification.json` records real AI UI opt-in **six tools**, opt-out
**zero**, and co-installed plugin isolation. The exact public note JSON and
79-byte attachment survived Jot disable/re-enable. Bridge's own style count
followed **1/0/1** without changing other stylesheet hashes or Jot's HTTP 200
route. Jot disable removed its HTTP route/tools without breaking Bridge's
doctor.

`duplicate-jot-install.json` and `reinstall-verification.json` confirm the
running manager refuses an installed Jot package with `already-installed`
and `changed:false`, then accepts removal/reinstallation from new archive
paths with **identical business bytes** without a manual Host restart.
Navigation, routes and tools disappeared after removal; the new archive specs
took effect after installation, with exact note/attachment retention. An
initial helper's changed-realpath assumption was corrected because the
installation is hoisted; that assertion is not a product failure.

`restart-verification.json` records normal shutdown exit 0, restart in the same
Home, preserved synthetic sessions, and the exact Jot note reopened in the
real UI with AI still off. `runtime-verification.json` confirms official SDK
and candidate bundle versions/bytes. These receipts are local QA artifacts,
not repository files. See `docs/VALIDATION.md` for hashes and precise limits.

Workshop now names alpha.3 based on these actual Host observations. Different
business-byte HMR, native alpha.3 Desktop, Desktop font scaling shortcuts,
physical Windows/Linux, arbitrary other plugin combinations, fresh alpha.3
font-setting changes, complete IME/a11y matrices and rendered PDF/DOCX layout
remain unverified. Historical acceptance remains version-specific. Final
uninstall/cleanup and service shutdown are pending at this checkpoint. No
publication, CI or merge completion is claimed.
