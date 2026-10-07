import type { Editor } from '@tiptap/core'
import type { RichDoc } from './types.js'

/**
 * Saved canonical JSON can differ in property order while representing the
 * same document. A different document replaces only the range that changed,
 * outside the undo history, so the caret and earlier undo steps survive text
 * merged in from elsewhere, and Undo never takes back someone else's change.
 */
export function syncEditorContent(editor: Editor, value: RichDoc): boolean {
  const incoming = editor.schema.nodeFromJSON(value)
  const current = editor.state.doc
  if (current.eq(incoming)) return false
  const start = current.content.findDiffStart(incoming.content)
  const end = current.content.findDiffEnd(incoming.content)
  if (start !== null && end) {
    let { a: endA, b: endB } = end
    const overlap = start - Math.min(endA, endB)
    if (overlap > 0) { endA += overlap; endB += overlap }
    try {
      const transaction = editor.state.tr.replace(start, endA, incoming.slice(start, endB))
        .setMeta('addToHistory', false).setMeta('preventUpdate', true)
      if (transaction.doc.eq(incoming)) {
        editor.view.dispatch(transaction)
        return true
      }
    } catch { /* replace the whole document below */ }
  }
  // emitUpdate prevents a controlled-value loop. Equal documents must be skipped
  // above: setContent still records a full replacement in history otherwise.
  editor.commands.setContent(value, { emitUpdate: false })
  return true
}
