<p align="center">
  <img src="./assets/readme/jot-icon.svg" width="80" height="80" alt="Jot colorful bookmark icon">
</p>

<h1 align="center">Jot · 随记</h1>

<p align="center">Notes, to-dos and lightweight documents inside DSH. You own the content; AI helps only when you ask.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-jot"><img src="https://img.shields.io/npm/v/dsh-jot?label=npm&color=3B8C76" alt="npm version"></a>
  <img src="https://img.shields.io/badge/DSH-rc.2%20%2B%20alpha.1-3B8C76" alt="DSH 0.2.0-rc.2 and 0.2.1-alpha.1">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-3B8C76" alt="MIT license"></a>
</p>

<p align="center">
  <a href="./README.md">中文</a> · English · <a href="./docs/GUIDE.en.md">Guide</a> · <a href="./CHANGELOG.md">Changelog</a> · <a href="./docs/VALIDATION.md">Validation</a>
</p>

![Jot full workbench in the actual DSH Host, showing notes, checklists, tables, colors and highlights in English](./assets/readme/workbench-en.jpg)

*Browse and organize in the full workbench; write beside a conversation in the right sidebar. Screenshots show example notes in the actual Host.*

## Why Jot

- **You write, AI assists.** Ordinary document editing, no Markdown required. AI collaboration starts off, and even when on, AI reads or edits notes only when asked.
- **Right beside the conversation.** Open the full workbench from the left navigation, or a compact tab in the right sidebar while you chat.
- **Local storage.** Notes live in the DSH data folder; Jot does not provide cloud sync. Export to Markdown, Word, PDF or TXT at any time. With AI collaboration enabled, notes read by an agent enter the current conversation and the selected model's context.

## What it does

- **Write:** headings, bold, italic, underline, lists, checkable to-dos, quotes, code, tables, text colors and highlights. Tables support row/column editing and draggable widths.
- **Find:** search titles and body text (title matches first), find and replace inside a note; pins, recent edits, optional folders, sorting and multi-select. The list shows checklist progress such as `2/5`.
- **Collect:** capture selected text into a new or the current note; paste screenshots or drop files. Attachments open in DSH's official viewers for Word, spreadsheets, PDF, images and text.
- **Stay safe:** autosave, recovery drafts, and conflicts that keep your writing. Moving to Trash can be undone; deleting permanently also removes files only that note used.
- **Work with AI:** AI can write headings and checklists in simple Markdown, append items to a checklist and tick a single item. Notes changed by AI are labelled “AI edited” until you edit them.

## Install

```sh
# Desktop
dsh plugin --profile desktop add dsh-jot

# DSH Web UI
dsh plugin --profile web add dsh-jot
```

Restart the corresponding Host afterwards. Desktop and Web installations are independent. The official Desktop can enable its bundled CLI through the application menu's “Manage dsh command…”. The CLI requires Node.js `^22.19.0 || >=24`.

**Upgrade:** `dsh plugin --profile desktop add dsh-jot@latest`, then restart the Host. **Uninstall:** `dsh plugin --profile desktop remove dsh-jot`; your notes are kept. Use `web` instead of `desktop` for the Web UI.

## Get started

1. Choose **Jot** in the left navigation and press **New**. Press Enter in the title to continue in the body.
2. During a conversation, choose **Jot** in the right sidebar's new-tab guide to write beside it.
3. To get AI help, turn on **Allow AI collaboration** at the bottom of the list, then tell it which note to read or update.

![Jot compact right-sidebar tab beside a conversation in the actual DSH Host, showing the English interface](./assets/readme/sidebar-en.jpg)

## Working with AI

When the switch is on, the agent can use these tools. Every call checks the current switch, and AI cannot turn it on.

| Tool | Purpose |
| --- | --- |
| `jot_list` / `jot_read` | Search notes; read the text and the numbered to-do items |
| `jot_create` | Create a note from simple Markdown: `#` headings, `- [ ]` to-dos, lists, quotes, tables |
| `jot_update` | Append (preferred) or retitle; whole-text replacement refuses to drop tables, files or colors |
| `jot_set_task` | Check or uncheck one to-do item without touching anything else |
| `jot_delete` | Move a note to Trash; you can restore it |

Try: “Add the three decisions we just agreed on to my Jot note *Weekly sync*” or “Tick item 2 in *Follow-ups*.” Notes are not automatically added to the conversation; AI reads them through these tools when needed.

## Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Bold / italic / underline | ⌘B / I / U | Ctrl+B / I / U |
| Undo / redo | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Shift+Z; also Ctrl+Y |
| Find in note / save now | ⌘F / ⌘S | Ctrl+F / Ctrl+S |
| Search all notes | `/` (inside Jot, outside a text field) | same |

You can also type `# ` for a heading, `- ` for a list, `1. ` for numbers, `[ ] ` for a to-do, `> ` for a quote, `---` for a divider and `**bold**`.

“Jot: Open Jot”, “Jot: New note” and “Jot: Capture selected text” appear in DSH's keyboard settings without default keys, so you can bind them as you like.

## Data

Notes are stored in `$DSH_HOME/jot` (`~/.dsh/jot` when unset); back up the whole folder. Desktop and Web share notes when configured with the same data folder. Recovery drafts also live in the interface's Local Storage. Attachments default to 20 MiB each and 500 MiB in total. Every human and AI change is revision-checked, so nothing is silently overwritten.

## Compatibility

| Environment | Status |
| --- | --- |
| DSH 0.2.0-rc.2 · Official macOS Desktop | Current Desktop release; see the [validation record](./docs/VALIDATION.md) for actual checks |
| DSH 0.2.1-alpha.1 · Web | Three bindable commands, dark mode and table controls checked in the actual Host; alpha is a prerelease |
| Windows / Linux | Source checks pass in CI; UI and shortcuts not yet tested on actual systems |
| Cloud sync, real-time collaboration, version history, drawing | Not included |

## FAQ

**How is this different from asking AI to “remember”?** Jot's notes are documents you can see, edit and export. They are never silently rewritten or injected into each turn; AI reads or writes them only when the switch is on and you ask.

**Will uninstalling or upgrading lose notes?** No. Notes live in the DSH data folder, separate from the plugin package, and older versions can still read notes saved by newer ones.

**Why does an action mention “kept drafts”?** Another panel has unsaved changes to that note. Open it and load the latest version or save the draft as a new note first, so neither side's writing is lost.

## More

- [Guide](./docs/GUIDE.en.md): attachment and export limits, AI tool details, backups and conflicts.
- [Product scope](./PRODUCT.md): product decisions, implemented features and future directions.
- [GitHub Releases](https://github.com/Totoro-qaq/dsh-jot/releases) · [npm](https://www.npmjs.com/package/dsh-jot) · [Report an issue](https://github.com/Totoro-qaq/dsh-jot/issues)

<details>
<summary>Build from source</summary>

Use Node.js `^22.19.0 || >=24` and pnpm 11:

```sh
git clone https://github.com/Totoro-qaq/dsh-jot.git
cd dsh-jot
pnpm install --frozen-lockfile
pnpm check            # typecheck, tests and build
pnpm dev              # local preview: http://127.0.0.1:4178
pnpm pack --pack-destination artifacts
dsh plugin --profile desktop add "$PWD/artifacts/dsh-jot-<version>.tgz"
```

Use `--profile web` for the Web UI. After changing `src/client/icons.tsx`, run `pnpm icons` to update `assets/icons`.

</details>

[MIT](./LICENSE) · Embedded PDF fonts use the [SIL Open Font License](./assets/fonts/OFL.txt).
