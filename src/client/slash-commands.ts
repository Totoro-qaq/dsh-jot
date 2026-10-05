import type { ActionSpec, CommandContribution, CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import { JotIcon } from './JotIcon.js'

type SlashSession = Parameters<ActionSpec['run']>[0]

/** Check dialogs only: the slash menu itself is an allowed action surface. */
export function hasJotSlashModal(document: Pick<Document, 'querySelectorAll'> | undefined): boolean {
  return document !== undefined && [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
    .some(dialog => !dialog.closest('[hidden],[inert],[aria-hidden="true"]') && dialog.getClientRects().length > 0)
}

/** One client action; the official command owner consumes its token, never this plugin. */
export function registerJotSlashCommand(commandUi: Pick<CommandUiContract, 'register'> | undefined, options: {
  chinese(): boolean
  isCurrentSession(sessionId: string): boolean
  blocked(): boolean
  open(session: SlashSession): void
}): () => void {
  if (!commandUi) return () => {}
  let active = true
  const available = (session: SlashSession) => active && options.isCurrentSession(session.sessionId) && !options.blocked()
  const contribution: CommandContribution = {
    name: 'jot',
    label: () => options.chinese() ? '打开随记' : 'Open Jot',
    description: () => options.chinese() ? '查看和编辑笔记' : 'View and edit your notes',
    icon: JotIcon,
    available,
    ui: { kind: 'action', run(session) {
      // A menu can outlive its opening session or yield to a newer dialog.
      if (available(session)) options.open(session)
    } },
  }
  let off: () => void
  try { off = commandUi.register(contribution) }
  catch {
    // The official registry rejects duplicate contributions. Never replace one
    // or let this optional entry disable the existing notebook and hotkeys.
    active = false
    return () => {}
  }
  return () => {
    if (!active) return
    active = false
    off()
  }
}
