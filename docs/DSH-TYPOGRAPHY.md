# Jot typography and toolbar alignment

Verified against the installed official macOS app's `app.asar` entry
`dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js`, and local
`@deepseek-ai/dsh-client-ui-sidebar`, `ui-sidebar-right`, `ui-conversation`, and
`ui-layout` npm packages at `0.2.0-rc.2`. Root also checked the running host's
computed styles: body is 16 px; navigation rows are 14 px / 22 px and 36 px high.

The theme defines `--dsw-font-family` as the platform system font stack. Jot uses
that real variable with inheritance as fallback, not a separately loaded face
or the brand's Montserrat family. Plain `font: inherit` from the host body would
produce the incorrect 16 px interface size.

| Verified host token or rule | Value / use in Jot |
| --- | --- |
| `--dsw-font-s-14` | 14 px / 22 px; normal interface text |
| `--dsw-font-xs-13` | 13 px / 20 px; secondary controls and excerpts |
| `--dsw-font-xxs-12` | 12 px / 18 px; dates and counts, with secondary text color |
| `--dsw-font-m-18` | Despite its name, the installed definition is 500 **16 px** / 28 px |
| `--dsh-content-font-size` | User-selected document size; current/default 14 px |
| `--dsh-content-font-delta` | Host scaling adjustment from the 14 px default |
| `--dsw-font-markdown-base` | Document family/size/line height; default 14 px / 24 px |
| Sidebar `.iconButton` | 28 × 28 px; Jot toolbar buttons match this size |

The workbench title uses 16px / 24px and weight 600. The note title uses 15px /
24px and weight 500 in the wide workbench, and 14px / 24px in the compact pane.
The compact pane uses the host's tab title, rather than adding another Jot brand
row. Interface chrome starts at the host's 14px text scale. New sits beside the
workbench title in `jot-workbench-header`.

Search and list filters stay in the fixed `jot-list-controls` region. Only
`jot-note-list` scrolls. Compact mode keeps its fixed `jot-topbar` and clear Back
action. `jot-editor-toolbar` supports a single document toolbar; existing
top/actions classes remain compatible.

The native wide workbench has a real 50px top toolbar, matching the official
conversation header's 10px + 30px + 10px band and the leading controls' center
at 25px. It does not add 48px of blank padding above its own toolbar. Its left
content start uses `max(20px, var(--dsh-frame-leading-clearance, 0px))`: the
official frame supplies 160px when the macOS sidebar is hidden, or 84px in
fullscreen. When expanded it falls back to 20px. The list/editor separator
starts below the toolbar. Jot does not replace `shell.leading`.

The compact content toolbar is 38px high, with 28px button boxes, an 8px group
gap, and a 6px right inset. Its final button center is 20px from the right edge,
matching the host's panel chrome. Toolbar SVGs use the host's 15px glyph seat;
editor-control SVGs use 16px with centered text. Format and Find controls use
inline-flex alignment rather than inline text baselines. Save is an accessible
28px icon control; its action remains available alongside automatic saving.

Placeholder and metadata text use `--dsw-alias-label-secondary`, without an
opacity reduction. Keyboard focus remains an explicit accent outline. Missing
host font shorthands fall back to inheritance, not invented font variables.
