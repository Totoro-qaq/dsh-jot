import type { CommandContribution, CommandUiContract, PopupSelectSpec, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import { JotIcon } from './JotIcon.js'
import { formatNoteDate, noteDisplay, taskProgress } from './note-list.js'
import type { JotState } from './types.js'

type SlashSession = Parameters<PopupSelectSpec['onSelect']>[1]
/** What the "/jot" picker asks the notebook to do beside the conversation. */
export type JotSlashChoice = { action: 'open' } | { action: 'new' } | { action: 'open-note'; noteId: string }
type Library = Pick<JotState, 'notes' | 'folders'>

/** The picker lists pinned notes and this many recent ones; typing filters what it lists. */
export const SLASH_RECENT_LIMIT = 200

/** Check dialogs only: the slash menu itself is an allowed action surface. */
export function hasJotSlashModal(document: Pick<Document, 'querySelectorAll'> | undefined): boolean {
  return document !== undefined && [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
    .some(dialog => !dialog.closest('[hidden],[inert],[aria-hidden="true"]') && dialog.getClientRects().length > 0)
}

/**
 * Open and New come first, with Open preselected so "/jot" Enter Enter keeps
 * its old meaning; then pinned and recent notes, newest first.
 */
export function jotSlashOptions(library: Library | null, chinese: boolean, now = new Date()): SelectOption[] {
  const copy = (zh: string, en: string) => chinese ? zh : en
  const actions = { name: 'actions', label: copy('随记', 'Jot') }
  const options: SelectOption[] = [
    { id: 'open', label: copy('打开随记', 'Open Jot'), detail: copy('在对话旁继续上次的笔记', 'Continue beside this conversation'), group: actions, active: true },
    { id: 'new', label: copy('新建笔记', 'New note'), detail: copy('在对话旁写一篇新笔记', 'Start a note beside this conversation'), group: actions },
  ]
  if (!library) return options
  const folders = new Map(library.folders.map(folder => [folder.id, folder.name]))
  const notes = library.notes.filter(note => note.deletedAt === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const row = (note: Library['notes'][number], group: SelectOption['group']): SelectOption => {
    const progress = taskProgress(note.content)
    const detail = [note.folderId ? folders.get(note.folderId) : undefined, formatNoteDate(note.updatedAt, chinese ? 'zh' : 'en', now),
      progress.total ? `${progress.done}/${progress.total}` : undefined].filter(Boolean).join(' · ')
    return { id: `note:${note.id}`, label: noteDisplay(note).title || copy('无标题', 'Untitled'), detail, group }
  }
  const pinned = { name: 'pinned', label: copy('置顶', 'Pinned') }
  const recent = { name: 'recent', label: copy('最近', 'Recent') }
  return [...options, ...notes.filter(note => note.pinned).map(note => row(note, pinned)),
    ...notes.filter(note => !note.pinned).slice(0, SLASH_RECENT_LIMIT).map(note => row(note, recent))]
}

function choiceFor(id: string): JotSlashChoice | null {
  if (id === 'open' || id === 'new') return { action: id }
  return id.startsWith('note:') && id.length > 5 ? { action: 'open-note', noteId: id.slice(5) } : null
}

/** One client command; the official command owner consumes its token, never this plugin. */
export function registerJotSlashCommand(commandUi: Pick<CommandUiContract, 'register'> | undefined, options: {
  chinese(): boolean
  isCurrentSession(sessionId: string): boolean
  blocked(): boolean
  /** The notes to list; without it, or if it fails, the picker still offers Open and New. */
  loadLibrary?(signal: AbortSignal): Promise<Library>
  open(session: SlashSession, choice: JotSlashChoice): void
}): () => void {
  if (!commandUi) return () => {}
  let active = true
  const available = (session: SlashSession) => active && options.isCurrentSession(session.sessionId) && !options.blocked()
  const contribution: CommandContribution = {
    name: 'jot',
    label: () => options.chinese() ? '打开随记' : 'Open Jot',
    description: () => options.chinese() ? '打开、新建或找到一篇笔记' : 'Open, start or find a note',
    icon: JotIcon,
    available,
    ui: {
      kind: 'popupSelect',
      searchLabels: () => options.chinese()
        ? { placeholder: '搜索笔记', empty: '还没有笔记', noResults: '没有找到笔记' }
        : { placeholder: 'Search notes', empty: 'No notes yet', noResults: 'No matching notes' },
      async options(_session, signal) {
        let library: Library | null = null
        // The notebook reports its own load errors; the picker stays useful without the list.
        try { library = await options.loadLibrary?.(signal) ?? null } catch { library = null }
        return jotSlashOptions(library, options.chinese())
      },
      onSelect(option, session) {
        const choice = choiceFor(option.id)
        // Throwing keeps "/jot" in the composer: a picker can outlive its conversation or yield to a dialog.
        if (!choice || !available(session)) {
          throw new Error(options.chinese() ? '对话已经变化，请重新输入 /jot。' : 'The conversation changed. Type /jot again.')
        }
        options.open(session, choice)
      },
    },
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
