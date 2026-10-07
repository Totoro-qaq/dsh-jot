import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { createJotTools, registerJotTools } from '../src/tools.js'
import { JotStore, StoreError } from '../src/store.js'
import { docToMarkdown } from '../src/markdown.js'
import { docFromText, validateRichDoc, type RichDoc } from '../src/model.js'

const code = (expected: string) => (error: unknown) => error instanceof StoreError && error.code === expected

async function fixture(t: TestContext, verifyContent?: (content: RichDoc) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jot-agent-edits-'))
  t.after(async () => { await rm(directory, { recursive: true, force: true }) })
  const store = new JotStore({ directory })
  await store.setAgentEnabled(true)
  const tools = createJotTools(store, { verifyContent })
  const run = (name: string, args: Record<string, unknown>) =>
    tools.find(tool => tool.name === name)!.execute(args as never, { signal: new AbortController().signal } as never) as Promise<any>
  return { directory, store, tools, run }
}

const formatted = validateRichDoc({ type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '发布计划' }] },
  { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [
    { type: 'text', text: '周五前确认' }, { type: 'text', text: '验收范围', marks: [{ type: 'bold' }] },
    { type: 'text', text: '，见' }, { type: 'text', text: '文档', marks: [{ type: 'link', attrs: { href: 'https://example.com/qa' } }] },
  ] }] }] },
] })

test('jot_read gives Markdown, and edits change words without touching the formatting around them', async t => {
  const { store, run } = await fixture(t)
  const note = await store.createNote({ title: 'Plan', content: formatted })
  const read = await run('jot_read', { id: note.id })
  assert.equal(read.markdown, '## 发布计划\n\n- 周五前确认**验收范围**，见[文档](https://example.com/qa)')
  assert.deepEqual(read.notInMarkdown, [])
  const edited = await run('jot_update', { id: note.id, revision: read.revision, edits: [{ find: '周五', replace: '周四' }] })
  assert.deepEqual(edited.replacements, [1])
  const saved = await store.getNote(note.id)
  assert.equal(docToMarkdown(saved.content), '## 发布计划\n\n- 周四前确认**验收范围**，见[文档](https://example.com/qa)')
  await assert.rejects(run('jot_update', { id: note.id, revision: read.revision, edits: [{ find: '周四', replace: '周三' }] }), code('REVISION_CONFLICT'))
  await assert.rejects(run('jot_update', { id: note.id, revision: edited.revision, edits: [{ find: 'nowhere', replace: 'x' }] }), /not in the note/u)
  await assert.rejects(run('jot_update', { id: note.id, revision: edited.revision, edits: [{ find: '周四', replace: 'x' }], appendText: 'y' }), /Choose one of/u)
  assert.equal((await store.getNote(note.id)).revision, edited.revision, 'refused edits change nothing')
})

test('a whole-text rewrite of Markdown the agent read is allowed; one that would lose layout needs consent', async t => {
  const { store, run } = await fixture(t)
  const note = await store.createNote({ title: 'Plan', content: formatted })
  const read = await run('jot_read', { id: note.id })
  const rewritten = await run('jot_update', { id: note.id, revision: read.revision, text: read.markdown.replace('周五', '周四') })
  assert.deepEqual((await store.getNote(note.id)).content.content.map(block => block.type), ['heading', 'bulletList'])
  // Plain text keeps only words, so it is refused for a formatted note unless the user agreed.
  await assert.rejects(run('jot_update', { id: note.id, revision: rewritten.revision, text: 'flat', format: 'plain' }), /all formatting/u)
  const sized = await store.createNote({ title: 'Table', content: validateRichDoc({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colwidth: [160] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] }] },
  ] }] }) })
  const table = await run('jot_read', { id: sized.id })
  assert.match(table.notInMarkdown.join(), /table layout/u)
  await assert.rejects(run('jot_update', { id: sized.id, revision: table.revision, text: table.markdown }), /would remove table layout/u)
  await run('jot_update', { id: sized.id, revision: table.revision, text: table.markdown, allowFormattingLoss: true })
  const plain = await store.createNote({ title: 'Plain', content: docFromText('one\ntwo') })
  await run('jot_update', { id: plain.id, revision: plain.revision, text: 'one\nthree', format: 'plain' })
  assert.equal((await store.getNote(plain.id)).text, 'one\nthree')
})

test('agents can keep and copy stored files only when they exist', async t => {
  const known = 'a'.repeat(32)
  const { store, run } = await fixture(t, async content => {
    const missing = JSON.stringify(content).match(/"attachmentId":"([0-9a-f]{32})"/gu)?.some(match => !match.includes(known))
    if (missing) throw new StoreError('NOT_FOUND', 'This attachment is unavailable')
  })
  const created = await run('jot_create', { title: 'Files', text: `Before\n\n![shot](attachment:${known})` })
  assert.deepEqual((await store.getNote(created.id)).content.content.map(block => block.type), ['paragraph', 'image'])
  await assert.rejects(run('jot_create', { title: 'Bad', text: `![shot](attachment:${'b'.repeat(32)})` }), code('NOT_FOUND'))
  const read = await run('jot_read', { id: created.id })
  assert.equal(read.markdown, `Before\n\n![shot](attachment:${known})`)
  assert.deepEqual(read.notInMarkdown, [])
})

test('the tools are registered only while AI collaboration is on', async t => {
  const { store } = await fixture(t)
  const registered = new Set<string>()
  let released = 0
  const registry = { register(tool: { name: string }) { registered.add(tool.name); return () => { registered.delete(tool.name); released++ } } }
  const tools = registerJotTools(registry, store)
  tools.sync(false)
  assert.equal(registered.size, 0)
  tools.sync(true)
  tools.sync(true)
  assert.deepEqual([...registered].sort(), ['jot_create', 'jot_delete', 'jot_list', 'jot_read', 'jot_set_task', 'jot_update'])
  tools.sync(false)
  assert.equal(registered.size, 0)
  assert.equal(released, 6)
  // A registry failure leaves nothing half registered, and the next sync tries again.
  let calls = 0
  const flaky = registerJotTools({ register(tool: { name: string }) { if (++calls === 3) throw new Error('busy'); registered.add(tool.name); return () => { registered.delete(tool.name) } } }, store)
  assert.throws(() => flaky.sync(true), /busy/u)
  assert.equal(registered.size, 0)
  flaky.sync(true)
  assert.equal(registered.size, 6)
  flaky.dispose()
  assert.equal(registered.size, 0)
})

test('the Store reports the AI switch, including a change made by another process', async t => {
  const { directory, store } = await fixture(t)
  const seen: boolean[] = []
  const stop = store.onAgentAccess(enabled => seen.push(enabled))
  assert.deepEqual(seen, [true], 'a listener hears the current setting at once')
  await store.setAgentEnabled(false)
  await store.setAgentEnabled(false)
  const other = new JotStore({ directory })
  await other.setAgentEnabled(true)
  await store.checkForChanges()
  stop()
  await other.setAgentEnabled(false)
  await store.checkForChanges()
  assert.deepEqual(seen, [true, false, true])
})
