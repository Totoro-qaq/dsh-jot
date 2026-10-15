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
after reinstallation. These are upgrade instructions, not new host-acceptance
results.

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

The first full check after changing dependencies caught an alpha.2 generated
workspace-path license filename. `pnpm build` regenerated the notice and
license through the existing generator; the next check passed **431/431**
tests. The four added documentation contracts then brought the final suite to
**435/435**. Generated-license checkpoint: `aee18c5`.

pnpm 11.22 recorded 34 release-age exclusions while resolving the newly
published official SDK graph. Every entry names one exact official alpha.3
SDK or its required Cordis/Schemastery/Cosmokit runtime version. No wildcard,
global release-age override, or unrelated dependency update was added.

## Coverage and remaining acceptance

```sh
node --import tsx --test --experimental-test-coverage --test-coverage-include='src/**' tests/*.test.ts tests/*.test.mjs
```

The coverage run passed **431/431** tests before the four documentation-only
contracts were added. Full-source coverage: **77.47% lines / 84.88% branches /
76.36% functions**. No business source changed, and this is not a global 80%
coverage claim. Interactive React bodies still need real-host evidence.

At this checkpoint, actual alpha.3 Host/UI acceptance is pending. Installation,
editing/search/attachment/export, font settings, plugin replacement,
disable/remove isolation, retained note and attachment bytes, and restart
must be recorded separately before adding alpha.3 to validated-host claims.
Workshop's validated-host list still names only rc.2, alpha.1 and alpha.2.
Existing historical acceptance does not establish alpha.3 acceptance. Native
Windows/Linux and alpha.3 Desktop are not covered by these local checks.
