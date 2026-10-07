# Changelog

## Unreleased

### Import

- **Import notes…** (under **Sort and options**, and in an empty library) adds Markdown (.md, .markdown) and text files, a whole folder such as an Obsidian vault, or a ZIP exported from Jot. Subfolders become folders, titles come from a leading heading or the file name, and the images and files the notes use are stored with them; Obsidian `[[links]]`, `![[embeds]]` and `==highlights==` are understood. Notes identical to existing ones are skipped and identical files are reused, so importing a backup twice adds nothing. One import holds up to 2,000 notes and 200 MiB, and it is written in one save: a failed import keeps no notes and removes its uploaded files.
- Library exports now carry `jot-library.json`, the exact notes with their folders, pins and dates, so a ZIP in any format restores losslessly. Older exports import from their Markdown files.

### AI collaboration

- `jot_read` returns the note as Markdown instead of plain text, so an agent sees headings, nested lists, bold, links, colors, underline and attachments. Formatting Markdown cannot carry, such as table column widths, is listed in `notInMarkdown`.
- `jot_update` accepts `edits`: exact find-and-replace inside a paragraph that keeps the surrounding formatting, with `all` for every occurrence. Changing one word no longer means rewriting the note.
- A whole-text rewrite is refused only when the note's Markdown would not convert back unchanged. Previously a rewrite could silently turn headings, lists, quotes and code into plain paragraphs, drop bold and link addresses, and make a `#` comment in a code block a heading.
- Agent Markdown supports nested lists, `==highlight==`, `<u>`, colored `<span>`, `<br>` and `![…](attachment:…)` lines for existing files, and CommonMark escapes. `<b>` and the other formatting tags now count as formatting; unknown HTML stays literal.
- Jot's tools are registered with DSH only while **Allow AI collaboration** is on, so a disabled Jot adds no tool definitions to model requests. A switch flipped in another process sharing the notes folder is noticed within about 10 seconds.

### Syncing

- Remote appends merge into edits within existing blocks or a shared append history, without repeating content another panel already saved. Divergent additions remain a conflict. Title, folder and pin changes merge when they do not conflict. The caret stays put and Undo does not take back the other change.
- An unchanged poll is answered from file identities without taking the lock or reading the notes file, and a changed library is sent as the notes that changed. Saving no longer downloads the whole library again.

### Review fixes

- Prevent duplicate content when two panels hold the same appended draft; keep ambiguous overlapping additions for human resolution.
- Treat ZIPs inside a selected folder as ordinary attachments, and ignore unreferenced or hidden ZIP backups. Standalone ZIP selection still imports one archive at a time.

### Verification

Local `pnpm check` passed **344 tests**, typecheck and Host/Client builds; packaging checks passed. Official **DSH 0.2.1-alpha.1 Web** and **0.2.0-rc.2 macOS Desktop** both passed exact 200 MiB UI uploads and same-turn tool removal: after switching collaboration off, stale tool calls were refused and the next model request carried no Jot tools. The model endpoint was a local deterministic fixture; the DSH agent loop and serialized requests were real. Desktop's native folder chooser imported two notes, their subfolder and a referenced ZIP, ignoring unused and hidden ZIPs. Precise edits, draft merging and change-only polling retain their unit/preview coverage; Windows/Linux native UI remains unverified. See the [validation record](./docs/VALIDATION.md) for the exact candidate and scope.

## 0.2.6 — 2026-10-05

### Writing

- Type `/` on an otherwise empty line for an insert menu: body text, headings 1–3, to-do list, bullet and numbered lists, quote, code block, table, divider and **Image or file**. The Chinese input method's `、` (the same key) opens it too, and the filter matches Chinese, English and pinyin initials. A `/` or `、` inside a sentence, or in a table, stays literal.
- Mod+Enter checks or unchecks the to-do holding the caret; Alt+Shift+↑/↓ moves the current list or to-do item within its own list.
- **Style** shows each block and text shortcut beside its row, toolbar tooltips include them, and `?` (or **Sort and options → Keyboard shortcuts**) opens a reference of every key Jot handles, including where to bind the three DSH commands.

### Organizing and export

- `/jot` now opens a picker: **Open Jot** stays preselected, so Enter twice behaves as before, and **New note** or any pinned or recent note opens directly in the conversation's sidebar tab. A stale picker cannot act in another conversation, and a failed note list still offers Open and New.
- **Export all notes…** packages every note, or the selected folder, into one ZIP of Word, PDF or Markdown files sorted into folders. Word and PDF embed PNG/JPEG images; every referenced file is also included once as its original. Up to 2,000 notes, 500 as PDF, and 200 MiB.
- Moving several selected notes to Trash no longer asks for confirmation; the notice offers **Undo** for the whole batch, matching single notes.
- An empty search names where matches do exist (other folders or Trash) and switches there in one click, keeping the search words. Searching from Recent already covers every note, which the old hint implied it did not.
- The list count reads “6 notes” rather than a bare number.

### AI collaboration

- **Undo AI edits**: select the **AI edited** label, or use **More note actions**, to restore the version from before the latest run of agent edits as a new human revision. Consecutive agent edits are undone together. Only the user can undo, including with AI access off. The earlier version is kept per note in `jot.agent-undo/`, separate from `jot.json`, so older plugin versions read notes unchanged.
- With AI collaboration on, the editor toolbar shows a small reminder icon on notes without an **AI edited** label.

### Fixed

- To-do checkboxes announced English labels (“Task item checkbox for …”) twice in the Chinese interface. Labels follow the interface language, and the duplicate hidden text is no longer exposed.
- Mod+Alt+4/5/6 created H4–H6 headings that the Style menu could neither show nor offer. Those keys no longer apply; stored H4–H6 still render and export.
- Tables in the compact pane sat a few pixels right of the body text. The table control band now shrinks to the body padding, keeping tables aligned in every width.
- Keep attachments referenced by an active pre-AI version when another note sharing the file is permanently deleted; clean up that version after a successful human revision.
- Stop a library export if its draft cannot be saved, including conflicts or an older autosave still leaving newer text unsaved. Bound generated files and ZIP overhead before retaining the full archive.
- Keep writing that arrives while Undo AI edits is pending, and show a conflict instead of replacing it with the restored version. Pending uploads disable Undo AI edits.
- Refresh checkbox labels when a retained editor changes interface language without remounting it or changing content, selection, history or timestamps.

### Verification

Local `pnpm check` passed **307 tests**, typecheck and Host/Client builds; packaging checks passed. Official **DSH 0.2.1-alpha.1 Web** and **0.2.0-rc.2 macOS Desktop** checks cover the `/jot` picker, checklist keys, insert menu and AI undo. Web also checks three real library ZIP downloads, batch Trash/Undo, scoped search and bilingual screenshots. See the [validation record](./docs/VALIDATION.md) for the exact candidates and remaining native-platform limits. Merge, CI and publication are recorded separately.

### Earlier in this cycle

- Add `/jot` through the official client slash surface. It consumes the command token while preserving other draft text and attachments.
- Keep this contribution isolated from existing Jot entries when the slash service is absent or a client command name is already occupied; stale session invocations cannot navigate another conversation.

## 0.2.5 — 2026-10-05

### Fixed

- Opening a note that ends in a list, table or image no longer saves it. Tiptap's trailing paragraph was reported as an edit, which bumped the revision, re-dated the note in Recent and cleared agent attribution.
- Autosave responses that only normalize document metadata no longer reset the editor's history. Consecutive table changes can be undone and redone across saves.
- Escape cancels an active column-width drag and restores its live preview without saving a new width or adding an undo step. IME composition keeps its own Escape handling.
- Dark themes: the gray text color was nearly invisible and highlights forced dark text on bright fills. Palette colors, highlights and links are now remapped for contrast at render time; stored and exported colors are unchanged.
- Quotes, inline code, code blocks, dividers and links (all reachable by typing) now have styles. Heading 1 no longer outranks the note title.
- List previews no longer show raw `[x]` / `[ ]` checklist markers.
- Note saves validate managed attachment references while holding the note lock, so a concurrent permanent deletion cannot remove a file that another note has just adopted. Preview cleanup keeps its directory and symlink checks.
- Late library responses cannot replace a newer accepted snapshot or restore state from before a successful write. Pending state reads revalidate after a write, including conditional 304 responses.
- Empty-note cleanup applies only to untouched new notes. Human pin/folder changes and writing then clearing the text keep the note.
- A New command received while its panel is busy waits and executes once when ready, rather than being silently dropped. Dialogs continue to block background commands.

### Writing and organizing

- Bold, italic, underline and checklist are always on the toolbar; a floating **Style** menu adds headings 1–3, lists, quote, code block, strikethrough, inline code, divider, clear formatting and colors without pushing the document down.
- **New** focuses the title, Enter moves into the body, and a new note left untouched and empty is removed. The view no longer jumps from Recent to All.
- Untitled notes show their first line; rows show checklist progress (`2/5`) and hide the redundant “Unfiled” label.
- Move to Trash offers **Undo** instead of a confirmation. Notes in Trash can be deleted permanently, and Trash can be emptied; attachments used only by those notes are removed.
- Notices disappear on their own; Host errors are shown in the interface language.
- The workbench reopens the last note, left-aligns the title, formatting toolbar and body beside the list with a readable maximum width, and lets you resize or hide the note list. `/` searches the library; the search box has its own clear button.
- Menus are grouped, with exports under one heading and destructive items last. Sorting is hidden in Recent, where it does not apply. Folder controls appear only once you have folders.
- Capture defaults to appending to the open note and only suggests a source beside a conversation.

### AI collaboration

- Agent text accepts simple Markdown (headings, lists, `- [ ]` to-dos, quotes, code, tables, inline formatting). Appended list items join the list ending the note.
- New `jot_set_task` checks or unchecks one to-do; `jot_read` returns numbered tasks; `jot_list` includes folder names.
- Whole-text replacement is refused for notes with tables, files, colors or underline unless `allowFormattingLoss` is set after the user agrees.
- Notes last saved by AI are labelled **AI edited** until a human edit. Attribution lives in `jot.activity.json`; `jot.json` is unchanged, so older versions still read it.

### Interface and Host

- New product mark: the bookmark rises above the cover and the page carries a check, keeping it distinct from file icons at 16px. New capture, rename, restore, sort, sidebar and AI icons; find uses up/down arrows. `pnpm icons` regenerates `assets/icons`, and a test keeps them in sync.
- Tables align with body text; their controls use a narrower 20px band.
- “Open Jot”, “New note” and “Capture selected text” are registered as DSH keyboard commands without default keys.
- Bind commands to the current session, tab and lifetime before an atomic claim, so retained sidebars cannot create duplicate notes or capture dialogs.
- Use the current public DSH shortcut registrations so all three commands appear in keyboard settings and retain user bindings. Commands respect dialogs; selected text is captured before navigation, and New runs after the target editor mounts.
- Declare compatibility with DSH 0.2.0-rc.2 and 0.2.1-alpha.1, including their Cordis and Schemastery versions. Development DSH dependencies now use 0.2.1-alpha.1.
- The library poll uses an ETag: unchanged libraries return 304, the client skips re-rendering, and polling pauses in hidden windows. The Host also reuses parsed state while the file on disk is unchanged.

Local `pnpm check` passed all **257 tests**, typecheck and build; package checks passed. Actual official **0.2.1-alpha.1 Web** and **0.2.0-rc.2 macOS Desktop** checks cover shortcut settings/bindings, dark appearance, table controls/history, physical resizing and Auto fit. The final runtime also verified single-consumer commands across retained Web conversations and native keyboard actions, plus left-aligned native fullscreen layout. Four bilingual README images were retaken in the final real Host. Native Escape-during-resize and Windows/Linux UI remain unverified; see the [validation record](./docs/VALIDATION.md).

## 0.2.4 — 2026-10-04

- Reuse DSH's file preview for note attachments, including Office documents, spreadsheets, text, images and PDF when the corresponding Host viewer is available. Opening from the full notes workbench returns to the selected Conversation; without a selected Conversation, the existing attachment dialog and downloads remain available.
- Add an explicit default-application opener using the official cross-platform native API. It opens a verified private attachment copy on the serving Host; edits in that application do not replace the uploaded attachment.

## 0.2.3 — 2026-10-03

- Fix a Windows exclusive-file-open permission race while acquiring note and attachment locks. Transient Windows `EPERM` is retried within the existing deadline; persistent permission errors remain failures. Existing locks are never removed to acquire ownership.
- Preserve lock metadata failure handling and the original concurrent-write/security checks.
- Publish this patch as the recommended version following cross-platform source, build and package validation.

## 0.2.2 — 2026-10-03

First public release of **Jot / 随记** for DeepSeek Harness. Earlier local iteration numbers do not represent prior npm releases.

### Notes and documents

- Full notes workbench and a dockable right-sidebar tab beside conversations.
- Direct rich-text editing: headings, bold, italic, underline, checklists, tables, text colors, highlights, images, and attachments.
- Table row/column menus, end-of-table add controls, draggable column widths, and automatic fitting. Row height follows content.
- Title and body search, current-note find/replace, optional user-named folders, recent notes, pins, sorting, duplicates, and multiple selection.
- Text capture into a new or existing note, Trash and restore, and Markdown, TXT, PDF, and Word (DOCX) exports. Markdown with attachments becomes an offline ZIP.

### Human and agent access

- Human editing in every mode, with agent collaboration disabled by default and checked on each tool call.
- Local persistent storage, autosave, recovery drafts, and revision checks for human/agent write conflicts.
- Familiar Command/Control editing shortcuts, with focus-scoped Host shortcut integration.

### Interface

- Colorful notebook product mark, consistent K3 line icons, responsive toolbars, and Host font/theme/text-scaling integration.
- Native sidebar entries and scoped styles instead of a default button in the conversation composer.

### Compatibility and limits

- Targets the official DSH 0.2.0-rc.2 runtime.
- Local typecheck, 142 tests, Host/Client build, and package checks passed, followed by bounded functional checks in the real Web Host and macOS Desktop. See the [validation record](./docs/VALIDATION.md) for the exact scope.
- Images support PNG, JPEG, GIF, and WebP previews. PDF preview depends on the Host viewer; other attachments can be downloaded. Office document editing/preview, cloud sync, real-time collaboration, drawing, and version history are not included.
- Native Windows/Linux Desktop interaction, complete clipboard/IME coverage, long-term stability, and specific third-party plugin combinations remain unverified. CI source checks are separate from native Desktop acceptance.
