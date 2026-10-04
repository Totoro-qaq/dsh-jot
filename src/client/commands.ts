import type { Shortcuts, ShortcutCommand, ShortcutContext } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/protocol'

export const JOT_COMMANDS = [
  { id: 'dsh-jot.open', action: 'open' as const, zh: '随记：打开随记', en: 'Jot: Open Jot' },
  { id: 'dsh-jot.new-note', action: 'new' as const, zh: '随记：新建笔记', en: 'Jot: New note' },
  { id: 'dsh-jot.capture', action: 'capture' as const, zh: '随记：摘录选中的文字', en: 'Jot: Capture selected text' },
] as const

/** Input selections are separate from the document selection in browsers. */
export function readCommandSelection(target: ShortcutContext['target']): string {
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
    const input = target as HTMLInputElement | HTMLTextAreaElement
    // Password and unsupported input types do not expose selectable text.
    if (input.tagName === 'INPUT' && input.type === 'password') return ''
    return typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number'
      ? input.value.slice(input.selectionStart, input.selectionEnd) : ''
  }
  return target?.ownerDocument?.getSelection()?.toString() ?? globalThis.getSelection?.()?.toString() ?? ''
}

/** All rows belong to one activation; defaults stay unbound on every platform. */
export function registerJotCommands(
  shortcuts: Pick<Shortcuts, 'register'> | undefined,
  options: { chinese(): boolean; run(action: typeof JOT_COMMANDS[number]['action'], text?: string): void },
): () => void {
  if (!shortcuts?.register) return () => {}
  const registered: (() => void)[] = []
  let active = true
  const dispose = () => {
    if (!active) return
    active = false
    for (const off of registered.reverse()) off()
  }
  try {
    for (const definition of JOT_COMMANDS) {
      const command: ShortcutCommand = {
        id: definition.id as ShortcutCommandId,
        label: () => options.chinese() ? definition.zh : definition.en,
        aliases: ['jot', '随记', 'notes', '笔记'], defaults: {}, regions: ['page', 'editable', 'terminal'], modals: [],
        resolve(context) {
          if (!active) return { status: 'pass' }
          // Native desktop keys precede modal controls even with modals: [].
          if (context.modal !== null) return { status: 'blocked', reason: 'modal' }
          // A foreign frame's selection is not the selection in this document.
          if (definition.action === 'capture' && (context.source === 'iframe' || context.source === 'webview')) return { status: 'pass' }
          const text = definition.action === 'capture' ? readCommandSelection(context.target) : undefined
          return { status: 'handled', run() { if (active) options.run(definition.action, text) } }
        },
      }
      registered.push(shortcuts.register(command))
    }
  } catch (error) {
    dispose()
    throw error
  }
  return dispose
}

/** A host keyboard command addressed to one Jot panel. */
export interface JotCommandRequest {
  action: 'new' | 'capture'
  target: 'wide' | 'compact'
  revision: number
  /** Text selected when the command ran, captured before any navigation. */
  text?: string
}

/** Busy operations defer the request; modal ownership explicitly discards it. */
export function consumeJotCommand(request: JotCommandRequest | undefined, state: {
  ready: boolean; busy: boolean; blocked: boolean; lastHandled: number
}, callbacks: {
  acknowledge?: (revision: number) => void; run: (request: JotCommandRequest) => void
}): number {
  if (!request || !state.ready || request.revision <= state.lastHandled) return state.lastHandled
  if (state.busy && !state.blocked) return state.lastHandled
  callbacks.acknowledge?.(request.revision)
  if (!state.blocked) callbacks.run(request)
  return request.revision
}

/**
 * One controller per plugin activation. A request survives until the target
 * panel mounts and acknowledges it, so opening a panel and acting are one step.
 */
export function createCommandBus() {
  let revision = 0
  let pending: JotCommandRequest | undefined
  const listeners = new Set<() => void>()
  const publish = () => { for (const listener of listeners) listener() }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => pending,
    /** Requests for the other panel are invisible to this one. */
    snapshotFor: (target: JotCommandRequest['target']) => pending?.target === target ? pending : undefined,
    send(request: Omit<JotCommandRequest, 'revision'>) { pending = { ...request, revision: ++revision }; publish() },
    acknowledge(answered: number) { if (pending?.revision === answered) { pending = undefined; publish() } },
  }
}
