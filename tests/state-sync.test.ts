import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { createJotHandler } from '../src/http.js'
import { ACTIVITY_FILENAME, JotStore, LOCK_FILENAME, STATE_FILENAME } from '../src/store.js'
import { docFromText } from '../src/model.js'
import { applyStateDelta, createJotApi } from '../src/client/api.js'
import type { JotState, Note } from '../src/client/types.js'

async function directory(t: TestContext) {
  const path = await mkdtemp(join(tmpdir(), 'dsh-jot-sync-'))
  t.after(async () => { await rm(path, { recursive: true, force: true }) })
  return path
}
/** Make files look older than the coarse-timestamp window, as they are a few seconds after a save. */
async function settle(path: string) {
  const past = new Date(Date.now() - 10_000)
  for (const name of [STATE_FILENAME, ACTIVITY_FILENAME]) await utimes(join(path, name), past, past).catch(() => {})
}

test('an unchanged library answers a poll from file identity alone, without the lock or a read', async t => {
  const path = await directory(t)
  const store = new JotStore({ directory: path, lockTimeoutMs: 50 })
  await store.createNote({ title: 'One', content: docFromText('body') })
  await settle(path)
  const { tag } = await store.readSnapshot()
  // Another process holds the lock for a long write; an unchanged poll does not wait for it.
  await writeFile(join(path, LOCK_FILENAME), JSON.stringify({ pid: 1, createdAt: new Date().toISOString() }))
  assert.deepEqual(await store.readSnapshot(tag), { tag })
  await rm(join(path, LOCK_FILENAME))
  // A save replaces the file, so the next poll reads it again and reports the change.
  const other = new JotStore({ directory: path })
  await other.createNote({ title: 'Two' })
  const changed = await store.readSnapshot(tag)
  assert.notEqual(changed.tag, tag)
  assert.equal(changed.snapshot!.notes.length, 2)
})

test('a client holding a recent version receives only the notes that changed', async t => {
  const store = new JotStore({ directory: await directory(t) })
  const kept = await store.createNote({ title: 'Kept', content: docFromText('unchanged') })
  const edited = await store.createNote({ title: 'Edited' })
  const removed = await store.createNote({ title: 'Removed' })
  const first = await store.readSnapshot()
  const saved = await store.updateNote(edited.id, edited.revision, { title: 'Edited again' })
  await store.deleteNote(removed.id, removed.revision)
  const second = await store.readSnapshot()
  await store.purgeNotes([{ id: removed.id, revision: removed.revision + 1 }])
  const added = await store.createNote({ title: 'Added' })
  const delta = await store.readSnapshot(second.tag, { delta: true })
  assert.equal(delta.snapshot, undefined)
  assert.deepEqual(delta.delta!.notes.map(note => note.id), [added.id])
  assert.deepEqual(delta.delta!.removed, [removed.id])
  const older = await store.readSnapshot(first.tag, { delta: true })
  assert.deepEqual(older.delta!.notes.map(note => note.id).sort(), [saved.id, added.id].sort())
  assert.ok(!older.delta!.notes.some(note => note.id === kept.id), 'an unchanged note is not sent again')
  // An unknown version, such as one from before a restart, gets the whole library.
  assert.equal((await store.readSnapshot('"unknown"', { delta: true })).snapshot!.notes.length, 3)
  assert.equal((await store.readSnapshot(second.tag)).snapshot!.notes.length, 3, 'clients that do not ask get full snapshots')
})

test('HTTP sends changes only to clients that ask, and the client applies them in order', async t => {
  const store = new JotStore({ directory: await directory(t) })
  const server = createServer(createJotHandler(store, { authorize: () => undefined }))
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => resolve()) }) })
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}/jot/api`
  const kept = await store.createNote({ title: 'Kept' })
  await store.createNote({ title: 'Other' })
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const bodies: string[] = []
  globalThis.fetch = async (input, init) => {
    const response = await original(String(input).replace('/synthetic', base), init)
    bodies.push(await response.clone().text())
    return response
  }
  const api = createJotApi('/synthetic')
  const before = await api.getState()
  const changed = await store.updateNote(kept.id, kept.revision, { title: 'Kept, renamed', pinned: true })
  const after = await api.getState()
  assert.match(bodies.at(-1)!, /^\{"delta":/u)
  assert.ok(!bodies.at(-1)!.includes('"Other"'), 'the unchanged note is not sent again')
  assert.deepEqual(after.notes.map(note => note.title), ['Kept, renamed', 'Other'], 'a pinned note sorts first, as the Host orders it')
  assert.equal(after.notes[1], before.notes.find(note => note.title === 'Other'), 'unchanged notes keep their identity')
  assert.equal(after.notes[0]!.revision, changed.revision)
  assert.equal(await api.getState(), after, 'an unchanged library is the same object')
})

test('applying changes replaces, adds and removes notes without touching the rest', () => {
  const note = (id: string, updatedAt: string, pinned = false): Note => ({ id, title: id, content: { type: 'doc', content: [{ type: 'paragraph' }] },
    text: '', folderId: null, pinned, revision: 1, createdAt: updatedAt, updatedAt, deletedAt: null })
  const previous: JotState = { version: 1, folders: [], agentEnabled: false, notes: [note('b', '2026-10-02T00:00:00.000Z'), note('a', '2026-10-01T00:00:00.000Z'), note('gone', '2026-09-01T00:00:00.000Z')] }
  const next = applyStateDelta(previous, { base: '"x"', notes: [note('c', '2026-10-03T00:00:00.000Z'), { ...note('a', '2026-10-01T00:00:00.000Z', true), revision: 2 }],
    removed: ['gone'], folders: [{ id: 'f', name: 'Folder' }], agentEnabled: true, agentEdits: {} })
  assert.deepEqual(next.notes.map(item => item.id), ['a', 'c', 'b'])
  assert.equal(next.notes[2], previous.notes[0])
  assert.equal(next.agentEnabled, true)
  assert.deepEqual(next.folders, [{ id: 'f', name: 'Folder' }])
})
