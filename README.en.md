<p align="center">
  <img src="./assets/readme/jot-icon.svg" width="88" height="88" alt="Jot colorful bookmark icon">
</p>

<h1 align="center">Jot · 随记</h1>

<p align="center"><strong>A notebook beside your conversations.</strong><br>Jot down ideas, to-dos and light documents that stay yours, and ask AI to help only when you want it to.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-jot"><img src="https://img.shields.io/npm/v/dsh-jot?label=npm&color=3B8C76" alt="npm version"></a>
  <img src="https://img.shields.io/badge/DSH-rc.2%20%2B%20alpha.1-3B8C76" alt="DSH 0.2.0-rc.2 and 0.2.1-alpha.1">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-3B8C76" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="./docs/GUIDE.en.md">Guide</a> · <a href="./CHANGELOG.md">Changelog</a> · <a href="./README.md">中文</a>
</p>

![Jot full workbench in the actual DSH Host, showing notes, checklists, tables, colors and highlights in English](./assets/readme/workbench-en.jpg)

> **New in the 0.2.6 development build:** type `/` on an empty line to insert headings, checklists and tables; type `/jot` in the chat composer to find a note; export every note to Word, PDF or Markdown; undo AI edits in one step. The badge above shows the current npm release; see the [changelog](./CHANGELOG.md) for details.

## Why Jot

| Right beside the conversation | You write, AI helps | Your data stays yours |
| --- | --- | --- |
| Open the full workbench from the left navigation, or write in the right sidebar while you chat. `/jot` finds a note from the composer. | AI collaboration starts off. When on, AI reads or edits only when you ask; notes it changed are labelled **AI edited** and can be undone in one step. | Notes live in your local DSH data folder with no cloud sync. Export everything to Word, PDF or Markdown at any time. |

## Install

```sh
# Desktop
dsh plugin --profile desktop add dsh-jot

# DSH Web UI
dsh plugin --profile web add dsh-jot
```

Restart DSH and **Jot** appears in the left navigation; press **New** to start writing. Desktop and Web are installed separately. The official Desktop can enable its bundled CLI through the application menu's “Manage dsh command…”; the CLI requires Node.js `^22.19.0 || >=24`.

**Upgrade:** `dsh plugin --profile desktop add dsh-jot@latest`, then restart. **Uninstall:** `dsh plugin --profile desktop remove dsh-jot`; your notes are kept. Use `web` instead of `desktop` for the Web UI.

## What it does

**Writing that stays out of the way**

- Write like an ordinary document: headings, lists, checkable to-dos, quotes, code, tables, text colors and highlights. No Markdown required.
- Type `/` on an empty line for an insert menu (Chinese input methods can use `、`). Typing `# `, `- ` or `[ ] ` also formats as you go.
- Tables support row and column editing and draggable widths; checklist items can be ticked and reordered from the keyboard.

**Find it again**

- Search titles and body text, with title matches first and the matching sentence shown; find and replace inside a note.
- Pins, recent edits, optional folders, sorting and multi-select. The list shows checklist progress such as `2/5`.

**Collect as you go**

- Capture selected text into a new or the current note; paste screenshots or drop files, previewed in DSH's official viewers for Word, spreadsheets, PDF and images.

**Nothing gets lost**

- Autosave, recovery drafts, and conflicts that keep your writing. Deleting notes, one or many at a time, can be undone; permanent deletion asks first.
- Export a note to Word, PDF, Markdown or TXT, or package every note or one folder into a single ZIP with images embedded in Word and PDF.

![Jot compact right-sidebar tab beside a conversation in the actual DSH Host, showing the English interface](./assets/readme/sidebar-en.jpg)

## Working with AI

Turn on **Allow AI collaboration** at the bottom of the list, then tell the AI which note to read or update, for example:

> Add the three decisions we just agreed on to my Jot note *Weekly sync*.
>
> Tick item 2 in *Follow-ups*.

- AI can search, read, create and append to notes, tick a single to-do, or move a note to Trash. Every call checks the switch, and AI cannot turn it on.
- Replacing a whole note refuses to drop tables, files or colors unless you agree.
- Notes changed by AI are labelled **AI edited**. Select the label to undo, returning the note to how it was before AI edited it; consecutive AI edits are undone together.
- Notes are never added to each conversation turn automatically; AI reads them only through its tools.

See the [guide](./docs/GUIDE.en.md#working-with-an-agent) for the tools and the Markdown they accept.

## Keyboard shortcuts

Press `?` inside Jot to see every shortcut. The common ones:

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Bold / italic / underline | ⌘B / ⌘I / ⌘U | Ctrl+B / I / U |
| Heading 1–3 | ⌥⌘1–3 | Ctrl+Alt+1–3 |
| To-do list / check this to-do | ⇧⌘9 / ⌘↩ | Ctrl+Shift+9 / Ctrl+Enter |
| Move list item up / down | ⌥⇧↑ / ⌥⇧↓ | Alt+Shift+↑ / ↓ |
| Find in note / save now | ⌘F / ⌘S | Ctrl+F / Ctrl+S |
| Search all notes | `/` (outside a text field) | same |

“Open Jot”, “New note” and “Capture selected text” have no default keys. Search for “Jot” in DSH's keyboard shortcut settings to bind them.

## FAQ

**How is this different from asking AI to “remember”?** Jot's notes are documents you can see, edit and export. They are never silently rewritten or injected into each turn; AI reads or writes them only when the switch is on and you ask.

**Will uninstalling or upgrading lose notes?** No. Notes live in the DSH data folder, separate from the plugin package, and older versions can still read notes saved by newer ones.

**Where are notes stored, and how do I back them up?** In `$DSH_HOME/jot` (`~/.dsh/jot` when unset); back up the whole folder. Desktop and Web share notes when they use the same data folder. Attachments default to 20 MiB each and 500 MiB in total.

**Why does an action mention “kept drafts”?** Another panel has unsaved changes to that note. Open it and load the latest version or save the draft as a new note first, so neither side's writing is lost.

## Compatibility

Works with DSH 0.2.0-rc.2 (official macOS Desktop) and 0.2.1-alpha.1 (Web). Windows and Linux pass CI source checks, but the UI and shortcuts have not been tested on actual systems; each release's actual checks are in the [validation record](./docs/VALIDATION.md). Cloud sync, real-time collaboration, version history and drawing are not included.

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
