import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** Keep the Host's branded Session identity through its public Sidebar face. */
export type HostAttachmentSessionId = NonNullable<ReturnType<ISidebarRight['mounted']['getSnapshot']>>

export interface HostAttachmentPreviewOptions {
  signal?: AbortSignal
  /** A full-page note may explicitly return to the Conversation to reveal its preview. */
  revealConversation?: boolean
  /** Record that this request is about to reveal the Conversation itself. */
  onReveal?: () => void
}

export interface HostAttachmentPreviewDependencies {
  preparePreview: (attachmentId: string, options: { signal?: AbortSignal }) => Promise<{ path: string }>
  getSessionId: () => HostAttachmentSessionId | undefined
  getPanelId: () => MainPanelId | null
  selectConversation: () => void
  mounted: Pick<ISidebarRight['mounted'], 'getSnapshot' | 'subscribe'>
  openResourceIn: (sessionId: HostAttachmentSessionId, address: string) => void
  canPreview: (address: string) => boolean
  waitTimeoutMs?: number
}

/**
 * Hand a managed attachment to the public Host viewer, retaining its originating
 * Session across preparation and layout changes. Missing capabilities fall back
 * to Jot's own viewer; failures preparing the attachment remain visible to its caller.
 */
export function createHostAttachmentPreview(deps: HostAttachmentPreviewDependencies) {
  const timeoutMs = deps.waitTimeoutMs ?? 2_000

  const waitForConversation = (sessionId: HostAttachmentSessionId, signal?: AbortSignal, onReveal?: () => void): Promise<boolean> =>
    new Promise((resolve, reject) => {
      let settled = false
      let unsubscribe = () => {}
      let timer: ReturnType<typeof setTimeout> | undefined
      const cleanup = () => {
        unsubscribe()
        if (timer !== undefined) clearTimeout(timer)
        signal?.removeEventListener('abort', aborted)
      }
      const finish = (ready: boolean) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(ready)
      }
      const aborted = () => { finish(false) }
      const check = () => {
        if (signal?.aborted || deps.getSessionId() !== sessionId) finish(false)
        else if (deps.getPanelId() === null && deps.mounted.getSnapshot() === sessionId) finish(true)
      }
      try {
        signal?.addEventListener('abort', aborted, { once: true })
        unsubscribe = deps.mounted.subscribe(check)
        // A source may publish synchronously during subscribe.
        if (settled) { unsubscribe(); return }
        timer = setTimeout(() => { finish(false) }, timeoutMs)
        check()
        if (!settled) {
          onReveal?.()
          deps.selectConversation()
          check()
        }
      } catch (error) {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      }
    })

  return {
    async open(attachmentId: string, options: HostAttachmentPreviewOptions = {}): Promise<boolean> {
      const { signal, revealConversation = false } = options
      const sessionId = deps.getSessionId()
      const panelId = deps.getPanelId()
      if (sessionId === undefined || signal?.aborted
        || panelId !== null && !revealConversation) return false

      let prepared: { path: string }
      try { prepared = await deps.preparePreview(attachmentId, { signal }) }
      catch (error) { if (signal?.aborted) return false; throw error }
      if (signal?.aborted || deps.getSessionId() !== sessionId || deps.getPanelId() !== panelId) return false
      const address = sessionFileAddress(sessionId, prepared.path)
      if (!deps.canPreview(address)) return false

      if (deps.getPanelId() !== null) {
        if (!revealConversation || !await waitForConversation(sessionId, signal, options.onReveal)) return false
      }
      // Preparation and a pending layout can outlive the initiating Session.
      if (signal?.aborted || deps.getSessionId() !== sessionId) return false
      deps.openResourceIn(sessionId, address)
      return true
    },
  }
}
