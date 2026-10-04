# Changelog

## 0.2.5 — 2026-10-04

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
- Use the current public DSH shortcut registrations so all three commands appear in keyboard settings and retain user bindings. Commands respect dialogs; selected text is captured before navigation, and New runs after the target editor mounts.
- Declare compatibility with DSH 0.2.0-rc.2 and 0.2.1-alpha.1, including their Cordis and Schemastery versions. Development DSH dependencies now use 0.2.1-alpha.1.
- The library poll uses an ETag: unchanged libraries return 304, the client skips re-rendering, and polling pauses in hidden windows. The Host also reuses parsed state while the file on disk is unchanged.

Local `pnpm check` passed with all **246 tests**; build and package checks passed during prepack. Official DSH **0.2.1-alpha.1 Web** checks cover keyboard settings/bindings, dark colors, table controls, consecutive undo/redo across saves, column-drag cancellation and automatic fitting. The final functional candidate also passed bounded native **0.2.0-rc.2 Desktop** keyboard, dark-color, saved table-history, physical resizing and Auto fit checks. Native Escape-during-resize remains unverified. A subsequent CSS-only candidate left-aligns the wide document; it is installed with compiled hashes verified and notes/settings/bindings preserved, while its layout checks and new screenshots are pending. See the [validation record](./docs/VALIDATION.md) for candidate-specific evidence.

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
