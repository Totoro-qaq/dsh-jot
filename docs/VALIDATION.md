# Validation — dsh-jot

Dates: 2026-10-02 through 2026-10-10 (Asia/Shanghai). Each section applies only to the version it names.

## Unreleased — DSH 0.2.1-alpha.2 compatibility

Verified 2026-10-10 in isolated worktrees, based on `dcde43b7`, still carrying
package version **0.2.8**. This is not the published npm 0.2.8 artifact. No
commit, push, PR, merge, tag or publication is covered by this candidate record.

All 13 directly used DSH SDK peer alternatives retain rc.2/alpha.1 and add exact
alpha.2; development pins/lockfile follow alpha.2. Cordis, Schemastery,
`engines.dsh`, runtime dependencies, storage, AI gates and entry registration are
unchanged. Two document-code CSS rules follow `--ds-font-family-code` and
`--dsh-code-font-size`, retaining the legacy family and `.9em` / `.88em` fallback.

Both candidates were installed together through the official CLIs in fresh
**DSH 0.2.1-alpha.2 Web** and **0.2.0-rc.2 macOS Desktop** environments. Installed
Host hash: `bdb40a93eda994ebe59207723176dc16680829be6c28662d0f1ed8ac4fb49664`;
Client hash: `058fd86c827ed4af7e4e1b210f1114456e05d670b11b19ffa4d0c33fdc3e97f3`.
The Host is byte-identical to published 0.2.8; the Client is not.

| Check | Observed result |
| --- | --- |
| Official alpha.2 loading | Active with no version exemption; actual authenticated routes and sidebar work, co-installed with Bridge. |
| Web typography | Default inline/block code is 11px. Real Settings controls select text Georgia, code Menlo and code size 13px: both code forms become 13px Menlo; prose remains 14px Georgia. Settings survive host restart. No CSS-variable injection was used. |
| Web editing/persistence | A synthetic note contains text, code, two tasks, a table, an attachment and 45 paragraphs. Real checkbox/text edits and Save persist revision 2, 1/2 tasks and the edited text; table and attachment survive restart. |
| Search/attachment/export | Actual Host search finds the note. Uploaded TXT bytes round-trip. The real UI Markdown export downloads a ZIP; independent inspection confirms the latest note text and intact attachment. Initial CDP download-path failures were corrected with the owned browser context; they are not successful downloads. |
| Long content | Editor body has 812px client height / 2,048px scroll height with `overflow-y:auto`; note controls remain separate from scrolling content at 1280 × 900. This is a bounded layout check, not full visual/accessibility certification. |
| AI default and live gate | Starts off with zero Jot tools. Real UI on/off produces six/zero registered tools. This run did not toggle during an in-flight model call; the earlier 0.2.7 check is separate evidence. |
| Plugin isolation | Disabling/removing Bridge keeps Jot's UI and authenticated route available. Other stylesheet hashes are unchanged when Bridge's own stylesheet is removed. |
| Jot removal/restart | Package/declaration, route, navigation and tools disappear. Restart succeeds without Jot. Edited note and attachment bytes remain intentionally stored; uninstall does not erase them. |
| rc.2 native renderer | Official installed app, not a Web mirror: editing, task Save, table/attachment rendering and attachment bytes pass. With no new code-size variable, inline is 12.6px and block is 12.32px on 14px prose. |
| rc.2 removal/restart | Carrier CLI removes both plugins. A normal native-menu Quit returns exit 0; the same fresh Electron user data and Desktop Home restart with no Jot entry and retained session/note files. A signal-interrupted earlier cache restart failed before window/host creation, so that attempt is not counted as a clean restart. |
| alpha.1 backward smoke | Separate fresh official Web profile installs/starts both candidates with no exemptions, serves authenticated Jot state with AI off, and retains Bridge doctor 13/13. Full alpha.1 UI was not rerun. |

All prompts, notes and files are synthetic. The daily DSH Home, original
conversations and installed app were not replaced; no local AI model was loaded.
The desktop update feed still names rc.2; alpha.2 Web is not alpha.2 Desktop.
The earlier native freeze/account-avatar issue is not reproduced or fixed here.
Native Windows/Linux, arbitrary third-party UIs, large folder/ZIP imports and
full IME/shortcut/a11y matrices were not freshly accepted in this compatibility
pass. Host SDK peers come from the installation fallback: profile-only
`pnpm peers check` warns about missing SDK/React peers and is not reported as
passing. Host/package caches and intentional user data are not zero-trace removed.

Local gates: targeted RED 4/32 pass → GREEN 32/32; typecheck, **376/376 tests**,
Host/Client build, frozen lock installation and package factory/export checks
pass. Changed stylesheet module coverage is 100%, but full-source Node coverage
is **77.31% lines / 85.18% branches / 75.27% functions**, not a global 80% claim.
See [implementation TDD evidence](../.github/tdd/dsh-0.2.1-alpha.2.md).
Publication and registry-install verification require a new release and are
separate gates.

## 0.2.8 — documentation and package contents

Checked 2026-10-07 against source commit `17386b45d79531cda74512e60ccea0fbb5fd286c`. Only documentation and package contents changed after 0.2.7. The built Host (`bdb40a93eda994ebe59207723176dc16680829be6c28662d0f1ed8ac4fb49664`) and Client (`8e3d33038f992389eec096324b3c6ad7a8bf9fb4b81cebd4f33a5e6b1fb365fc`) bundles are byte-identical to those in the published 0.2.7 package, so the 0.2.7 Host checks below still describe the runtime. The package no longer contains the README screenshots in `assets/readme/*.jpg`; the README loads its demo GIF from GitHub.

## 0.2.7 — live tool removal and import acceptance

Verified 2026-10-07 against source commit `40f384154227978c14a28396b244c7a9bc25f742`, after the shared-draft and folder-ZIP fixes. The acceptance candidate declared `0.2.6`; release preparation changes its package version to `0.2.7` without changing the tested Host/Client bundles. The frozen installation archive SHA-256 is `97afdbcad0f0b1bd839836b40716800212d781bdd2d1db020706b14a4b906319`.

Both isolated profiles loaded the exact frozen Host (`bdb40a93eda994ebe59207723176dc16680829be6c28662d0f1ed8ac4fb49664`) and Client (`8e3d33038f992389eec096324b3c6ad7a8bf9fb4b81cebd4f33a5e6b1fb365fc`) bundles. Hosts: official **DSH 0.2.1-alpha.1 Web** and **DSH 0.2.0-rc.2 macOS Desktop**. The Web checks ran in a browser against the actual DSH Host, not the standalone Jot preview.

| Check | Observed result |
| --- | --- |
| Turn off AI collaboration during a running conversation | Passed in both Hosts. The first model request advertised all six Jot tools. While that request was held, the real UI switch was turned off. Its subsequent `jot_read` call was rejected as unknown; the next model request in the same turn carried zero Jot tools. Both conversations completed normally. |
| Upload exactly 200 MiB | Passed through both actual UIs, including Desktop's `dsh-app` request forwarding. The ZIP was exactly **209,715,200 bytes**, containing one Markdown note and ten bounded binary attachments. All ten persisted payload sizes and SHA-256 values matched their originals on each Host. |
| Desktop folder chooser and import | Passed through the native macOS picker using a Chinese-named folder. Two Markdown notes imported, the nested folder was preserved, and a referenced ZIP remained an intact attachment. An unused ZIP and a hidden backup ZIP did not block import and were not stored. |

The tool test used a **local deterministic DeepSeek Messages endpoint** to hold and release responses and inspect actual serialized HTTP requests. Agent creation, the running agent loop, tool registration/removal, dispatch and the UI switch were the real DSH implementations. This is Host integration acceptance, not a provider-account or model-quality test. Requests already sent cannot be withdrawn; this does not claim cancellation of a tool body whose execution has already begun.

All notes, attachments and prompts were synthetic and lived in separate DSH Homes and Electron user data. No production credentials were used. The two test collaboration switches were returned to off, the test services were stopped, and the normal Desktop environment was reopened. Screenshots and detailed evidence remain in ignored local `artifacts/agent-edit-host-qa/`.

The prior **344-test** check, typecheck, Host/Client build and package-factory checks apply to these unchanged runtime bundles. Precise Markdown edits, delta polling and draft merging retain their unit/preview evidence; this focused native pass does not claim a new complete UI regression run. Windows/Linux native Desktop behavior remains unverified. Merge, CI and publication are separate steps.

## 0.2.6 — insert menu, library export and AI undo

Verified 2026-10-05. The reviewed PR initially passed 295 tests. Review reproductions then found unsafe attachment cleanup for an active AI undo, stale undo copies after human edits, library export continuing after failed saves, archive allocation before its limit, and an AI-undo response replacing newer writing. Those cases were repaired. A real language switch also exposed stale checkbox labels in retained NodeViews; the final Client refreshes only their labels. Final `pnpm check` passed **307 tests**, typecheck and builds, followed by prepack and package-export checks. Independent review reran 21 backend/client export and undo tests; the label change also passed 27 focused editor/draft checks.

Both isolated profiles installed hash-named candidates through the official CLIs. The final Host SHA-256 is `934491ce5109743e762f70e5f4a0f3fb0203cfe9d9dd5669aca01559192f5371`; the final Client is `c598ddbc00441ab5e503c74a7e5a3b7edc803c23a946ff534dd209e2e52707b4`. The preceding UI candidate used the same Host and Client `f5590913e1c9587af8015b40d259d50b5957a4606203aaef5baa3f8265ebbef7`; its only later Client change refreshes retained checkbox language labels without a document transaction.

### Actual official Host checks

- **DSH 0.2.1-alpha.1 Web:** `/jot` displayed its default Open action, pinned/recent notes and a title filter. Two Enter presses opened Jot; selecting a specific note opened it in the current conversation and preserved the other draft text. The existing public conversation and token usage stayed unchanged.
- In the actual editor, Mod+Enter changed one to-do, Alt+Shift+Down moved that item within its list, and Save persisted progress **1/3 → 2/3** and the changed order. The Chinese `、bt` filter offered headings 1–3; keyboard selection inserted H2. Mod+Alt+4 left that H2 unchanged. The `?` shortcut and menu both opened the keyboard reference in Web.
- Word, PDF and Markdown folder exports all downloaded through the Web UI. Their real ZIPs each held one note and one public TXT attachment; the Word document contained the latest text, the PDF had a valid header, and Markdown's relative, URL-encoded attachment link resolved to the included original. The automation's browser download-event waiter timed out, but all three files were independently found and inspected in the normal Downloads folder.
- Batch Trash moved two public notes without a confirmation and offered Undo; one click restored both. A search with no results in the selected folder named two matches elsewhere; switching to all folders retained the query and returned those two results.
- A real Host split-resize reduced the Jot pane to **320.5px**. Table and body left edges were both **973.5px**, with a **14px** control band. The first-column menu stayed inside the 1280px viewport; the pane width was restored afterwards.
- **DSH 0.2.0-rc.2 macOS Desktop:** `/jot` opened the same picker, its default Open action and a filtered note. Native Mod+Enter and Alt+Shift+Down persisted **1/3 → 2/3** and the reordered item. `/bt`, Down and Enter inserted H2, and native Save retained it. The keyboard-reference menu rendered the expected platform keys; direct native `?` triggering was not separately confirmed.
- Both Hosts confirmed Undo AI edits with AI access off: the appended public follow-up disappeared, the note became a new human revision and the undo sidecar was removed. The final Web Client then checked English → Chinese → English on a retained checklist; labels followed the locale, and persisted content, revisions and timestamps did not change.

Public fixture updates used direct calls to real Jot tools, with their gate turned on only for those fixture writes and turned off afterwards; this does not mean a model called the tools. No new model request was used for this version's acceptance. Original Desktop notes/attachments remained byte-for-byte unchanged, and its test directory override is restored after QA. The ordinary DSH Home and installed App were not replaced.

All four Chinese/English README images are retaken in the official Web Host, at its ordinary **1280×720 JPEG** viewport. Workbench images show the corresponding public checklist/table and filtered insert menu; sidebar images show corresponding real public dialogues and an undoable AI-edited note. No credentials, accounts, private note text or local filesystem paths appear. See [README-DESIGN.md](README-DESIGN.md) for provenance.

Actual Windows/Linux native UI, complete IME coverage and every shortcut in every focus state remain unverified. The final Desktop language flip was not confirmed: its language dropdown could not be selected through the current automation, and screen capture still returned a Stage Manager thumbnail. The final Web locale round trip and initial native localized labels were observed; that limitation does not attest to a successful Desktop locale flip. Previous versions' table/history/attachment checks below are distinct from this acceptance. CI, merge, Release and npm/registry byte comparison are checked separately.

## Historical 0.2.6 development — official `/jot` client action

Verified 2026-10-05. `pnpm check` passed all **269 tests**, typecheck and Host/Client build; prepack and package-export checks passed. An independent review repeated 21 slash/entry tests and found no confirmed blocker. The optional Cordis injection was exercised with the real registry for service arrival, replacement and unload; regressions also cover stale sessions, visible modal guards, duplicate client contributions and preservation of the existing entries.

The hash-named `0.2.6-dev.0` candidate was installed through the official CLIs in isolated DSH **0.2.1-alpha.1 Web** and **0.2.0-rc.2 macOS Desktop** profiles. Both installed Clients matched SHA-256 `b2c3d8eedfb38ba073f3622c38589b550a08d0d9a72e700dbe1a1d5b03f81f21`.

- Both Hosts displayed **打开随记 / jot** in the official slash menu. Enter on bare `/jot` opened the current conversation's Jot tab and left an empty composer. Menu invocation consumed only `/jot` from Web's `待记内容 /jot` and Desktop's `public draft /jot`, preserving the other draft text.
- Web also selected the menu action with the mouse and preserved a pending public TXT attachment. The conversation's message count and recorded token usage remained unchanged during these successful command invocations.
- One Desktop automation attempt clicked a text-only accessibility node, which dismissed the menu; its later Enter sent the public test text. Generation was stopped. A subsequent direct Enter with the candidate visible and the composer focused preserved the draft and opened Jot. This accidental test request is distinct from executing the client action.
- Original Desktop notes and attachments remained byte-for-byte unchanged. The test GUI was closed and its temporary public-note directory override restored to the previous profile. The native screenshot API returned a distorted thumbnail, so Desktop acceptance here rests on observed native controls and text rather than a visual-layout claim.

The implementation registers `ui.kind: 'action'` and only calls the official `openTabIn` API for the captured, still-current conversation. The official command owner consumes the token; Jot does not submit prompts or rewrite attachments. A duplicate client name is isolated without replacing the other contribution. A same-name Host command follows the official candidate-synthesis failure behavior; the SDK exposes no public Host command catalog for a plugin to preflight that collision.

This is development acceptance, not npm publication. Native Windows/Linux slash interaction remains unverified; the previous version's layout, keyboard and table acceptance below does not imply new testing of those features here.

## 0.2.5 — official Web and macOS Desktop acceptance

Verified 2026-10-04–05 (Asia/Shanghai) with Node 22.23.1. `pnpm check` passed all **257 tests**, typecheck and Host/Client build; prepack and package-export checks passed. The first PR CI also passed Linux Node 22.19.0 / 24, Windows Node 24 and macOS Node 24. CI for the final follow-up commit and publication are checked separately.

The package explicitly supports DSH **0.2.0-rc.2** and **0.2.1-alpha.1**, including their Cordis and Schemastery prereleases. Development packages use alpha.1. The official production Desktop feed still offered rc.2; its native checks are distinct from the alpha.1 Web checks. The public slot, occurrence-lifetime and controller APIs used for command routing were checked against both runtimes.

### Final installed runtime

Both isolated profiles installed the same hash-named runtime candidate through the official CLIs. Installed bytes matched the build:

| Artifact | SHA-256 |
| --- | --- |
| Runtime candidate archive | `fb03f402811f140b0601cce9caad0fc8c419ff6a67e3c3f7c709dc42c05133f1` |
| `lib/index.js` | `76b7c31a1d99860077eb56e8f1f917425084630faf3f33763842d3475ce77309` |
| `lib/client.js` | `18ec77ec03d6876cbce5dfd277ae0ffe28195a2ac8130cb00195b116df2ff7d4` |

The release archive also contains the final documentation and screenshots, so its archive hash differs from this UI candidate. The compiled bytes must remain identical. Original Desktop notes were preserved byte for byte; the temporary public-fixture directory override was removed after QA. The isolated Desktop profile retains the port-0 workaround for rc.2's fixed-port collision. The installed global App and ordinary DSH Home were not replaced.

### Keyboard commands and retained sidebars

All three Jot commands appeared in the actual keyboard settings with no default bindings. The isolated Web profile bound Command+Option+6 / 7 / 9; Desktop bound F6 / F7 / F9. These are test choices, not shipped defaults. Restart retained the bindings. Open selected the full workbench or conversation sidebar; New focused the title and Enter moved into the body; Capture froze the selected text and offered the current note. A capture dialog blocked background New.

A real Web check with two conversations retaining their Jot tabs exposed duplicate command consumption. The final runtime addresses a command by session ID, actual tab ID and occurrence lifetime, checks visibility/current ownership, then claims it atomically. With both conversations retained, one New increased the persisted note count **9 → 10**, and one Capture produced exactly **one dialog and one Cancel button** with the selected text and current-note target. New inside the dialog did not add a note. Closing/reopening, switching while busy, overlapping panes and unload cleanup also have regressions using the actual registered entry components.

The final native runtime separately repeated full-workbench New and Capture (exact text `Capture current note only.`), its modal guard, and sidebar Open/New. The persisted native note count increased once per accepted New, **8 → 9 → 10**. These checks verify command integration, not model-driven Jot tool use.

### Appearance and tables

The final native window and fullscreen view both kept the title, toolbar and body aligned beside the note list. The document retains an 800px reading limit with spare room on the right; compact layout is unchanged. Gray text and yellow highlights were visibly readable in both actual dark Hosts. This is a bounded visual observation, not a measured contrast audit of every palette combination.

Table logic was exercised in earlier 0.2.5 candidates before the command-routing-only follow-up; its implementation is unchanged in the final runtime. Web checked end controls and row/column menus, with a save between consecutive Undo/Redo steps: **5 × 5 → 4 × 5 → 4 × 4 → 4 × 5 → 5 × 5**. A physical drag previewed **160 → 240px**, Escape restored 160px, a committed drag saved 230px, and Auto fit cleared fixed widths.

Native end controls produced **4 × 3 → 4 × 4 → 5 × 4**; two Undo and two Redo operations across saves restored each grid. A physical drag saved **160 → 220px**; Auto fit removed widths. A later native row/history check saved **5 × 3 → 4 × 3 → 5 × 3 → 4 × 3**. Persisted JSON grids and widths were read at the checkpoints. Native Escape during a live resize has not been separately exercised.

### Source regressions and public images

The 257 tests cover revision conflict/draft preservation, Markdown and lossy-replacement refusal, task indexing/list append, attribution sidecars, concurrent stores and ETags, attachment path/reference safety, rendering/exports and icons. New regressions prevent late GET/304 responses from restoring older state, preserve intentionally edited empty notes, defer busy commands, and prevent multiple retained consumers from executing a command twice. Autosave responses no longer reset undo/redo, and resize cancellation/read-only guards are covered.

All four Chinese/English README images were captured separately in the final alpha.1 Web Host at its ordinary **914×939 JPEG** viewport. They use only public fixture notes; sidebar images contain real public dialogues. No authentication parameters, account details, private notes or local filesystem paths appear. See [README-DESIGN.md](README-DESIGN.md) for image provenance.

The two dialogues were generated through the official bundled headless provider path using **deepseek-account / deepseek-flash**, existing high reasoning, one step/reply each and no tools/retries; reported usage was 605 and 680 tokens. SessionPersistence APIs transferred the persisted events without changing their logical hashes. Public excerpt notes used direct execution of a real Jot tool, which does not mean the model called that tool. Credentials were not exported or copied.

Native Windows/Linux UI, complete clipboard/IME coverage, long-term stability and model-driven Jot tool use remain unverified. Source CI, actual UI, screenshot capture, merge and npm/Release publication are separate outcomes.

## 0.2.4 — official attachment previews and application opening

Verified 2026-10-04 on macOS, using Node 22.23.1 for source checks and the official DSH 0.2.0-rc.2 bundled runtime for an isolated Web Host. Typecheck, all **197 tests**, build, package-factory checks and `git diff --check` passed. The 45 additional behavioral checks cover private file projection, Windows-safe names, independent copies, tampered bytes and links, authenticated POST-only actions, cancellation and timeouts, session/panel changes and fallback delivery across unmounts. These local checks are separate from release publication and hosted cross-platform CI.

The new Host used a fresh temporary DSH Home with public fixtures only; telemetry and LLM session-title generation were disabled. No provider login or model request was made. Installed Host/Client bytes and the Client served by the official Web Host matched the build. The existing test Desktop and ordinary DSH Home were left alone.

Observed interactions in the official Web UI:

- Without a selected Conversation, the attachment dialog retained downloads and showed the default-application button when the Host reported desktop support. Clicking the public TXT fixture opened its verified copy in macOS TextEdit; its actual window and text were observed, then that test window was closed without editing it.
- From the full notes workbench with a selected Conversation, clicking CSV returned to that Conversation and opened the official spreadsheet viewer. The public three-column content rendered, and the official opener identified Numbers as the default application.
- Clicking DOCX opened the official Office-to-PDF viewer with selectable public document text and its zoom controls. The Host reported one missing font through its own warning. The associated application button identified Microsoft Word; Word itself was not launched in this check.
- PDF displayed in the official PDF viewer. From the compact Jot tab, clicking TXT opened the official text viewer in that same Conversation and retained the Jot and earlier document tabs.

The open browser emitted scope/session-release and cancelled-inspection errors while the isolated Host was stopped for the build replacement. After reloading the restarted Host, the attachment interactions above produced no later console errors in the captured log. This does not establish error-free Host restarts.

Default application opening uses the official cross-platform native library; it opens a private copy on the serving Host and does not save edits back into Jot. Actual Windows/Linux desktop launches, remote-client system opening and unsupported-renderer UI failure states remain unverified. The source tests cover their capability, path, cancellation and fallback contracts without launching applications.

## 0.2.3 — Windows lock acquisition compatibility

The first public 0.2.2 source CI passed all 142 tests on Linux Node 22.19.0 / 24 and Windows/macOS Node 24. A second tag-triggered run exposed an intermittent Windows exclusive-open `EPERM` during the unchanged 12-concurrent-note test. The other tests and three other platform jobs passed. This demonstrates why one green run was not a guarantee against this timing window.

Version 0.2.3 shares a lock acquisition helper between notes and attachments. Only a Windows `EPERM` during exclusive `wx` creation retries within the existing 5-second deadline and 12ms interval. Existing-lock `EEXIST` retains its original timeout; sustained permission errors retain their original cause. Metadata initialization is outside the retry loop, and no unowned lock is removed. Windows delete-pending access-denied behavior is a source-backed explanation consistent with the failure, not a captured kernel trace.

Ten deterministic regressions cover transient and permanent errors, platform boundaries, initialization failure, exclusive flags and ownership cleanup for both stores. Strict typecheck, all **152 tests** on the minimum Node 22.19.0 and the development runtime, build and package checks passed. The original concurrency and security tests were not weakened. CI and public-release results are reported separately from the historical native UI checks below.

[Initial source CI](https://github.com/Totoro-qaq/dsh-jot/actions/runs/37130262442) · [Windows failure](https://github.com/Totoro-qaq/dsh-jot/actions/runs/37130514935)

## Historical verification — 0.2.2


## 0.2.2 status — source and table interaction checks passed

Strict typecheck, **142 tests**, Host/Client build and package-factory checks passed. Table interaction checks used the actual editor in a separate temporary preview data directory:

- Selecting a cell exposes row/column menus and end-of-table add controls. Starting in the first cell of a 2 × 3 table, the two end controls produced 3 × 4, kept the old second row in place and left the new last row empty. Chrome is outside the document table and does not serialize into its content.
- A physical mouse drag wrote a 350px column width; Save and reload retained `colwidth=350`. Auto fit removed the saved widths and the previous column styles, leaving 88px minimum widths. Rows expand with text; no whole-table zoom or manual row-height control was added.
- At a 320px compact viewport the plugin measured client/scroll width 319px, with table content 353px inside a 235px viewport. The column menu stayed inside the window at x=8px / width=160px. Escape closed it. A Trash note was read-only, had no table chrome and kept its column widths/text unchanged after a drag attempt; Restore re-enabled editing and table controls.
- Nine new meaningful regressions cover targeted append/insert/delete and merged grids, width normalization and history, capacity limits, and column-width recovery near the 1 MiB boundary. On over-limit width metadata the editor restores only widths, keeps concurrent body input, and resets the live resize preview; it does not roll the whole note back.

### Actual 0.2.2 Host observations — 2026-10-03

- The test Desktop exited through its native menu, and its eight saved notes, three folders, profile and Electron recovery storage were backed up. The final runtime package was installed into both temporary profiles with the official bundled CLI. Both installed manifests are 0.2.2; Client SHA-256 is `608465f15fd5c8a3ce570a2d24a4245a337d8b7ad15055ed31f6d188f9b76ed0`, matching the workspace build. Installation itself left saved bytes unchanged.
- In the actual macOS right sidebar, a new QA note received a 3 × 3 table. The physical end controls appended a row and column; Command+Z removed the added column, Shift+Command+Z restored it, and Command+S saved. The native column menu then inserted before the selected column and the table options exposed/executed Auto fit. The persisted result was 4 × 5. Native column dragging was not separately verified; this pass covers the controls and history, while physical mouse resizing was exercised in Web.
- A separate actual Web QA note retained its `列 A` text, 4 × 4 structure and 289px dragged column width after Save/reload. Auto fit cleared the stored column widths and live styles. The real Host's row/column popup used the captured cell target, and the conversation sidebar displayed the public demonstration note without horizontal app overflow.
- At the recorded QA checkpoint all eight pre-update note objects and all three folder objects were unchanged; this pass added two QA notes. After leaving the window on the public demonstration, a final read observed added demo row/column/checklist and width changes. Those current edits were retained. The two original private notes and all other pre-update note objects remained unchanged. The fresh native log contained no `WidgetInputHandler` deserialization failure. The native test window was left running.
- README workbench/sidebar images and a table-menu proof image were captured from the actual 0.2.2 Web Host, using public demonstration content. They were not reconstructed from a standalone mockup.

The 0.2.1 hashes and native observations below attest only to that older version. Actual Windows/Linux systems, full native clipboard/IME coverage and long-term stability remain outside these bounded checks.

## Historical verification — 0.2.1

## 0.2.1 status — source checks and bounded real Host checks passed

Version 0.2.1 targets the official DSH 0.2.0-rc.2 runtime. Strict typecheck, **133 tests**, Host/Client build and package-factory checks passed after the K3 integration. Its installations and observations are recorded below; the older 0.2.0 hashes do not attest to this version.

Changes in this version:

- A colored product notebook in bamboo green, warm white and golden apricot is shared with the README. Action icons use the K3 line geometry in common 16px frames; text-formatting letters remain in the system font. Capture uses a selection mark instead of scissors.
- Folder creation, rename and deletion live in Folder actions. Sorting and selection live in List options, with the batch bar shown during selection.
- Fonts and hierarchy follow DSH's content-size scaling. Narrow editor containers use icon controls with tooltips and accessible names. The public navigation, sidebar and shortcut registrations remain in place.
- Folder creation refreshes the snapshot before applying its newly created filter, preventing the refresh from immediately resetting that filter.

These source checks preserve the existing editing/storage/security coverage; they are not a complete visual or six-platform acceptance claim. No new npm publication, GitHub push or universal third-party-plugin compatibility is claimed.

### Actual 0.2.1 Host observations — 2026-10-03

- The test Desktop quit through its native menu. Saved notes, profile and Electron recovery storage were backed up before installing the content-hash-named package into both temporary Desktop and Web profiles. Installed manifests are 0.2.1 and both Client hashes match the workspace: `7e905b628f2e4742f5186619b646d91390cd30d459a13bae1c98f7ae9aa7d4b4`. The ordinary DSH Home was not modified. Electron's application storage is shared with the official app and was backed up; it is not an entirely isolated Electron user-data directory.
- The real DSH Web UI loaded the colored product mark and shared action glyphs. The wide toolbar measured 50px and the list controls 108px; normal action glyphs measured 16px, and the inline pin 12px. Jot and the note title both measured 16px at the default content size. A selected folder omitted repeated folder labels from its rows.
- List options displayed checked radio sorting, and selection selected all three demonstration notes. A newly created QA folder became the active filter, its rename persisted, and Delete exposed the confirmation before being cancelled. Current-note Command+F returned 1 / 2 for `笔记`; closing it, exporting Markdown and reloading preserved the demonstration document. An existing QA image opened and decoded at 640 × 240 in the preview modal, whose Close control dismissed it. The actual right sidebar opened the same demonstration content without horizontal app overflow.
- The native window loaded Jot and its new folder/list menus. In a newly created QA note, physical Command+Z removed an inserted table, and Shift+Command+Z restored it; Command+S left it saved. Command+B in the body retained the expanded host sidebar; focusing the title returned the sidebar binding, and repeating Command+B collapsed then restored it. This verifies the retained native history and focus-bound shortcut routes after icon integration, not complete native clipboard or IME behavior. The capture API's native screenshot was reduced/distorted, so it was not used to assert pixel-perfect native alignment.
- All seven pre-update note objects and both original folder objects remained unchanged; the acceptance pass added one QA note and one QA folder. The fresh native log contained no `WidgetInputHandler` deserialization failure during the pass.
- README images were refreshed from the actual Web Host at 1440 × 1000, using public demonstration notes and the host's dark theme. Independent preview checks at 320px, increased content-size tokens and dark tokens remain component observations, distinct from the native checks above.

Actual Windows/Linux systems, complete native input/clipboard coverage, long-term stability and specific third-party theme/plugin combinations remain unverified.

## Historical verification — 0.2.0

The following checks, package hashes and successful installations apply to 0.2.0 only.

### 0.2.0 status — checks, real Web Host and macOS Desktop smoke passed

The 0.2.0 package targeted the official DSH 0.2.0-rc.2 runtime. Strict typecheck, **133 tests**, Host/Client build and `pack:check` passed. That runtime was installed into isolated Desktop and Web profiles, with installed Client bytes checked against the build. The real Web UI and macOS native window were then exercised as described below. This is bounded functional acceptance, not a claim of complete OS, clipboard, IME or long-term stability coverage.

Implemented source now includes tables and finite color/highlight palettes, image/file upload and preview, literal text capture into a new or existing note, duplicate/context/batch management, modified/created/title sorting, common editor shortcuts, and TXT/Markdown/PDF/DOCX export. The human-owned notes model, disabled-by-default agent gate, recovery drafts and CAS checks remain the foundation.

Observed checks during implementation:

- Strict TypeScript checks passed after the final native history fixes; 133 tests and the Host/Client build passed.
- Public host-shortcut protocol: 12 tests passed. They use actual `parseShortcutDefinitions` and `effectiveShortcuts`, cover macOS/Windows Desktop, user remaps, unrelated bindings, multiple editors, stale focus cleanups, disposal, registration rollback, Web/Linux no-op behavior and real ProseMirror table undo/redo through Native command ingress. Editor routing tests are maintained separately.
- Export: 13 tests passed. These check detached draft semantics, Markdown escaping/code fences/GFM tables/offline ZIP assets, DOCX runs/numbering/merged cells/PNG, Chinese PDF font embedding, tall-cell pagination, vector task-state boxes, nonempty short-row page starts, one footer per physical page below the body margin, and attachment/output bounds.
- Note-list helpers: 13 tests passed. New checks cover created-date grouping and displayed dates, flat caller ordering, title-first query priority and selection gestures that never fall through to opening a note.
- A Chinese/color/table/image PDF QA sample was generated with bundled NotoSansSC Regular/Bold. Its four physical pages contain the title, tall-cell tail and document tail; `pypdf` also extracts each page's correct `N / 4` footer. Initial Poppler inspection found missing checkbox glyphs and a blank table continuation. The source now uses public vector paths and avoids synthetic terminal-newline rows. The integration owner inspected all four regenerated pages: checked/unchecked boxes are distinct, the blank continuation is gone, and footers do not cover body content or create an empty page. The sample is an internal QA artifact, not a user deliverable.

Browser integration QA passed for:

- Color, permanent highlight and table content persisted after reload.
- Raster-image preview/download and a PDF attachment iframe; TXT, Markdown-with-assets ZIP, PDF and DOCX downloads through the UI.
- Right-click duplication; batch move of 3 notes, moving all 3 to Trash and restoring them.
- A failed capture request (503) kept the dialog/draft, and retry appended only one occurrence.
- An upload completed after switching notes stayed in the original note's recovery draft; it did not enter the new note. Uploading while Capture was open preserved textarea focus.
- Capture submitted while an older autosave was pending waited for a second save containing the excerpt before closing. Batch deletion refused a note with another panel's unsaved recovery branch and left it active. Single-note deletion uses the same protection.
- Actual ProseMirror clipboard parsing preserves managed file cards as attachment nodes rather than relative-URL Link marks; parser priority is covered by a regression test.
- Win32/Linux `navigator.platform` emulation exercised Ctrl-based formatting, undo/redo, Find from the title and Save. These are renderer/platform-selection checks on the current machine, **not tests on an actual Windows or Linux operating system**, and do not exercise their Native IPC/menu/window-manager routing.

Real DSH Web Host and coexistence checks:

- The official bundled CLI served the isolated Web profile on a temporary loopback port. Browser access used the Host's normal launch-token exchange and signed cookie; no user account credentials were entered. The temporary development preview on a separate temporary port remained a separate failure-injection environment.
- The installed plugin loaded through DSH's module loader. The notes library, literal editing, managed image upload/display and Markdown-with-assets ZIP export worked in the real Host. No console errors were returned in the final Web navigation.
- A separate test-only plugin added unique global/right-sidebar entries, an additive pointer-transparent decoration and a one-second heartbeat. Jot typing retained focus over several heartbeats; action menus and the capture modal remained clickable above the decoration and inherited the actual dark Host theme.
- Native Web right-sidebar tabs held both plugins. The other plugin's input survived switching to Jot and back; Jot's editor and menu remained usable. The fixture was then removed from the isolated Web profile; Jot and saved notes remained available. Fixture source lives under `dev/fixtures` and is excluded from the shipped Jot package.
- This controlled fixture proves those tested additive registrations, not compatibility with every wallpaper plugin. Jot's document surface is opaque and Host-themed. Plugins replacing singleton layouts, reusing registration IDs or imposing global CSS/z-index rules require their own test.

macOS Desktop checks:

- The official 0.2.0-rc.2 Desktop was stopped through its menu before installation. Existing notes/profile/recovery storage were backed up privately. Runtime Client SHA-256 is `def6a04b1c081b3c97a1beb0e702d090f30d47f7fe8571e1820aa00c0c263123`; both installed profiles match. The original two note objects remain unchanged; all edits used additional QA notes.
- Native key delivery verified Command+A/B/I/U, current-note Command+F with one match, Command+S, and the Mod+B focus boundary: formatting retained the Host sidebar while editing, then the normal sidebar command resumed from the title field.
- Native testing exposed Electron's Edit menu consuming history keys before editor DOM handlers. The final focused-editor routes use the public normal command registry for Command+Z and Shift+Command+Z. In separate native actions, inserting a table showed its controls, Undo removed the table, Redo restored it, and Save returned to Saved. Node protocol tests exercise this same route with real ProseMirror history. Clicking the Host's Edit→Undo/Redo menu remains the Host's role behavior; it is not replaced by this keyboard fix.
- A managed raster image displayed and opened the native Jot preview modal. PDF export opened the native save sheet and produced a 50,923-byte file beginning `%PDF-1.3`. The bundled font assets were present in the installed package. The final smoke log contains no WidgetInputHandler deserialization failure or Jot plugin error; this is not a long-term freeze-prevention claim.

Current limits and validation boundaries:

- macOS uses Command; Windows/Linux use Ctrl. Local handlers support bold/italic/underline, undo/redo (including Ctrl+Y outside Apple platforms), current-note find and save. Clipboard/select-all retain native ownership; composition/229 guards prevent candidate-confirmation shortcuts from editing notes.
- On macOS/Windows Desktop, focused-editing Mod+B uses public `shortcuts.registerFixed`. macOS editor history additionally uses public `shortcuts.register` routes for Undo/Redo. All are removed on blur/disposal without editing user configuration. Definitions reach Native through asynchronous IPC with no public acknowledgment API. Steady focused delivery was tested above; no zero-delay focus-transition guarantee is made. Web/Linux retain local-before-host dispatch.
- Managed attachments default to 20 MiB/file, 500 MiB total and 1,000 objects; UI batches are capped at 20 files. Byte quotas are configurable. Rich JSON stores only validated attachment IDs; PNG/JPEG/GIF/WebP preview eligibility uses byte signatures and bounded dimensions. PDF preview depends on the receiving host/browser viewer. Tests/implementation do not claim parsing or indexing attachment body text, OCR, automatic garbage collection, or portable live DSH URLs.
- Markdown with attachments returns a ZIP containing `note.md` and local `assets/`. An export may reference at most 100 distinct attachments; raw attachment bytes and final output are each limited to 50 MiB. PDF/DOCX embed PNG/JPEG; other files retain filename/description hints.
- PDF tables over 8 columns become labeled row/column text; merged-cell borders are not faithfully reconstructed. Table-contained images follow the table with their description. Markdown HTML and DOCX preserve merged-cell structure. PDF embeds packaged fonts under [SIL Open Font License 1.1](../assets/fonts/OFL.txt); DOCX uses reader/device font availability. No pixel-identical export claim is made.
- Batch move/delete are per-note, revision-checked operations, not an all-or-nothing transaction. On failure, already completed operations remain completed and the UI reports the count.
- Snapshot fetching still loads the complete notes library; list virtualization is not backend pagination. Notes state is bounded at 32 MiB, documents at 1 MiB/200,000 JavaScript length units, and tables at 200 rows/50 columns subject to the document limit.
- Windows/Linux Desktop and browser variants, real provider-account tool execution, complete native IME/clipboard shortcuts, PDF viewer behavior, long-term stability and power-loss durability remain unverified. No new npm publication or GitHub push is claimed.

## Historical verification — 0.1.0 through 0.1.3

The following records keep their original version boundaries. Their successful installations and UI observations apply to those builds only.

## Runtime and checks

- Development Node: 22.23.1; pnpm: 11.22.0.
- Official installed Desktop: 0.2.0-rc.2; bundled Node: 24.18.1; bundled pnpm: 11.7.0.
- Initial 0.1.0 `pnpm check`: strict typecheck, 37 tests passed, 0 failed, Host/Client build succeeded. The 0.1.1 checks are recorded below.
- `pnpm pack:check`: Host exports, Client factory identity, and only shared React external imports verified.
- No npm publication, GitHub push, or installation into the user's ordinary DSH Home was performed.

## What the tests establish

Persistence and restart, cross-process file locking, atomic-save failure, corrupt-state refusal, title-first search, optional folders, CAS revision conflicts, soft deletion/restoration, agent access disabled by default and checked on each call, authenticated HTTP/Origin boundaries, bounded requests including valid large Chinese documents, bounded agent-list summaries, and client draft preservation across panels and pending requests.

Regressions fixed during verification include unbound DSH Locale methods, a clean sibling panel deleting unsaved recovery drafts, delayed read/delete responses replacing a newly selected editor, and a save response advancing the wrong recovery branch's revision. Editor permission changes no longer emit document edits.

## Official Host and UI verification

Used a separate temporary `DSH_HOME`, with telemetry disabled, and the official Desktop's bundled CLI/runtime. The generated tarball was installed in separate `web` and `desktop` profiles. Installed Client hashes were compared against the current build to avoid accidentally testing cached packages with the same local filename/version.

Web profile browser checks passed for:

- Global sidebar entry and full notes workbench without a model request.
- The original 0.1.0 right-sidebar entry from the conversation composer. In 0.1.1 this default composer button is removed; the native right-sidebar guide entry remains.
- Note creation, rich editing, task-list checkbox persistence, and saving.
- Body search, user-created folder, and note assignment.
- Human collaboration switch; direct calls to the real Jot tool definitions against the same persistent Store could append while enabled and failed with `AGENT_DISABLED` after the UI disabled access.

Desktop profile:

- The official Desktop was started with the temporary DSH Home, its profile initialized, and the package installed after the test app quit.
- Desktop Host startup succeeded with the package. Its authenticated HTTP client rendered the notes workbench, loaded persisted notes from the shared directory, preserved a human draft after an external agent-tool update, displayed a conflict, and saved the draft as another note. Deletion/restoration and the disabled agent gate also passed.
- The native Electron window initially stopped at Welcome. It later entered the workspace; native accessibility inspection verified the fixed “随记” entry, notes list, document controls, task checkbox, folder selector and collaboration switch. No credentials were entered by the agent. Editing/restore/conflict behavior above was exercised through the Desktop Host's browser client, not claimed as a complete native-window end-to-end pass.

Local component preview additionally verified opening/restoring a task note leaves it clean rather than generating a spurious edit.

## Unverified boundaries

- Real model/provider-account execution of Jot tools.
- Complete native Desktop editing/save/restore, native panel floating, and Windows/Linux UI. Native navigation, rendered document controls and macOS sidebar-collapse layout were observed; the native testing window is kept open for the user.
- Recovery after power failure; directory fsync is not implemented. Crashed processes can leave a lock requiring manual inspection.
- Cloud sharing and real-time multi-person editing are outside this first version.

## Native input failure reported after the initial smoke test

The user subsequently reported that the entire native Desktop window ignored mouse and keyboard input. Main and Renderer CPU were near idle, the Host authentication endpoint responded in under a millisecond, and accessibility actions could still navigate to the official Plugins page. The process log contained `VALIDATION_ERROR_DESERIALIZATION_FAILED` for `blink.mojom.WidgetInputHandler`. These observations do not establish a Jot render loop or a specific Desktop root cause.

The notes and browser recovery state were backed up privately in the temporary DSH Home. The test app was quit through its native menu, the latest tarball installed while it was stopped, and the same test Home restarted. Installed/current Client hashes match. The old Client differed only in emitting a document update when changing editor read-only state; that has been corrected, but was not established as the cause of the global input failure.

The user confirmed that mouse and keyboard operation returned to normal after restart. The specific root cause remains unconfirmed; this recovery is not a longer-term stability verdict. The previous native accessibility observation must not be treated as a full physical-input pass.

## 0.1.1 layout and interaction refinements

Final `pnpm check`: strict typecheck, 59 tests passed, 0 failed; Host/Client build succeeded. `pnpm pack:check` verified exports, factory identity and shared React imports. An independent review compared 24 rich-document replacement scenarios against the prior strategy, including nested lists, marks, hard breaks and Unicode ranges; results and Undo were consistent.

Changes:

- Use the installed DSH theme's system family and 14px interface scale, 28px toolbar controls and host-managed sidebar rows. Add a colored notebook icon.
- Move New beside the note-list heading. Reserve the official macOS 48px frame clearance on the wide native workbench without replacing `shell.leading` or the sidebar. Remove the default composer button and its conversation-plugin dependency.
- Group browsing by dates, virtualize continuous scrolling, preserve title-first search ranking and display body context around search hits. Changing a folder resets its list scroll.
- Add current-note find/replace, literal replacement and one-event Undo. Preserve Chinese IME candidate confirmation, restore editor focus when closing Find, and keep replacement disabled for deleted notes.
- Limit find decorations to 256 near the active result while keeping full result counts, navigation and replace-all semantics.
- Batch replace-all into at most one transaction step per matched text block, preserving inline formatting and structure. A capped, isolated Node pressure test showed the previous per-occurrence strategy exhausted its 256MiB heap at 20,000 hits; the batch strategy completed 200,000 hits in one step without exhaustion.

Browser component QA used an independent temporary data directory, separate from the native test Home:

- 1,200 notes: all-count correct, 12 rows mounted initially and 13 near the bottom; keyboard End reached the last non-pinned note. Search returned the expected body-hit context and highlighted the keyword.
- Compact width 320px: find/replace controls had no horizontal overflow; query input occupied its own line.
- Replacing with `<b>text</b>` produced literal text and no HTML element; Undo restored the original. Pure Find left the document saved. Simulated composing Enter/Escape did not replace text, navigate or close the bar; normal Escape returned editor focus after the focus frame.
- A 200,000-character note with 200,000 matches displayed the full count and mounted 256 highlights; the browser remained responsive. The observed 42ms query update is a local observation, not a cross-device performance guarantee.
- The same note's 200,000 occurrences were all replaced in a local browser check (57ms observed), and one Undo restored the entire original. In Trash, Find continued to work, Replace was disabled and the document was read-only; restoring it re-enabled editing and left it saved.
- Filtering from a list offset over 105,000px to a single-note folder reset scroll to zero. A long custom folder name was truncated with an ellipsis without horizontal list overflow.
- Theme-color inheritance was checked in a dark-theme fixture. Official macOS frame clearance was emulated in the preview; that is not a new native-window pass.
- No browser console errors were observed in these checks.

The library rendering is virtualized; the UI still fetches the complete Store snapshot. This is not backend pagination or a claim of unlimited library scale.

The first attempt to update the native test window was blocked because the Mac was locked. No locked-window update was attempted. On 2026-10-03 the user unlocked it and testing resumed.

## Native verification after unlock — 2026-10-03

- The app quit through its native menu before installation. Saved notes, recovery Local Storage and the Desktop profile were backed up privately. The content-hash-named 0.1.1 package was installed with the official bundled CLI into the same temporary Desktop profile; its installed manifest and Client hash matched the workspace build. Host and Renderer were then restarted.
- Native accessibility and screenshot inspection showed the colored notebook icon, note-list New control, date grouping, and retained 2 notes / 1 folder. Collapsing the macOS left sidebar kept the content below the official window controls; reopening it preserved the workbench.
- The actual conversation composer contained only its host controls, with no Jot button. The right sidebar's native New Tab guide contained Jot; choosing it opened the compact list and document.
- Mouse clicks and ordinary keyboard input updated library search. Setting a Chinese query through native accessibility returned the expected body hit. Current-note Find returned 1 / 2 for `agent`, exposed navigation, and closing it retained the selected result. These read-only checks left the saved note file byte-identical to its backup.
- The automation's Chinese text injection and clipboard shortcut did not complete correctly. Native Chinese IME and clipboard shortcuts are not claimed as verified; browser IME composition checks are recorded above. The fresh process log contained no `WidgetInputHandler` deserialization failure during these checks.
- Expanding a selected compact document into the wide workbench initially lost its selection. Version 0.1.2 transfers the note, saved revision and source draft branch, waits for a current snapshot, and acknowledges navigation in the plugin's activation state so periodic refresh and remounts cannot replay the request or reset editing. If a save has already removed the requested recovery branch, a fresh note read is bound to that navigation before using the server content. Ten handoff regressions cover delayed first mount, repeated expansion, unrelated recovery variants, stale snapshots and save acknowledgements during the handoff.

The CLI's pnpm peer check reports missing DSH and React packages in the bare plugin profile. The official profile sets `autoInstallPeers: false`; its runtime merges profile plugins with dependencies from the bundled application, and the browser loader seeds React. Successful native loading does not depend on installing a second copy of those host packages into the profile.

Final 0.1.2 source checks: strict typecheck, 69 tests passed, 0 failed; Host/Client build and module-factory check succeeded. ReactDOM is explicitly declared as a host-supplied peer alongside React. Native expansion from an existing QA note in the compact panel opened that same document and its retained checklist in the wide page. The private note title is omitted in this public record.

## 0.1.3 toolbar and host alignment

The user's screenshots showed that the prior 48px whole-page inset prevented a collision but left an empty band above Jot and a separator extending beside its title. The compact pane also duplicated the host tab title, mixed button geometry and gave the document title greater visual weight than the app title.

Changes:

- Replace the root padding with a real full-width 50px workbench header. It aligns its title and controls with the host's leading controls and consumes `--dsh-frame-leading-clearance` horizontally: 20px by default, 160px when hidden on macOS, 84px in fullscreen. Keep the official `shell.leading` seat unchanged.
- Start the list/editor separator below the workbench toolbar. Move New beside the 16px Jot title.
- Use the host tab title in compact mode. Its content toolbar is 38px high; New/Search/Expand and Pin/Delete/Save use 28px boxes, an 8px gap and a 6px right inset, giving matching right-hand columns.
- Combine the folder, saving state and document actions into one row. Use an accessible Save icon while retaining the action and automatic saving.
- Reduce document titles to 15px wide / 14px compact at weight 500. Format, Todo and Find share centered controls; their SVGs and labels align on the same center line.

Source/preview verification:

- Typecheck, 69 existing tests and Host/Client build passed. The package-factory check also passed.
- At a 320px compact width, toolbar buttons were all 28px square with matching X centers across both rows, the compact brand count was zero, and there was no horizontal overflow. Find and replacement controls also fit without overflow.
- The wide header began at the top of the app, had 50px height and zero root padding; the list began at its bottom. Emulated official leading clearances produced the expected 20/160/84px title positions. Format labels and SVGs had the same vertical centers.

Native verification:

- The final content-hash-named package was installed while the test app was stopped. Installed manifest 0.1.3 and Client bytes match the tested build; the same temporary Home was restarted.
- In the actual compact panel, the host chrome's three controls, New/Search/Expand and Pin/Delete/Save align in the same right-hand columns. The redundant Jot heading is gone, the metadata/actions share a row, and the document title and formatting controls show the revised hierarchy.
- Expanding the selected document opens that same note in the wide workbench. Its Jot title sits in the real top toolbar, and the list/editor separator starts below it. Collapsing and reopening the macOS sidebar keeps the toolbar usable and performs horizontal clearance rather than adding an empty band.
- The header carries the host's `data-window-drag` marker, retaining button `no-drag`, so the official app-region geometry recall also tracks it.
- An additional 320px wide-view fixture with a long conflict state verified the Save button stayed inside the editor pane. Status text can shrink with an ellipsis while retaining its complete accessible text and tooltip.
- Saved notes remained byte-identical to the new pre-update backup (including the user's latest edits), with 2 notes / 1 folder retained. The test window is left open in the wide workbench.

The preview's emulated clearance values are component checks; the native observations above verify the installed macOS window. Other platforms and long-term native stability remain outside this pass.
