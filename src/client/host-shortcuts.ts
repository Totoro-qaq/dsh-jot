import type { Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ShortcutBinding, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/protocol'

export const EDITOR_BOLD_SHORTCUT_ID = 'dsh-jot.editor.bold' as ShortcutCommandId
export const EDITOR_UNDO_SHORTCUT_ID = 'dsh-jot.editor.undo' as ShortcutCommandId
export const EDITOR_REDO_SHORTCUT_ID = 'dsh-jot.editor.redo' as ShortcutCommandId

/** Public host operations needed to release a native key to the focused editor. */
export type HostShortcutService = Pick<Shortcuts, 'runtime' | 'platform' | 'registerFixed' | 'register' | 'describeBinding'>

/** Supplied by Jot's editor facade, without exposing its view or history internals. */
export interface HostEditorHistoryOwner {
  handleShortcut(action: 'undo' | 'redo', target?: EventTarget | null): boolean
}
const historyOwner = (owner: object): owner is HostEditorHistoryOwner =>
  typeof (owner as Partial<HostEditorHistoryOwner>).handleShortcut === 'function'

export interface HostEditorShortcuts {
  /** Acquire while an editable Jot editor has focus; release on blur or unmount. */
  enter(owner: object): () => void
  /** Release all reservations when the plugin activation ends. */
  dispose(): void
}

const boldBinding: ShortcutBinding = { code: 'KeyB', modifiers: ['primary'] }
const undoBinding: ShortcutBinding = { code: 'KeyZ', modifiers: ['primary'] }
const redoBinding: ShortcutBinding = { code: 'KeyZ', modifiers: ['primary', 'shift'] }
const noop = () => {}

/**
 * Desktop on macOS/Windows routes application shortcuts before DOM handlers.
 * A fixed, focus-owned reservation makes a conflicting host Mod+B command
 * inactive, allowing the editor's ordinary key handler to receive the key.
 * It never edits the user's bindings. Web/Linux already dispatch after local
 * handlers, so they need no reservation. Native catalog synchronization uses
 * the host's asynchronous IPC; the public API provides no synchronization ack.
 * macOS's Electron Edit menu can consume history keys before the DOM. Normal
 * public commands own Cmd+Z / Cmd+Shift+Z only while the editor is focused,
 * suppressing menu accelerators and routing to the editor's own history.
 *
 * Create one controller per plugin activation and share it between editors.
 * The caller owns focus and editability; this helper installs no DOM listeners.
 */
export function createHostEditorShortcuts(
  shortcuts: HostShortcutService | undefined,
  options: { label?: () => string; undoLabel?: () => string; redoLabel?: () => string } = {},
): HostEditorShortcuts {
  const nativePriority = shortcuts?.runtime === 'desktop'
    && (shortcuts.platform === 'macos' || shortcuts.platform === 'windows')
  const owners = new Map<object, symbol>()
  let unregister: (() => void) | undefined
  let unregisterHistory: (() => void)[] = []
  let disposed = false

  const releaseHistory = () => {
    const previous = unregisterHistory
    unregisterHistory = []
    for (const off of previous.reverse()) off()
  }
  const releaseReservation = () => {
    const off = unregister
    unregister = undefined
    try { releaseHistory() } finally { off?.() }
  }

  return {
    enter(owner) {
      if (disposed || !nativePriority || !shortcuts) return noop
      const createdBold = !unregister
      if (!unregister) {
        // Keep the service receiver: the public implementation uses class methods.
        unregister = shortcuts.registerFixed({
          id: EDITOR_BOLD_SHORTCUT_ID,
          label: options.label ?? (() => 'Jot: bold in editor'),
          keys: shortcuts.describeBinding(boldBinding).keys,
          bindings: [boldBinding],
          group: 'input',
        })
      }
      if (shortcuts.platform === 'macos' && historyOwner(owner) && !unregisterHistory.length) {
        const registered: (() => void)[] = []
        try {
          for (const command of [
            { id: EDITOR_UNDO_SHORTCUT_ID, action: 'undo' as const, binding: undoBinding,
              label: options.undoLabel ?? (() => 'Jot: undo in the note editor') },
            { id: EDITOR_REDO_SHORTCUT_ID, action: 'redo' as const, binding: redoBinding,
              label: options.redoLabel ?? (() => 'Jot: redo in the note editor') },
          ]) registered.push(shortcuts.register({
              id: command.id, label: command.label,
              aliases: [], defaults: { 'desktop:macos': command.binding }, regions: ['editable'], modals: [],
              resolve(context) {
                if (context.modal !== null || context.region !== 'editable' || context.target === null
                  || context.source === 'iframe' || context.source === 'webview') return { status: 'pass' }
                const focused = [...owners.entries()].reverse().find(([owner]) => historyOwner(owner))
                if (!focused) return { status: 'pass' }
                const [editor, lease] = focused as [HostEditorHistoryOwner, symbol]
                return { status: 'handled', run() {
                  if (owners.get(editor) === lease) editor.handleShortcut(command.action, context.target)
                } }
              },
            }))
          unregisterHistory = registered
        } catch (error) {
          // A competing default or failed registration must not leave a new
          // focus lifetime or its bold reservation stranded.
          for (const off of registered.reverse()) off()
          if (createdBold && owners.size === 0) releaseReservation()
          throw error
        }
      }
      // A refocus may precede an older effect's cleanup for the same editor.
      const lease = Symbol('editor focus')
      owners.set(owner, lease)
      return () => {
        if (owners.get(owner) !== lease) return
        owners.delete(owner)
        if (owners.size === 0) releaseReservation()
        else if (unregisterHistory.length && ![...owners.keys()].some(historyOwner)) releaseHistory()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      owners.clear()
      releaseReservation()
    },
  }
}
