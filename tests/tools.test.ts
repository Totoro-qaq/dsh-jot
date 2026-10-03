import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { createJotTools } from '../src/tools.js'
import { JotStore, StoreError } from '../src/store.js'
import { docFromText } from '../src/model.js'

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jot-tools-'))
  t.after(async () => { await rm(directory, { recursive: true, force: true }) })
  const store = new JotStore({ directory })
  const tools = createJotTools(store)
  async function run(name: string, args: Record<string, unknown>) {
    const tool = tools.find(candidate => candidate.name === name)
    assert.ok(tool, `missing tool ${name}`)
    return tool.execute(args as never, { signal: new AbortController().signal } as never) as Promise<any>
  }
  return { store, tools, run }
}
const code = (expected: string) => (error: unknown) => error instanceof StoreError && error.code === expected

test('every agent tool checks the live user preference and cannot turn it on', async t => {
  const { store, tools, run } = await fixture(t)
  const note = await store.createNote({ title: 'Human', content: docFromText('Human content') })
  const calls = [
    ['jot_list', {}], ['jot_read', { id: note.id }], ['jot_create', { title: 'New', text: 'Body' }],
    ['jot_update', { id: note.id, revision: note.revision, appendText: 'Change' }],
    ['jot_delete', { id: note.id, revision: note.revision }],
  ] as const
  for (const [name, args] of calls) await assert.rejects(run(name, args), code('AGENT_DISABLED'))
  assert.equal((await store.getNote(note.id)).text, 'Human content')
  assert.equal((await store.readState()).agentEnabled, false)
  assert.ok(!tools.some(tool => /settings|enabled|permission/u.test(tool.name)))
  await store.setAgentEnabled(true)
  assert.equal((await run('jot_read', { id: note.id })).text, 'Human content')
  await store.setAgentEnabled(false)
  await assert.rejects(run('jot_read', { id: note.id }), code('AGENT_DISABLED'))
})

test('agent append preserves rich formatting and stale revisions cannot replace human edits', async t => {
  const { store, run } = await fixture(t)
  await store.setAgentEnabled(true)
  const original = await store.createNote({ title: 'Accepted', content: { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Accepted constraints', marks: [{ type: 'bold' }] }] },
  ] } })
  const updated = await run('jot_update', { id: original.id, revision: original.revision, appendText: 'New agreement' })
  const persisted = await store.getNote(original.id)
  assert.deepEqual(persisted.content.content[0], original.content.content[0])
  assert.equal(persisted.text, 'Accepted constraints\nNew agreement')
  assert.equal(updated.content, undefined)
  assert.equal(updated.text, undefined)
  await store.updateNote(original.id, updated.revision, { title: 'Human decision' })
  await assert.rejects(run('jot_update', { id: original.id, revision: updated.revision, text: 'Lost constraints' }), code('REVISION_CONFLICT'))
  assert.equal((await store.getNote(original.id)).title, 'Human decision')
  assert.equal((await store.getNote(original.id)).text, 'Accepted constraints\nNew agreement')
})

test('agent creates, searches, reads and trashes notes using required CAS revisions', async t => {
  const { store, tools, run } = await fixture(t)
  await store.setAgentEnabled(true)
  const created = await run('jot_create', { title: 'Standup', text: 'Follow up tomorrow' })
  assert.equal((await run('jot_list', { query: 'tomorrow' })).notes[0].id, created.id)
  const read = await run('jot_read', { id: created.id })
  await assert.rejects(run('jot_delete', { id: created.id }), /missing required property "revision"/u)
  const deleted = await run('jot_delete', { id: created.id, revision: read.revision })
  assert.ok(deleted.deletedAt)
  assert.equal(deleted.text, undefined)
  assert.deepEqual(await run('jot_list', {}), { notes: [], total: 0, nextOffset: null })
  await assert.rejects(run('jot_read', { id: created.id }), code('NOT_FOUND'))
  for (const name of ['jot_update', 'jot_delete']) {
    const tool = tools.find(item => item.name === name)!
    const required = tool.parameters.required
    assert.ok(Array.isArray(required))
    assert.ok(required.includes('revision'))
  }
})

test('agent listing uses bounded summary pages and does not repeat full rich document bodies', async t => {
  const { store, run } = await fixture(t)
  await store.setAgentEnabled(true)
  for (let index = 0; index < 53; index++) {
    await store.createNote({ title: `Plan ${index}`, content: docFromText(`Unique ${index} ` + 'x'.repeat(300)) })
  }
  const first = await run('jot_list', {})
  assert.equal(first.total, 53)
  assert.equal(first.notes.length, 20)
  assert.equal(first.nextOffset, 20)
  for (const note of first.notes) {
    assert.equal(note.content, undefined)
    assert.equal(note.text, undefined)
    assert.ok(note.excerpt.length <= 160)
    assert.equal(typeof note.revision, 'number')
  }
  const remaining = await run('jot_list', { offset: first.nextOffset, limit: 50 })
  assert.equal(remaining.notes.length, 33)
  assert.equal(remaining.nextOffset, null)
  assert.equal(new Set([...first.notes, ...remaining.notes].map(note => note.id)).size, 53)
  const maximum = await run('jot_list', { limit: 50 })
  assert.equal(maximum.notes.length, 50)
  const read = await run('jot_read', { id: first.notes[0].id })
  assert.equal(typeof read.text, 'string')
  assert.ok(read.text.length > 160)
  assert.equal(read.content, undefined)
  await assert.rejects(run('jot_list', { limit: 51 }), code('INVALID_INPUT'))
  await assert.rejects(run('jot_list', { offset: -1 }), code('INVALID_INPUT'))
})
