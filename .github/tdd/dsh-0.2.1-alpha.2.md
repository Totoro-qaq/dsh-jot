# DSH 0.2.1-alpha.2 compatibility: implementation evidence

Date: 2026-10-10. Source plan: the approved isolated compatibility task; the
journeys below were derived for this TDD run. Starting commit:
`dcde43b7c7ead652690f993def85f04560e26dda` (`dsh-jot@0.2.8`).

## Scope and journeys

- An alpha.2 host can satisfy Jot's exact SDK peer alternatives without removing
  the existing rc.2 or alpha.1 alternatives.
- A person changing the host code font or code size sees that setting in note
  code, without changing ordinary prose or resizing toolbar glyphs.
- An older host without the new variables keeps the legacy mono font or system
  monospace stack, `.9em` inline code, and `.88em` block code.

The engine range already includes alpha.2 and is unchanged. The official alpha.2
SDK metadata still requires Cordis `~4.0.5-alpha.1` and Schemastery
`~3.18.5-alpha.1`; their development pins and peer alternatives are unchanged.
The 13 directly used DSH development SDK packages were installed at alpha.2 and
read back from their actual installed manifests. No direct runtime dependency,
storage format, retention rule, AI gate, host registration, or version change is
part of this implementation.

## RED and GREEN

The tests were written and executed before production edits:

```sh
node --import tsx --test tests/dsh-compatibility.test.mjs tests/client-fonts.test.ts
```

RED: **32 tests, 4 pass, 28 fail**, exit 1. The intended failures were 13 peer
declarations missing alpha.2, 13 development pins still naming alpha.1, the
legacy family winning over `--ds-font-family-code`, and `.9em` winning over
`--dsh-code-font-size`. The old-host fallbacks and unchanged prose/glyph
contracts already passed. There were no dependency-resolution or syntax
failures in this RED run.

After the minimal manifest/CSS edits, the same target was GREEN: **32 pass,
0 fail, 0 skipped**, exit 0. Dependencies and the lockfile were then mechanically
updated with pnpm. Frozen-lockfile installation passed after regeneration.

Git checkpoint commits have deliberately **not** been created: commit/push
authorization is a separate pending gate for this task. The RED/GREEN record
above is uncommitted execution evidence, not a claim of checkpoint commits.

## Test specification

| Guarantee | Target | Type | Observed result |
|---|---|---|---|
| All 13 SDK peers explicitly accept rc.2, alpha.1, and alpha.2, and no other new alternative | `tests/dsh-compatibility.test.mjs` | Manifest contract | PASS |
| All 13 development pins name alpha.2; real installed SDK types compile | Manifest target, installed manifest readback, `pnpm typecheck` | Contract and typecheck | PASS |
| Canonical code family wins; legacy and system fallbacks remain available | `tests/client-fonts.test.ts` | CSS-variable contract | PASS |
| Only document code sizes use the code-size axis; legacy relative sizes remain | `tests/client-fonts.test.ts` | CSS-variable contract | PASS |
| AI off-state, other-plugin registrations, existing editor/storage behavior remain covered | `pnpm test` | Existing unit/integration suite | 376 pass, 0 fail, 0 skipped |
| Host exports and client factory remain loadable with shared React externals | `pnpm build`, `pnpm pack:check` | Build/package smoke | PASS, 685 KiB client |

The font test's small `var()` resolver verifies emitted fallback declarations;
it is **not** a browser cascade engine and is not presented as live host
acceptance.

## Coverage and remaining gates

```sh
node --import tsx --test --experimental-test-coverage --test-coverage-include='src/client/styles.ts' tests/client-fonts.test.ts
node --import tsx --test --experimental-test-coverage --test-coverage-include='src/**' tests/*.test.ts tests/*.test.mjs
```

Measured coverage for the changed `styles.ts`: lines/branches/functions
**100.00% / 100.00% / 100.00%**. This measures execution of the stylesheet
module, not the semantic correctness of every CSS declaration.

Measured full-source coverage: lines **77.31%**, branches **85.18%**, functions
**75.27%**. The Node suite therefore does **not** establish a global 80% coverage
gate; large interactive React bodies still require browser-level evidence.
No unrelated UI or coverage refactor was added to this compatibility task.

Actual alpha.2 Web/native-shell installation, UI interaction, computed font
styles, persistence/restart, co-installed plugin behavior, and removal remain
separate host-acceptance gates. README, `docs/VALIDATION.md`, and Workshop
validated-host claims are intentionally unchanged by this implementation
evidence note. No release or npm publication has been performed.
