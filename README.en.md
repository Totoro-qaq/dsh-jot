<p align="center"><img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/assets/readme/jot-icon.svg" width="56" height="56" alt="Jot"></p>

<h1 align="center">Jot</h1>

<p align="center"><strong>A notebook beside your conversation.</strong><br>Notes for DeepSeek Harness. Write, check things off, or ask AI to save what you just agreed on.</p>

<p align="center"><a href="#get-started">Install</a> · <a href="./docs/GUIDE.en.md">User guide</a> · <a href="./README.md">简体中文</a></p>

![In a real DSH conversation, AI adds the agreed tasks to Weekly sync; the note shows AI edited, and a person checks off one task](https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/jot-demo-en.gif)

<sub>Recorded in DSH, with generation waits accelerated. People and plans are fictional.</sub>

## Leave the meeting with the next steps already written

Maya has the designs on Thursday, Leo finishes integration on Friday, and Nina tests on Sunday. Say “Add those three to-dos to Weekly sync in Jot, with the owners and dates.” Then read, edit, and check them off right beside the conversation.

You can also write on your own, add tables, images, and attachments, or search the title and body of an older note. Use folders if they help; name them your way.

## Let AI help. Keep the final say.

AI collaboration starts off. Turn it on when you want help. When AI changes an existing note, the “AI edited” mark lets you undo that round of changes and carry on writing yourself.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/undo-en-dark.png">
  <img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/undo-en-light.png" width="600" alt="Selecting AI edited opens the confirmation to undo the latest round of AI changes to Weekly sync">
</picture>

## Bring your notes in. Take the finished work with you.

Import an Obsidian Markdown vault, a folder, or a few TXT files, together with the images and attachments your notes reference. After the meeting, export Word or PDF for a colleague, Markdown or TXT for another app, or a restorable ZIP of your whole library.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/transfer-en-dark.png">
  <img src="https://raw.githubusercontent.com/Totoro-qaq/dsh-jot/main/docs/media/transfer-en-light.png" width="1100" alt="The library menu offers Import notes and Export these notes next to the completed meeting note">
</picture>

## Get started

```sh
# Desktop app
dsh plugin --profile desktop add dsh-jot

# Web UI
dsh plugin --profile web add dsh-jot
```

Restart DSH and open **Jot** in the left navigation. In a conversation, type `/jot` to open, create, or find a note in the right sidebar.

Install separately for Desktop and Web. The official desktop app can enable its bundled CLI through **Manage dsh Command…**. The CLI requires Node.js `^22.19.0 || >=24`. See the [guide](./docs/GUIDE.en.md#install-upgrade-and-remove) for updates, removal, and source builds.

<details>
<summary>Compatibility and your data</summary>

Supports DSH 0.2.0-rc.2 and 0.2.1-alpha.1. Verified in the official macOS Desktop app and DSH Web; Windows and Linux pass source checks in CI, but their native UI and shortcuts have not been tested on those systems. See the [validation record](./docs/VALIDATION.md) for version-specific coverage.

Notes live in DSH's local data directory, separately from the plugin package, and remain after uninstalling. Content read by AI tools enters the current model conversation; writing notes does not require AI. There is no cloud sync, live multi-user editing, full version history, or drawing. The [guide](./docs/GUIDE.en.md) covers AI undo, attachment previews, import/export limits, and backups.

</details>

[Shortcuts](./docs/GUIDE.en.md#shortcuts) · [AI collaboration](./docs/GUIDE.en.md#working-with-an-agent) · [Data and backups](./docs/GUIDE.en.md#data-and-conflicts) · [Report an issue](https://github.com/Totoro-qaq/dsh-jot/issues)

[Releases](https://github.com/Totoro-qaq/dsh-jot/releases) · [npm](https://www.npmjs.com/package/dsh-jot) · [MIT](./LICENSE) · [Font license](./assets/fonts/OFL.txt)
