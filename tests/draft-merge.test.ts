import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Editor } from '@tiptap/core'
import { history, undoDepth } from '@tiptap/pm/history'
import { TextSelection } from '@tiptap/pm/state'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendedBlocks, draftBase, draftFromNote, mergeRemoteChange, type NoteDraft } from '../src/client/drafts.js'
import { createJotExtensions } from '../src/client/editor-extensions.js'
import { syncEditorContent } from '../src/client/editor-content.js'
import { appendBlocks, validateRichDoc, type RichNode } from '../src/model.js'
import { docFromMarkdown } from '../src/markdown.js'
import type { Note, RichDoc } from '../src/client/types.js'
import { JotStore } from '../src/store.js'

const at = '2026-10-07T00:00:00.000Z'
const note = (content: RichDoc, revision = 1, extra: Partial<Note> = {}): Note => ({
  id: 'n', title: '周会', content, text: '', folderId: null, pinned: false, revision, createdAt: at, updatedAt: at, deletedAt: null, ...extra,
})
const doc = (markdown: string) => docFromMarkdown(markdown) as RichDoc
/** What the Host stores after an agent appends: the same rule the server uses. */
const appended = (base: RichDoc, markdown: string): RichDoc =>
  validateRichDoc({ type: 'doc', content: appendBlocks(base.content as never, docFromMarkdown(markdown).content) }) as RichDoc
const typing = (draft: NoteDraft, content: RichDoc): NoteDraft => ({ ...draft, content, dirty: true })

test('an append is recognised, including items that joined a list ending the note', () => {
  const base = doc('Agenda\n- [ ] 准备材料')
  assert.deepEqual(appendedBlocks(base, appended(base, 'Thanks')), docFromMarkdown('Thanks').content)
  const joined = appendedBlocks(base, appended(base, '- [ ] 预约会议室'))!
  assert.equal(joined.length, 1)
  assert.equal(joined[0]!.type, 'taskList')
  assert.equal(joined[0]!.content!.length, 1)
  assert.deepEqual(appendedBlocks(doc(''), doc('First words')), doc('First words').content, 'a blank note is replaced')
  assert.equal(appendedBlocks(base, doc('Agenda changed\n- [ ] 准备材料')), null, 'an edit before the end is not an append')
  assert.equal(appendedBlocks(base, doc('Agenda')), null, 'a removal is not an append')
})

test('unsaved writing absorbs an append and one-sided title or folder changes; anything else stays a conflict', () => {
  const base = note(doc('Agenda\n- [ ] 准备材料'))
  const draft = typing(draftFromNote(base), doc('Agenda, edited\n- [ ] 准备材料'))
  const remote = note(appended(base.content, '- [ ] 预约会议室'), 2)
  const merged = mergeRemoteChange(draft, draftBase(base), remote)!
  assert.ok(merged.appended)
  assert.equal(merged.draft.baseRevision, 2)
  assert.equal(merged.draft.dirty, true)
  const list = merged.draft.content.content![1]!
  assert.deepEqual(list.content!.map(item => item.content![0]!.content![0]!.text), ['准备材料', '预约会议室'])
  assert.equal(merged.draft.content.content![0]!.content![0]!.text, 'Agenda, edited', 'the typing stays')

  // The editor's empty paragraph after a final list stays last; the added items still join the list.
  const withTrailing = typing(draftFromNote(base), { type: 'doc', content: [...base.content.content!, { type: 'paragraph' }] })
  const kept = mergeRemoteChange(withTrailing, draftBase(base), remote)!
  assert.deepEqual(kept.draft.content.content!.map(block => block.type), ['paragraph', 'taskList', 'paragraph'])
  assert.equal(kept.draft.content.content![1]!.content!.length, 2)

  const renamed = mergeRemoteChange(draft, draftBase(base), note(base.content, 2, { title: 'AI 改的标题', folderId: 'f' }))!
  assert.deepEqual([renamed.appended, renamed.draft.title, renamed.draft.folderId], [false, 'AI 改的标题', 'f'])
  const bothRenamed = { ...draft, title: '我改的标题' }
  assert.equal(mergeRemoteChange(bothRenamed, draftBase(base), note(base.content, 2, { title: 'AI 改的标题' })), null)
  assert.equal(mergeRemoteChange(draft, draftBase(base), note(doc('Rewritten'), 2)), null)
  assert.equal(mergeRemoteChange(draft, draftBase(base), note(base.content, 2, { deletedAt: at })), null, 'Trash is a conflict')
  assert.equal(mergeRemoteChange(draft, undefined, remote), null, 'without the starting version nothing is guessed')
  assert.equal(mergeRemoteChange({ ...draft, baseRevision: 3 }, draftBase(base), remote), null)
  const blank = note(doc(''))
  const firstWords = typing(draftFromNote(blank), doc('First words'))
  const renamedBlank = mergeRemoteChange(firstWords, draftBase(blank), note(blank.content, 2, { title: 'New title' }))!
  assert.equal(renamedBlank.appended, false)
  assert.deepEqual(renamedBlank.draft.content, firstWords.content)
})

test('a draft already saved in another panel is not appended a second time, including later typing', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jot-shared-draft-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const store = new JotStore({ directory })
  for (const [original, shared, continued] of [
    ['Agenda', 'Agenda\n\nBook the room', 'Agenda\n\nBook the room\n\nSend the invite'],
    ['- [ ] Prepare', '- [ ] Prepare\n- [ ] Book the room', '- [ ] Prepare\n- [ ] Book the room\n- [ ] Send the invite'],
    ['', 'First thought', 'First thought\n\nAnother thought'],
  ]) {
    const base = await store.createNote({ title: 'Shared draft', content: docFromMarkdown(original!) })
    const remote = await store.updateNote(base.id, base.revision, { content: docFromMarkdown(shared!) })
    for (const value of [shared!, continued!]) {
      // Tiptap adds an empty paragraph after lists; server JSON also canonicalizes defaults.
      const content: RichDoc = { type: 'doc', content: [...doc(value).content!, { type: 'paragraph', attrs: {} }] }
      const draft = typing(draftFromNote(base), content)
      const merged = mergeRemoteChange(draft, draftBase(base), remote)!
      assert.ok(merged)
      assert.deepEqual(merged.draft.content, content, 'retain the local writing exactly once')
      assert.equal(merged.draft.baseRevision, remote.revision)
      assert.equal(merged.appended, false)
    }
  }
})

test('overlapping or divergent additions stay a conflict instead of duplicating or discarding writing', () => {
  for (const [original, local, other] of [
    ['Agenda', 'Agenda\n\nBook the room, for Friday', 'Agenda\n\nBook the room'],
    ['Agenda', 'Agenda edited\n\nBook the room', 'Agenda\n\nBook the room'],
    ['Agenda', 'Agenda\n\nShared\n\nLocal', 'Agenda\n\nShared\n\nRemote'],
    ['- [ ] Prepare', '- [x] Prepare\n- [ ] Book the room', '- [ ] Prepare\n- [ ] Book the room'],
    ['', 'First thought, continued', 'First thought'],
  ]) {
    const base = note(doc(original!))
    const draft = typing(draftFromNote(base), doc(local!))
    const before = structuredClone(draft)
    assert.equal(mergeRemoteChange(draft, draftBase(base), note(doc(other!), 2)), null)
    assert.deepEqual(draft, before, 'conflicts leave the unsaved draft intact')
  }
})

test('a remote extension of the same appended draft contributes only its extra content', () => {
  for (const [original, local, other] of [
    ['Agenda', 'Agenda\n\nShared', 'Agenda\n\nShared\n\nRemote'],
    ['- [ ] Prepare', '- [ ] Prepare\n- [ ] Shared', '- [ ] Prepare\n- [ ] Shared\n- [ ] Remote'],
  ]) {
    const base = note(doc(original!))
    const draft = { ...typing(draftFromNote(base), { type: 'doc', content: [...doc(local!).content!, { type: 'paragraph' }] }), title: 'Same title' }
    const remote = note(doc(other!), 2, { title: 'Same title' })
    const merged = mergeRemoteChange(draft, draftBase(base), remote)!
    assert.ok(merged)
    assert.equal(merged.appended, true)
    assert.deepEqual(merged.draft.content, { type: 'doc', content: [...remote.content.content!, { type: 'paragraph' }] })
    assert.equal(merged.draft.title, 'Same title')
  }
})

test('merged text arrives in the editor without moving the caret or joining the undo history', t => {
  const editor = new Editor({ element: null, extensions: createJotExtensions(), content: doc('First line\nSecond line') as never })
  editor.registerPlugin(history())
  t.after(() => editor.destroy())
  // Typing "X" after "Fi" (headless editors have no DOM to parse inserted HTML).
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 3)))
  editor.view.dispatch(editor.state.tr.insertText('X'))
  const depth = undoDepth(editor.state)
  const caret = editor.state.selection.from
  const local = validateRichDoc(editor.getJSON()) as RichDoc
  let updates = 0
  editor.on('update', () => { updates++ })
  const merged = { type: 'doc' as const, content: [...local.content!, ...docFromMarkdown('From AI').content as RichNode[]] }
  assert.equal(syncEditorContent(editor, merged), true)
  assert.equal(editor.state.selection.from, caret)
  assert.equal(undoDepth(editor.state), depth, 'Undo takes back the typing, not the merged text')
  assert.equal(updates, 0)
  assert.deepEqual(validateRichDoc(editor.getJSON()), validateRichDoc(merged))
  editor.commands.undo()
  assert.equal(editor.state.doc.textContent, 'First lineSecond lineFrom AI', 'only the typed X was undone')
  assert.ok(editor.state.selection instanceof TextSelection)
})
