import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { AttachmentStore } from '../src/attachments.js'
import { exportJotLibrary } from '../src/exports.js'
import { createJotHandler } from '../src/http.js'
import { importArchive, splitMarkdownTitle } from '../src/imports.js'
import { docToMarkdown } from '../src/markdown.js'
import { documentAttachmentIds, validateRichDoc, StoreError, type RichDoc } from '../src/model.js'
import { JotStore } from '../src/store.js'
import { importFile, noteReferences, packImport, ImportPackError, type ImportFile } from '../src/client/import-files.js'

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' + '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')
const code = (expected: string) => (error: unknown) => error instanceof StoreError && error.code === expected

async function library(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jot-import-'))
  t.after(async () => { await rm(directory, { recursive: true, force: true }) })
  const store = new JotStore({ directory })
  const attachments = new AttachmentStore({ directory })
  const verify = async (content: RichDoc) => attachments.assertReferences([...documentAttachmentIds(content)])
  const run = (archive: Uint8Array, locale: 'zh' | 'en' = 'zh') => importArchive(archive, { store, attachments, verify, locale })
  return { directory, store, attachments, verify, run }
}

test('a Jot library export restores exactly, in any format, and importing it again adds nothing', async t => {
  const source = await library(t)
  const image = await source.attachments.upload({ name: '示意图.png', mimeType: 'image/png', bytes: PNG })
  const folder = await source.store.createFolder('工作')
  const content = validateRichDoc({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '红字', marks: [{ type: 'textStyle', attrs: { color: '#dc2626' } }] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colwidth: [140] }, content: [{ type: 'paragraph' }] }] }] },
    { type: 'image', attrs: { attachmentId: image.id, alt: '示意图' } },
  ] })
  await source.store.createNote({ title: '周会', content, folderId: folder.id, pinned: true })
  await source.store.createNote({ title: '未分类' })
  const state = await source.store.readState()
  const loader = async (id: string) => { const { attachment, bytes } = await source.attachments.content(id); return { name: attachment.name, mimeType: attachment.mimeType, size: bytes.length, data: bytes } }
  for (const format of ['docx', 'md'] as const) {
    const exported = await exportJotLibrary({ notes: state.notes, folders: state.folders }, format, { attachmentLoader: loader })
    const target = await library(t)
    const summary = await target.run(exported.buffer)
    assert.deepEqual(summary, { source: 'jot', notes: 2, skipped: 0, folders: 1, attachments: 1, missing: 0, unreadable: 0 })
    const restored = await target.store.readState()
    const meeting = restored.notes.find(note => note.title === '周会')!
    assert.equal(meeting.pinned, true)
    assert.equal(restored.folders.find(item => item.id === meeting.folderId)!.name, '工作')
    assert.equal(meeting.updatedAt, state.notes.find(note => note.title === '周会')!.updatedAt, 'dates come back too')
    const [stored] = documentAttachmentIds(meeting.content)
    assert.deepEqual((await target.attachments.content(stored!)).bytes, PNG)
    // Identical apart from the new file id: colors and table widths are kept, unlike Markdown.
    assert.equal(JSON.stringify(meeting.content).replaceAll(stored!, image.id), JSON.stringify(content))
    const files = await readdirCount(target.directory)
    const again = await target.run(exported.buffer)
    assert.deepEqual([again.notes, again.skipped], [0, 2])
    assert.equal((await target.store.readState()).notes.length, 2)
    assert.equal(await readdirCount(target.directory), files, 'the identical image is reused, not stored twice')
  }
})

test('Markdown folders become notes and folders, with their images, titles and dates', async t => {
  const target = await library(t)
  const modified = Date.UTC(2025, 0, 2)
  const archive = zipSync({
    'Vault/计划.md': strToU8('---\ntitle: 来自属性\ntags: [x]\n---\n# 发布计划\n\n- [ ] 准备\n  - [x] 子项\n\n![截图](img/shot.png)\n\n见 [[会议记录|会议]] 和 [其他](其他.md)\n\n![[diagram.png]]\n\n![丢失](missing.png)'),
    'Vault/工作/周会.md': strToU8('没有标题时用文件名\n\n```js\n# not a heading\n```'),
    'Vault/工作/备忘.txt': strToU8('第一行\n- 不是列表\n'),
    'Vault/img/shot.png': PNG,
    'Vault/assets/diagram.png': PNG,
    'Vault/.obsidian/app.json': strToU8('{}'),
    '.jot-import.json': strToU8(JSON.stringify({ version: 1, modified: { 'Vault/计划.md': modified } })),
  })
  const summary = await target.run(archive)
  assert.deepEqual(summary, { source: 'markdown', notes: 3, skipped: 0, folders: 1, attachments: 2, missing: 1, unreadable: 0 })
  const { notes, folders } = await target.store.readState()
  assert.deepEqual(folders.map(folder => folder.name), ['工作'], 'the picked folder itself is not a Jot folder')
  const plan = notes.find(note => note.title === '发布计划')!
  assert.equal(plan.folderId, null)
  assert.equal(plan.updatedAt, new Date(modified).toISOString())
  assert.deepEqual(plan.content.content.map(block => block.type), ['taskList', 'image', 'paragraph', 'image', 'paragraph'])
  assert.equal(plan.content.content[0]!.content![0]!.content![1]!.type, 'taskList', 'nested checklist items stay nested')
  assert.equal(plan.text.split('\n')[3], '见 会议 和 其他', 'links to other notes keep their words')
  assert.match(plan.text, /!\[丢失\]\(missing\.png\)/u, 'a missing image stays visible as text')
  const week = notes.find(note => note.title === '周会')!
  assert.equal(folders[0]!.id, week.folderId)
  assert.deepEqual(week.content.content.map(block => block.type), ['paragraph', 'codeBlock'])
  const memo = notes.find(note => note.title === '备忘')!
  assert.deepEqual(memo.content.content.map(block => block.type), ['paragraph', 'paragraph'], 'text files stay literal')
})

test('older Markdown exports import with their escapes and HTML formatting decoded', async t => {
  const target = await library(t)
  const archive = zipSync({ '项目/v1.2.md': strToU8('# 版本 v1\\.2\n\n<u>下划线</u> 和 <span style="color:#dc2626">红字</span> &amp; 1\\. 不是列表\n\n- [x] 完成  \n  第二行') })
  await target.run(archive)
  const [note] = (await target.store.readState()).notes
  assert.equal(note!.title, '版本 v1.2')
  assert.equal(docToMarkdown(note!.content).split('\n')[0], '<u>下划线</u> 和 <span style="color:#dc2626">红字</span> & 1. 不是列表')
  assert.equal(note!.content.content[1]!.type, 'taskList')
})

test('a front matter title is used only when it is metadata, and a heading wins', () => {
  assert.deepEqual(splitMarkdownTitle('---\ntitle: "引号"\n---\nBody'), { body: 'Body', title: '引号' })
  assert.deepEqual(splitMarkdownTitle('---\n只是分隔线\n---\nBody'), { body: '---\n只是分隔线\n---\nBody' })
  assert.deepEqual(splitMarkdownTitle('# **粗体**标题\nBody'), { body: 'Body', title: '粗体标题' })
})

test('imports refuse what they cannot use and leave no stored files behind', async t => {
  const target = await library(t)
  await assert.rejects(target.run(strToU8('not a zip')), /not a readable ZIP/u)
  await assert.rejects(target.run(zipSync({ 'photo.png': PNG })), /no Markdown or text files/u)
  // A note too large for Jot fails the whole import, and its uploaded image is removed again.
  const huge = zipSync({ 'a.md': strToU8('![x](x.png)'), 'b.md': strToU8('y'.repeat(210_000)), 'x.png': PNG })
  const summary = await target.run(huge)
  assert.deepEqual([summary.notes, summary.unreadable], [1, 1], 'an over-long note is reported, the rest imports')
  const before = await readdirCount(target.directory)
  const failing = zipSync({ 'a.md': strToU8('![x](x.png)'), 'x.png': PNG })
  const original = target.store.importNotes.bind(target.store)
  target.store.importNotes = async () => { throw new StoreError('PERSISTENCE_ERROR', 'disk full') }
  await assert.rejects(target.run(failing), code('PERSISTENCE_ERROR'))
  target.store.importNotes = original
  assert.equal(await readdirCount(target.directory), before, 'files uploaded for a failed import are removed')
  const manifest = zipSync({ 'jot-library.json': strToU8(JSON.stringify({ format: 'dsh-jot-library', version: 2, notes: [], folders: [], attachments: [] })) })
  await assert.rejects(target.run(manifest), /newer Jot/u)
})

async function readdirCount(directory: string) {
  const { readdir } = await import('node:fs/promises')
  return (await readdir(join(directory, 'attachments')).catch(() => [])).filter(name => name.endsWith('.blob')).length
}

test('HTTP imports one ZIP and refuses other bodies', async t => {
  const target = await library(t)
  const server = createServer(createJotHandler(target.store, { authorize: () => undefined, attachments: target.attachments }))
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => resolve()) }) })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const post = (body: Uint8Array, type = 'application/zip') => fetch(`${base}/jot/api/import?locale=en`, {
    method: 'POST', headers: { origin: base, 'content-type': type }, body: body as Uint8Array<ArrayBuffer>,
  })
  const imported = await post(zipSync({ 'note.md': strToU8('# Imported\n\n![gone](gone.png)') }))
  assert.equal(imported.status, 200)
  assert.deepEqual((await imported.json()).data, { source: 'markdown', notes: 1, skipped: 0, folders: 0, attachments: 0, missing: 1, unreadable: 0 })
  assert.equal((await post(strToU8('{}'), 'application/json')).status, 415)
  const broken = await post(strToU8('nope'))
  assert.equal(broken.status, 400)
  assert.match((await broken.json()).error.message, /not a readable ZIP/u)
})

const picked = (path: string, data: string | Uint8Array, lastModified = 1): ImportFile => {
  const bytes = typeof data === 'string' ? strToU8(data) : data
  return { path, size: bytes.byteLength, lastModified, read: async () => bytes }
}

test('the client packs picked notes with only the files they use, and passes a ZIP through', async t => {
  const blob = await packImport([
    picked('Vault/a.md', '![x](img/x.png) ![[y.png]] [doc](<../outside.pdf>)', 42),
    picked('Vault/img/x.png', PNG), picked('Vault/other/y.png', PNG), picked('Vault/unused.png', PNG),
    picked('Vault/.obsidian/workspace.json', '{}'), picked('Vault/notes.txt', 'plain'),
  ])
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  assert.deepEqual(Object.keys(entries).sort(), ['.jot-import.json', 'Vault/a.md', 'Vault/img/x.png', 'Vault/notes.txt', 'Vault/other/y.png'])
  assert.deepEqual(JSON.parse(new TextDecoder().decode(entries['.jot-import.json'])).modified['Vault/a.md'], 42)
  const zip = new File([zipSync({ 'a.md': strToU8('x') }) as Uint8Array<ArrayBuffer>], 'backup.zip', { type: 'application/zip' })
  assert.equal(await packImport([importFile(zip)]), zip)
  await assert.rejects(packImport([importFile(zip), picked('a.md', 'x')]), (error: unknown) => error instanceof ImportPackError && error.problem === 'mixed-archive')
  await assert.rejects(packImport([picked('photo.png', PNG)]), (error: unknown) => error instanceof ImportPackError && error.problem === 'empty')
  const references = noteReferences('Vault/notes/a.md', '![](../img/%E5%9B%BE.png) [[Note|alias]] [web](https://x.test/a.png)')
  assert.ok(references.paths.has('Vault/img/图.png'))
  assert.ok(references.names.has('note'))
  assert.ok(![...references.paths].some(path => path.includes('x.test')))
  t.diagnostic('packing reads only the files the notes use')
})
