import { useMemo, useRef, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { UseSidebarRightTabInfo } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { JotApp } from './App.js'
import { JotIcon } from './JotIcon.js'
import { createNoteHandoff } from './note-handoff.js'
import { createHostEditorShortcuts } from './host-shortcuts.js'
import { createHostAttachmentPreview } from './host-attachments.js'
import { defaultJotApi } from './api.js'
import { createAttachmentDialogHandoff } from './attachment-dialog.js'
import { createCommandBus, registerJotCommands, type JotCommandRequest, type JotCompactRecipient } from './commands.js'
import { hasJotSlashModal, registerJotSlashCommand } from './slash-commands.js'

export const name = 'dsh-jot-client'
export const inject = ['slots', 'locale', 'layout', 'sidebarRightTabs', 'sidebarRight', 'uiSession', 'shortcuts']
export const PANEL_ID = 'dsh-jot' as MainPanelId
export const TAB_KIND = 'dsh-jot'
export const TAB_ID = 'dsh-jot/memo'

export function apply(ctx: Context): void {
  const lifetime = new AbortController()
  const attachmentDialogs = createAttachmentDialogHandoff(() => ctx.layout.selectPanel(PANEL_ID))
  ctx.effect(() => () => lifetime.abort(), 'dsh-jot: attachment navigation lifetime')
  const hostPreview = createHostAttachmentPreview({
    preparePreview: (id, options) => defaultJotApi.prepareAttachmentPreview!(id, options),
    getSessionId: () => ctx.uiSession.adapter.current.getSnapshot().key,
    getPanelId: () => ctx.layout.panelInfo.getSnapshot().activePanelId,
    selectConversation: () => ctx.layout.selectPanel(null),
    mounted: ctx.sidebarRight.mounted,
    openResourceIn: (sessionId, address) => ctx.sidebarRight.openResourceIn(sessionId, address),
    canPreview: address => ctx.sidebarRightTabs.candidates(address).length > 0,
  })
  const previewIn = (revealConversation: boolean) => async (id: string, options: { signal?: AbortSignal } = {}): Promise<boolean | undefined> => {
    const sessionId = ctx.uiSession.adapter.current.getSnapshot().key
    const panelId = ctx.layout.panelInfo.getSnapshot().activePanelId
    const signal = AbortSignal.any([lifetime.signal, ...options.signal ? [options.signal] : []])
    let revealed = false
    const opened = await hostPreview.open(id, { revealConversation, signal, onReveal: () => { revealed = true } })
    if (!opened && revealed && !signal.aborted && sessionId === ctx.uiSession.adapter.current.getSnapshot().key
      && panelId === PANEL_ID && ctx.layout.panelInfo.getSnapshot().activePanelId === null) {
      // A failed reveal must not lose its fallback when WideMemo unmounted.
      attachmentDialogs.open(id)
      return undefined
    }
    if (!opened && (signal.aborted || sessionId !== ctx.uiSession.adapter.current.getSnapshot().key
      || panelId !== ctx.layout.panelInfo.getSnapshot().activePanelId)) return undefined
    return opened
  }
  const widePreview = previewIn(true)
  const compactPreview = previewIn(false)
  const handoff = createNoteHandoff(() => ctx.layout.selectPanel(PANEL_ID))
  const hostEditorShortcuts = createHostEditorShortcuts(ctx.shortcuts, {
    label: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记：编辑正文时使用粗体' : 'Jot: bold in the note editor',
    undoLabel: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记：撤销正文编辑' : 'Jot: undo in the note editor',
    redoLabel: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记：重做正文编辑' : 'Jot: redo in the note editor',
  })
  ctx.effect(() => () => hostEditorShortcuts.dispose(), 'dsh-jot: focused editor shortcuts')
  const commands = createCommandBus()
  ctx.effect(() => () => commands.dispose(), 'dsh-jot: command lifetime')
  const wideCommand = () => commands.snapshotFor('wide')
  const chinese = () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh')
  /** Beside a visible Conversation commands use the sidebar tab; otherwise the full page. */
  const route = (action: JotCommandRequest['action'] | 'open', text?: string) => {
    const sessionId = ctx.sidebarRight?.mounted?.getSnapshot()
    const besideConversation = sessionId !== undefined
      && ctx.layout.panelInfo.getSnapshot().activePanelId !== PANEL_ID
    let target: JotCommandRequest['target'] = 'wide'
    let recipient: JotCompactRecipient | undefined
    if (besideConversation) {
      try {
        ctx.sidebarRight.openTab(TAB_KIND)
        const tab = ctx.sidebarRight.active()
        if (!tab || tab.kind !== TAB_KIND) throw new Error('Jot tab was not opened')
        recipient = { sessionId, tabId: tab.id, signal: ctx.sidebarRight.tabDomain.occurrence(sessionId, tab).signal }
        target = 'compact'
      }
      catch { ctx.layout.selectPanel(PANEL_ID) }
    } else ctx.layout.selectPanel(PANEL_ID)
    if (action !== 'open') commands.send({ action, target, ...recipient ? { recipient } : {}, ...text ? { text } : {} })
  }
  // Listed in DSH keyboard settings without default keys, so they never take a
  // binding from DSH, the system or another plugin; users choose their own.
  ctx.effect(() => {
    try { return registerJotCommands(ctx.shortcuts, { chinese, run: route }) }
    catch { return () => {} /* A Host without these registrations keeps the on-screen buttons. */ }
  }, 'dsh-jot: keyboard commands')
  // This child waits for the official slash surface; the notebook remains
  // usable in custom hosts that omit that service entirely.
  ctx.inject(['commandUi'], scope => {
    scope.effect(() => registerJotSlashCommand(scope.commandUi, {
      chinese,
      isCurrentSession: sessionId => ctx.uiSession.adapter.current.getSnapshot().key === sessionId
        && ctx.sidebarRight.mounted.getSnapshot() === sessionId && ctx.layout.panelInfo.getSnapshot().activePanelId === null,
      blocked: () => hasJotSlashModal(typeof document === 'undefined' ? undefined : document),
      loadLibrary: () => defaultJotApi.getState(),
      open: (session, choice) => {
        ctx.sidebarRight.openTabIn(session.sessionId, TAB_KIND)
        if (choice.action === 'open') return
        // New and a chosen note go to the tab that just opened, through the same claim as keyboard commands.
        const tab = ctx.sidebarRight.active()
        if (!tab || tab.kind !== TAB_KIND || ctx.sidebarRight.mounted.getSnapshot() !== session.sessionId) return
        const recipient = { sessionId: session.sessionId, tabId: tab.id, signal: ctx.sidebarRight.tabDomain.occurrence(session.sessionId, tab).signal }
        commands.send(choice.action === 'new' ? { action: 'new', target: 'compact', recipient }
          : { action: 'open-note', target: 'compact', recipient, noteId: choice.noteId })
      },
    }), 'dsh-jot: slash action')
  })
  // LocaleRuntime exposes prototype methods; retaining their owning object is required.
  const subscribeLocale = (listener: () => void) => ctx.locale.subscribe(listener)
  const readLocale = () => ctx.locale.getSnapshot()
  function useLanguage(): 'zh' | 'en' {
    const snapshot = useSyncExternalStore(subscribeLocale, readLocale, readLocale)
    return snapshot.active.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  function WideMemo() {
    const request = useSyncExternalStore(handoff.subscribe, handoff.getSnapshot, handoff.getSnapshot)
    const attachmentRequest = useSyncExternalStore(attachmentDialogs.subscribe, attachmentDialogs.getSnapshot, attachmentDialogs.getSnapshot)
    const panel = useSyncExternalStore(listener => ctx.layout.panelInfo.subscribe(listener),
      () => ctx.layout.panelInfo.getSnapshot().activePanelId, () => ctx.layout.panelInfo.getSnapshot().activePanelId)
    const readCommand = () => panel === PANEL_ID ? wideCommand() : undefined
    const command = useSyncExternalStore(commands.subscribe, readCommand, readCommand)
    const claim = (revision: number) => ctx.layout.panelInfo.getSnapshot().activePanelId === PANEL_ID && commands.claim(revision, 'wide')
    return <JotApp mode="wide" locale={useLanguage()} chromeInset openNoteRequest={request} onNoteRequestHandled={handoff.acknowledge} onEditorFocus={hostEditorShortcuts.enter} onAttachmentPreview={widePreview}
      attachmentDialogRequest={attachmentRequest} onAttachmentDialogHandled={attachmentDialogs.acknowledge}
      commandRequest={command} onCommandClaim={claim} />
  }
  function CompactMemo({ sessionId, useTabInfo }: { sessionId: string; useTabInfo: UseSidebarRightTabInfo }) {
    const info = useTabInfo()
    const visibleSession = useSyncExternalStore(listener => ctx.sidebarRight.mounted.subscribe(listener),
      () => ctx.sidebarRight.mounted.getSnapshot(), () => ctx.sidebarRight.mounted.getSnapshot())
    const currentInfo = useRef(info)
    currentInfo.current = info
    const recipient = useMemo(() => ({ sessionId, tabId: info.tab.id, signal: info.tab.signal }), [sessionId, info.tab.id, info.tab.signal])
    const current = () => currentInfo.current.tab.visible && !recipient.signal.aborted
      && ctx.sidebarRight.mounted.getSnapshot() === recipient.sessionId && ctx.sidebarRight.active()?.id === recipient.tabId
    const readCommand = () => visibleSession === recipient.sessionId && current() ? commands.snapshotFor('compact', recipient) : undefined
    const command = useSyncExternalStore(commands.subscribe, readCommand, readCommand)
    const claim = (revision: number) => current() && commands.claim(revision, 'compact', recipient)
    return <JotApp mode="compact" locale={useLanguage()} onExpand={handoff.open} onEditorFocus={hostEditorShortcuts.enter} onAttachmentPreview={compactPreview}
      commandRequest={command} onCommandClaim={claim} />
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, WideMemo))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记' : 'Jot' }, JotIcon))
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID, kind: TAB_KIND, title: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记' : 'Jot',
    keepMounted: true,
    guide: [{ id: 'jot', order: 30, icon: JotIcon, title: () => ctx.locale.getSnapshot().active.toLowerCase().startsWith('zh') ? '随记' : 'Jot' }],
  }), 'dsh-jot: compact tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, CompactMemo))
}

export default { name, inject, apply }
