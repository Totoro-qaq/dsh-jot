# Controlled plugin coexistence fixture

This test-only package uses the official DSH 0.2.0-rc.2 public slots. It adds a
unique global panel, navigation entry, right-sidebar tab/guide entry, and a
`shell.overlay` decoration with explicit `pointer-events: none`. The small QA
badge opts back into pointer events. A one-second heartbeat exercises unrelated
plugin updates while Jot is typing or displaying a popup. Every timer and slot
registration is disposed on plugin unload. The fixture has no Host routes,
tools, model requests, filesystem access, or external resources.

Build and pack without installing it:

```sh
node dev/fixtures/build-coexist.mjs --out-dir /tmp/dsh-jot-coexist-fixture
npm pack --ignore-scripts --pack-destination /tmp /tmp/dsh-jot-coexist-fixture
```

Only the test operator should then add the package to an isolated Web profile:

```sh
DSH_HOME=/absolute/path/to/isolated-test-home dsh plugin --profile web add /tmp/dsh-jot-coexist-fixture-0.0.1.tgz
```

Do not run that command against the normal DSH Home or the Desktop profile.
After the Web Host reloads, `Coexist QA` should appear beside `Jot` in both the
global navigation and the native right-sidebar guide. The right Sidebar is
session-bound: open or select a session before using its guide. No fixture API
opens a hidden right Sidebar or substitutes for a selected session.

Suggested observations in the real Web Host:

- Type into the fixture's input, switch to Jot and back; right-tab text should
  survive because its independent type has `keepMounted: true`.
- With decoration enabled, type into Jot for at least two poll cycles; caret and
  focus should remain stable while the QA heartbeat changes.
- Open Jot's action menu, capture dialog and attachment preview. Their body
  portals should appear above the decoration and badge, remain usable near pane
  edges, and follow the active Host light/dark theme.
- Split the native right pane and put `Coexist QA` beside `Jot`. Resize/narrow
  the panes, change session, close/reopen and float/dock using Host controls.
- Toggle or unload the fixture: Jot data, draft recovery, registrations and
  theme must remain intact. Unloading must remove QA entries, badge and timer.

Boundary: DSH publishes no dedicated background slot in this API. This fixture
uses an additive *foreground decoration* for controlled stacking/click tests;
it is not a particular third-party wallpaper/background plugin. Jot deliberately
has an opaque Host-themed document surface, so a wallpaper behind that surface
will not show through. Plugins that replace `root`, `sidebar` or `rightbar`,
reuse Jot's registration ids, or impose global CSS/z-index rules require their
own integration test. Passing this fixture does not establish universal plugin
compatibility, native Desktop behavior, or model-provider execution.
