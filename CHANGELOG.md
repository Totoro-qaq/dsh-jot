# Changelog

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
