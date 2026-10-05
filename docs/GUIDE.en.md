# Jot guide

[Back to README](../README.en.md) · [中文指南](GUIDE.zh-CN.md) · [Changelog](../CHANGELOG.md) · [Validation](VALIDATION.md)

Jot is a human-owned notes and lightweight-document workbench for DSH. Write paragraphs, lists and to-dos directly, and let an agent help maintain them when you choose. Version 0.2.5 is compatible with **DeepSeek Harness 0.2.0-rc.2 and 0.2.1-alpha.1**, using each platform's macOS, Windows or Linux keyboard conventions. See the [validation record](VALIDATION.md) for the actual Web, native Desktop and operating-system checks.

## Interface

### Entries

- **Jot** in the left navigation opens the full workbench without selecting a conversation. The workbench reopens the note you were last reading.
- During a conversation, choose **Jot** in the official right sidebar's new-tab guide. The compact tab switches between the list and a note and adds nothing to the chat composer.
- The development build adds `/jot`: type it in the chat composer and press Enter, or choose **Open Jot** from the slash menu, to open a picker. **Open Jot** is preselected, so pressing Enter again opens the right-sidebar tab; you can also choose **New note**, or type to find a pinned or recent note and open it directly. Choosing consumes the `/jot` token and preserves other draft text and attachments; Escape closes the picker and leaves `/jot` in the composer.
- **Open full notes** in the compact tab carries the current note and any unsaved draft into the workbench.

### Note list

- **Recent** shows every pinned note and the five most recently edited ones; **All** groups notes by date in one continuous list; **Trash** keeps deleted notes. The count beside the views, such as “6 notes”, is the length of the current list.
- Search matches titles and body text, ranks title matches first and shows the text around body matches. Searching from **Recent** covers every note. Inside Jot, outside a text field, press `/` to search.
- When nothing matches but other folders or Trash do, Jot says how many and offers **Search all folders** or **Show in Trash**, keeping your search words.
- **Sort and options** sorts by last modified, date created or title (Recent always uses last modified) and starts multi-select for moving notes or moving them to Trash. It also holds **Export all notes…** and **Keyboard shortcuts**.
- Each row shows the time, checklist progress such as `2/5`, its folder, and an **AI edited** label when the latest saved version came from AI. Untitled notes borrow their first line as the displayed title.
- Folders are optional and named by you. Without folders, create the first one from **Sort and options**. Once folders exist, a folder filter and **Folder actions** (new, rename, delete; deleting keeps its notes) appear at the top of the list.
- In the workbench, drag the list's right edge to resize it (double-click to reset), or hide the list with the button in the top-right corner to focus on writing. The title, formatting toolbar and body share a left edge, with a readable maximum width and spare space on the right.

### Editing

- **New** puts the cursor in the title; press Enter to continue in the body. An untouched new empty note is removed when you leave it. Notes you have edited, pinned or moved to a folder are kept, even if you later clear the body.
- Bold, italic, underline and checklist are always on the toolbar. **Style** offers body text, headings 1–3, bullet and numbered lists, quote, code block, strikethrough, inline code, divider, clear formatting, seven text colors and six highlights, each with its shortcut beside it (hidden in narrow panes, still shown on hover). Colors switch to readable shades in dark themes; saving and export keep the original palette.
- Type `/` on an empty line for the insert menu: body text, headings 1–3, to-do list, bullet and numbered lists, quote, code block, table, divider and **Image or file**. Chinese input methods produce `、` from the same key, which works too. Keep typing to filter in Chinese, English or pinyin initials (`/bt` finds headings). Use ↑/↓ to choose, Enter or Tab to insert, and Escape to close while keeping what you typed. The menu opens only when the line holds nothing but the symbol and the filter with the caret at its end, so `/` and `、` inside sentences are unaffected; it never opens in tables.
- You can also type `# `, `- `, `1. `, `[ ] `, `> `, `---` or `**bold**` to format as you write.
- In a to-do, Mod+Enter checks or unchecks it. In a list or checklist, Alt+Shift+↑/↓ moves the current item up or down; nested items move within their own level.
- **Find** searches, jumps and replaces inside the current note; Replace all is one undo step. Notes in Trash can be searched but not edited.
- The top-right status shows saving. Notes save automatically; click **Unsaved** or press Mod+S to save immediately. A failure reads **Save failed · Retry**.

### Deleting and Trash

- **Move to Trash** does not ask for confirmation; the notice at the bottom offers **Undo**. The same applies to moving several selected notes, and Undo restores the whole batch.
- In Trash a note can be restored, duplicated as a new note or exported. **Delete permanently** and **Empty Trash** ask for confirmation and cannot be undone. Images and files used only by the deleted notes are removed with them; files still used by another note, including one in Trash, are kept.

### Capture

The capture button at the top of the workbench or the compact tab takes the currently selected text. Save it as a new note or append it to an existing one; the open note is listed first and selected by default. In the compact tab the current page address is suggested as the source; the workbench leaves it empty.

## Install, upgrade and remove

```sh
# Desktop
dsh plugin --profile desktop add dsh-jot
# Web UI
dsh plugin --profile web add dsh-jot

# Upgrade to the latest version
dsh plugin --profile desktop add dsh-jot@latest
# Remove (notes are kept)
dsh plugin --profile desktop remove dsh-jot
```

Restart the corresponding Host after installing or upgrading. The official Desktop can enable its bundled CLI from the application menu's “Manage dsh command…”. Desktop and Web use separate profiles; installing for Web does not install for Desktop. They share notes when configured with the same data folder.

## Build and local development

Node.js `^22.19.0 || >=24` and pnpm 11.

```sh
git clone https://github.com/Totoro-qaq/dsh-jot.git
cd dsh-jot
pnpm install --frozen-lockfile
pnpm check
pnpm pack:check
pnpm pack --pack-destination artifacts
dsh plugin --profile desktop add /absolute/path/to/dsh-jot/artifacts/dsh-jot-<version>.tgz
```

`pnpm dev` serves a local preview at `http://127.0.0.1:4178` using the same data layer, HTTP adapter and editor. Its header switches between workbench and sidebar, the dark theme and English. Preview data lives in the repository's `.jot-dev/`, separate from real DSH notes. The preview is for UI work; the real plugin uses DSH authentication.

After changing `src/client/icons.tsx`, run `pnpm icons` to regenerate the shipped `assets/icons/*.svg`; a test checks that they match.

## Shortcuts

Editing uses Command on macOS and Ctrl on Windows and Linux:

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Copy / cut / paste / select all | Command + C / X / V / A | Ctrl + C / X / V / A |
| Undo / redo | Command + Z / Shift + Command + Z | Ctrl + Z / Ctrl + Shift + Z; also Ctrl + Y |
| Bold / italic / underline | Command + B / I / U | Ctrl + B / I / U |
| Find in note / save | Command + F / S | Ctrl + F / S |
| Body text / heading 1–3 | Option + Command + 0 / 1–3 | Ctrl + Alt + 0 / 1–3 |
| Bullet / numbered / to-do list | Shift + Command + 8 / 7 / 9 | Ctrl + Shift + 8 / 7 / 9 |
| Quote / code block | Shift + Command + B / Option + Command + C | Ctrl + Shift + B / Ctrl + Alt + C |
| Strikethrough / inline code / highlight | Shift + Command + S / Command + E / Shift + Command + H | Ctrl + Shift + S / Ctrl + E / Ctrl + Shift + H |
| Check or uncheck this to-do | Command + Return | Ctrl + Enter |
| Move this list item up / down | Option + Shift + ↑ / ↓ | Alt + Shift + ↑ / ↓ |
| Search all notes | `/` | `/` |
| Show all shortcuts | `?` | `?` |

Press `?` inside Jot outside a text field, or choose **Keyboard shortcuts** in **Sort and options**, to see this table at any time. Block and text shortcuts are the editor's (Tiptap's) default keys. H4–H6 no longer have keys; older notes and AI-written level 4–6 headings still display normally. Mod+Enter only checks to-dos; elsewhere it keeps its line-break meaning. On the actual Desktop the Host or system may handle some of these keys first; see the [validation record](VALIDATION.md) for checked results.

Clipboard actions stay with the system and editor; formatting and history follow the focused editor. With a note selected in the workbench, Mod+F/S find in or save that note; menus and dialogs keep their own keys. The list supports arrow keys, Home, End and Enter/Space; in selection mode Enter/Space toggles selection. Escape closes menus and dialogs and clears the search box.

Jot registers three commands in DSH's keyboard settings: “Jot: Open Jot”, “Jot: New note” and “Jot: Capture selected text”. Search for `jot` or `随记` in settings to find them. They have **no default keys**; choose your own bindings, and do not treat the combinations used in tests as product defaults. With a conversation visible, commands use the right sidebar; otherwise they open the full workbench. Capture retains the selected text before navigation, and commands do not create background notes while a dialog is open.

Desktop on macOS and Windows handles Host bindings first. While the body has focus, Jot temporarily reserves Mod+B through DSH's public `shortcuts.registerFixed`; on macOS, undo/redo are routed to the note's history through the public `shortcuts.register`, avoiding the Electron Edit menu. These bindings are released on blur or unload and never change user settings. Web and Linux let the editor handle keys first. Jot does not take DSH's Mod+N (new conversation).

## Tables

Click a cell: the **⋯** above the table manages the current column and the **⋮** on the left manages the current row, with insert before/after and delete. The **+** buttons on the right and bottom append a last column or row, independent of the caret. The table icon in the top-right corner opens **Table options**.

Drag a column border to resize it; widths are saved. Press Escape before releasing the drag to cancel it and restore the previous width. Row/column changes and committed width changes support consecutive undo/redo, and autosave does not clear that history. **Table options → Auto fit to available width** clears manual widths. Rows grow with their content, and wide tables scroll horizontally inside their own area. Whole-table zoom and row-height dragging are not provided.

Tables are limited to 200 rows and 50 columns, within the note's total node and 1 MiB size limits. Additions are refused before exceeding a limit; a width drag that would exceed it restores the previous widths and keeps your text. Tables in Trash cannot be changed. Merged cells are preserved when stored, but there are no merge/split controls.

## Attachments and export

### Official previews and opening in an app

Clicking an attachment first uses DSH's official file preview in the selected conversation. From the full workbench, Jot returns to that conversation and opens the preview sidebar; your draft is kept. Word/PowerPoint are converted to PDF by the Host; spreadsheets, text, images and PDF use the matching viewers, subject to the Host's formats and limits. No conversation is created and nothing is copied into a project.

Without a selected conversation or a matching viewer, Jot shows its own attachment dialog with downloads. When the Host can open desktop applications, the dialog also offers **Open in default app** using the file associations of macOS, Windows or a Linux desktop. Over a remote Web connection this opens on the computer running DSH, not the browser's computer. The application opens a verified copy; changes do not sync back into the note.

### Limits and cleanup

Attachments default to **20 MiB** each and **500 MiB / 1,000 files** per data folder; the interface adds at most 20 files at a time. `attachmentMaxBytes` and `attachmentMaxTotalBytes` adjust the byte limits. Files are stored as managed local files; notes keep only attachment IDs, never arbitrary paths.

| Type | Without the official viewer |
| --- | --- |
| PNG, JPEG, GIF, WebP | Inline images and a preview dialog |
| PDF | Preview dialog, using the DSH/browser PDF viewer |
| Word, Excel, PowerPoint, Markdown, TXT, SVG, audio, video, etc. | File card, download, and default-app opening when available |

Any extension can be uploaded; storing a file does not mean it can be parsed or previewed. Images are recognised by their bytes, up to 10,000 px per side and 40 megapixels. Search covers titles, body text and file names/captions, not PDF contents or OCR.

Attachments are cleaned up when notes are deleted permanently or Trash is emptied: files referenced only by the deleted notes are removed, and files still used elsewhere stay. Removing a file card from the body, or only moving a note to Trash, keeps the file.

### Export

| Format | Contents |
| --- | --- |
| TXT | Title, body, list/to-do states, table text and attachment names |
| Markdown | Formatting, lists/to-dos and tables; with attachments, a ZIP with `note.md` and `assets/` whose links need no DSH login |
| PDF | Embedded Chinese fonts, common styles, vector checkboxes, paginated tables, page numbers and PNG/JPEG images |
| Word (DOCX) | Text formatting, numbered lists, to-do states, tables and PNG/JPEG images |

Single-note exports use the current draft; saving first is not required. Each export may reference up to 100 distinct attachments, with attachment bytes and the final file each limited to 50 MiB. PDF tables wider than 8 columns become labelled text; merged-cell content is kept but borders are approximated. PDF/DOCX keep names for GIF, WebP and other files. PDF embeds `assets/fonts/NotoSansSC-*.otf` under the [SIL Open Font License 1.1](../assets/fonts/OFL.txt); DOCX fonts depend on the reader. Exports are not pixel-identical to the editor.

### Exporting many notes

**Sort and options → Export all notes…** packages notes into one ZIP. With a folder or **Unfiled** selected, the item reads **Export these notes…** and exports only the current filter. Notes in Trash are never exported. Choose a format:

| Format | Best for |
| --- | --- |
| Word (.docx, default) | Opens in Word, WPS and Pages, with PNG/JPEG images embedded |
| PDF | Fixed layout for reading, printing and sharing |
| Markdown | Plain text for Obsidian and other note apps; images link to the attachments folder |

The ZIP holds one file per note in a directory per folder, with unfiled notes at the top level. Notes with the same name get “(2)” and so on; untitled notes are named after their first line. Every referenced file is included once, as the original, in `attachments/` (`附件/` in the Chinese interface), so GIF, WebP and other files that Word or PDF cannot embed are kept. The note you are editing is saved before exporting.

One export holds at most 2,000 notes, or 500 as PDF because each PDF embeds its own Chinese font. Attachments and the final file are each limited to 200 MiB. For more, export one folder at a time or choose Word.

## Working with an agent

**Allow AI collaboration** is off by default; you turn it on or off at the bottom of the list. When it is on, the agent can use:

| Tool | Purpose |
| --- | --- |
| `jot_list` | Search notes; returns bounded summaries and folder names |
| `jot_read` | Read a note's text, numbered to-do items and current revision |
| `jot_create` | Create a note; text supports simple Markdown |
| `jot_update` | Append (preferred), retitle, move to a folder or replace the text, using the current revision |
| `jot_set_task` | Check or uncheck one numbered to-do item |
| `jot_delete` | Move a note to Trash |

- Text is converted from simple Markdown by default: `#` headings, `-`/`1.` lists, `- [ ]`/`[x]` to-dos, `>` quotes, ```` ``` ```` code, `---` dividers, `| tables |`, plus `**bold**`, `*italic*`, `` `code` ``, `~~strike~~` and `[links](https://…)`. HTML always stays literal text. With `format: "plain"` every line becomes a plain paragraph.
- Appended list or to-do items join a list of the same kind at the end of the note, so “add a to-do” extends the checklist instead of starting another.
- Replacing the whole text is refused when the note has tables, images, files, colors or underline, so they are not flattened. The agent may retry with `allowFormattingLoss: true` only after you agree.
- Updates, ticks and deletions require the exact `revision`, so other edits are never overwritten. Every call checks the current switch; the agent cannot turn its own access on.
- Versions saved by AI are labelled **AI edited** in the list and the editor toolbar until you edit the note. The label is recorded separately in `jot.activity.json`, so older plugin versions still read the notes unchanged.
- Select **AI edited** in the editor toolbar, or choose **Undo AI edits…** under **More note actions**, and confirm to return the note to how it was before AI edited it, saved as a new version of yours. Consecutive AI edits count as one run and are undone together; if you edited in between, only the latest run is undone. Only you can undo, including after turning AI collaboration off, and the AI version is not kept.
- The version from before AI edits lives in `jot.agent-undo/`, at most one per note, and is removed when you edit, undo or permanently delete the note.
- With AI collaboration on, notes without an **AI edited** label show a small icon in the editor toolbar as a reminder that AI can read and edit notes when you ask.

The switch controls Jot's tools, not system-level file access. Notes are not automatically added to every model request; explicit reads or searches can include their content in the model's context.

## Data and conflicts

The default data folder is `$DSH_HOME/jot`, or `~/.dsh/jot` when `DSH_HOME` is unset; the plugin's `directory` option can change it. People and the agent share this folder, and a file lock protects changes across processes.

- `jot.json`: notes, folders and the AI switch.
- `jot.json.bak`: the last valid state before the latest save.
- `jot.activity.json`: optional AI-edited labels; if missing or damaged, labels simply do not show.
- `jot.agent-undo/`: optional versions from before AI edits, for undoing them; if missing or damaged, the undo is simply unavailable.
- `.jot.lock`: the read/write lock, recording the owner PID.
- `attachments/`: managed attachment files, `manifest.json` and their lock.

A note is limited to 1 MiB and 200,000 JavaScript string units of text; the whole library to 32 MiB. The interface checks for updates every 3 seconds; when nothing changed the Host answers “not modified”, and checks pause while the window is in the background.

Damaged or unknown data is refused rather than replaced with an empty library, and the original files are kept. If a crash leaves a lock behind, confirm that its process has ended before removing the lock; never clear the notes file to resolve a lock. File replacement is atomic, but the latest save is not guaranteed to survive a power loss.

When another panel or the agent changes the note you are editing, Jot says “This note has a newer version. Your draft is still here.” You can load the latest version or save your draft as a new note.

## Validation and limits

`pnpm check` covers typechecking, persistence, cross-process concurrency, revision conflicts, agent gating, HTTP authentication boundaries, Markdown conversion, permanent deletion and attachment cleanup, client draft protection and icon-asset consistency, and builds the Host and Client. `pnpm pack:check` verifies the module factory, package identity and shared React imports. See the [validation record](VALIDATION.md) for actual Host, interface and packaging checks; the shared Web plugin interface does not substitute for testing the native Desktop shell.

Cloud sync, real-time collaboration, version history, free drawing/annotation and automatic background summaries are not included. Batch actions check revisions note by note; completed changes are kept if a later one fails, so they are not all-or-nothing.

## License

Plugin: MIT. Bundled fonts: [SIL Open Font License 1.1](../assets/fonts/OFL.txt).
