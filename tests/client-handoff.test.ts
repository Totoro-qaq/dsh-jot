import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNoteHandoff, NoteOpenConsumer, readHandoffDraft } from '../src/client/note-handoff.js'
import { DraftStorage, draftFromNote, type DraftStorageBackend } from '../src/client/drafts.js'
import type { Note } from '../src/client/types.js'

const note: Note = {
  id: 'product-note', title: '笔记切换验收示例', content: { type: 'doc', content: [{ type: 'paragraph' }] }, text: '',
  folderId: null, pinned: false, revision: 1, createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z', deletedAt: null,
}

class MemoryStorage implements DraftStorageBackend {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

test('expanding publishes the selected note before the native full page first mounts', () => {
  const opened: string[] = []
  const controller = createNoteHandoff(() => { opened.push(controller.getSnapshot().noteId!) })
  controller.open(note.id)
  assert.deepEqual(opened, [note.id])
  const request = controller.getSnapshot()
  assert.equal(controller.getSnapshot(), request, 'useSyncExternalStore requires a stable snapshot')
  const wide = new NoteOpenConsumer()
  assert.equal(wide.consume(request, null), undefined)
  assert.equal(wide.consume(request, []), undefined)
  assert.equal(wide.consume(request, [note]), note)
  assert.equal(wide.consume(request, [{ ...note, revision: 2 }]), undefined, 'A server poll must not reset the live editor')
})

test('the same note can be expanded again while each navigation request is consumed once', () => {
  const controller = createNoteHandoff()
  let notifications = 0
  const unsubscribe = controller.subscribe(() => { notifications++ })
  const wide = new NoteOpenConsumer()
  controller.open(note.id)
  const first = controller.getSnapshot()
  assert.equal(wide.consume(first, [note]), note)
  controller.open(note.id)
  const second = controller.getSnapshot()
  assert.equal(second.revision, first.revision + 1)
  assert.equal(wide.consume(second, [note]), note)
  assert.equal(wide.consume(second, [note]), undefined)
  assert.equal(notifications, 2)
  unsubscribe()
  controller.open(note.id)
  assert.equal(notifications, 2)
})

test('a compact draft transfers even when Wide has another newer dirty recovery branch', () => {
  const storage = new DraftStorage(new MemoryStorage())
  const compact = storage.persist(storage.edit(draftFromNote(note), { title: 'Compact unsaved branch' }))
  const wide = storage.persist(storage.edit(draftFromNote(note), { title: 'Wide independent branch' }))
  const controller = createNoteHandoff()
  controller.open(note.id, compact.draftId)
  const consumer = new NoteOpenConsumer(storage)
  const selected = consumer.consume(controller.getSnapshot(), [note])!
  const recovered = readHandoffDraft(selected, controller.getSnapshot().draftId, storage)
  assert.equal(recovered.title, 'Compact unsaved branch')
  assert.equal(recovered.dirty, true)
  assert.equal(recovered.baseRevision, note.revision)
  assert.equal(recovered.draftId, compact.draftId)
  assert.ok(storage.all(note.id).some(item => item.draftId === wide.draftId), 'Opening Compact must retain Wide\'s independent work')
})

test('draft edits made while Wide loads are recovered from the same latest source branch', () => {
  const storage = new DraftStorage(new MemoryStorage())
  const compact = storage.persist(storage.edit(draftFromNote(note), { title: 'First draft' }))
  const controller = createNoteHandoff()
  controller.open(note.id, compact.draftId)
  const newer = storage.persist(storage.edit(compact, { title: 'Typed before Wide finished loading' }))
  const recovered = readHandoffDraft(note, controller.getSnapshot().draftId, storage)
  assert.equal(recovered.title, newer.title)
  assert.equal(recovered.editVersion, newer.editVersion)
})

test('a Compact save acknowledged during handoff does not open an unrelated Wide recovery branch', () => {
  const storage = new DraftStorage(new MemoryStorage())
  const compact = storage.persist(storage.edit(draftFromNote(note), { title: 'Compact saved content' }))
  const wide = storage.persist(storage.edit(draftFromNote(note), { title: 'Unrelated Wide draft' }))
  const saved = { ...note, title: compact.title, revision: 2 }
  storage.saved(compact, compact, saved)
  const recovered = readHandoffDraft(saved, compact.draftId, storage)
  assert.equal(recovered.title, 'Compact saved content')
  assert.equal(recovered.dirty, false)
  assert.ok(storage.all(note.id).some(item => item.draftId === wide.draftId))
})

test('expanding a list clears a pending note request instead of reopening a stale document', () => {
  const controller = createNoteHandoff()
  const consumer = new NoteOpenConsumer()
  controller.open(note.id)
  const pending = controller.getSnapshot()
  assert.equal(consumer.consume(pending, null), undefined)
  controller.open()
  assert.equal(controller.getSnapshot().noteId, null)
  assert.equal(controller.getSnapshot().draftId, undefined)
  assert.equal(consumer.consume(controller.getSnapshot(), [note]), undefined)
  assert.equal(consumer.consume(pending, [note]), undefined)
})

test('a Wide snapshot older than the Compact save waits before reconciling its dirty source branch', () => {
  const storage = new DraftStorage(new MemoryStorage())
  const saved = { ...note, revision: 3 }
  const compact = storage.persist(storage.edit(draftFromNote(saved), { title: 'Typed after Compact save' }))
  const controller = createNoteHandoff()
  controller.open(note.id, compact.draftId, saved.revision)
  const request = controller.getSnapshot()
  const consumer = new NoteOpenConsumer(storage)
  assert.equal(consumer.consume(request, [{ ...note, revision: 2 }]), undefined)
  assert.equal(consumer.isPending(request), true)
  assert.equal(consumer.consume(request, [saved]), saved)
  assert.equal(consumer.isPending(request), false)
  assert.equal(readHandoffDraft(saved, compact.draftId, storage).baseRevision, saved.revision)
})

test('a clean source also waits for its saved revision even without a recovery branch', () => {
  const controller = createNoteHandoff()
  controller.open(note.id, undefined, 3)
  const consumer = new NoteOpenConsumer(new DraftStorage(new MemoryStorage()))
  const request = controller.getSnapshot()
  assert.equal(consumer.consume(request, [{ ...note, revision: 2 }]), undefined)
  assert.equal(consumer.consume(request, [{ ...note, revision: 3 }])?.revision, 3)
  controller.open()
  assert.equal(controller.getSnapshot().noteRevision, undefined)
})

test('acknowledged navigation never replays when Wide remounts or clears a newer request', () => {
  const controller = createNoteHandoff()
  controller.open(note.id)
  const first = controller.getSnapshot()
  assert.equal(new NoteOpenConsumer().consume(first, [note]), note)
  controller.acknowledge(first.revision)
  assert.equal(new NoteOpenConsumer().consume(controller.getSnapshot(), [note]), undefined)
  controller.open(note.id)
  const second = controller.getSnapshot()
  controller.acknowledge(first.revision)
  assert.equal(controller.getSnapshot(), second)
  assert.equal(new NoteOpenConsumer().consume(second, [note]), note)
  controller.acknowledge(second.revision)
  assert.equal(controller.getSnapshot().noteId, null)
})

test('a save acknowledged after publishing requires a fresh note before consuming an older cache', () => {
  const storage = new DraftStorage(new MemoryStorage())
  const compact = storage.persist(storage.edit(draftFromNote(note), { title: 'Saved during navigation' }))
  const controller = createNoteHandoff()
  controller.open(note.id, compact.draftId, note.revision)
  const request = controller.getSnapshot()
  const saved = { ...note, title: compact.title, revision: 2 }
  storage.saved(compact, compact, saved)
  const consumer = new NoteOpenConsumer(storage)
  assert.equal(consumer.consume(request, [note]), undefined)
  assert.equal(consumer.isPending(request), true)
  assert.equal(consumer.consume(request, [saved], { fresh: true }), saved)
  assert.equal(readHandoffDraft(saved, request.draftId, storage).title, compact.title)
})
