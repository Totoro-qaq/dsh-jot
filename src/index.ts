import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { JotStore } from './store.js'
import { createJotHandler, JOT_API_PATH } from './http.js'
import { registerJotTools } from './tools.js'
import { AttachmentStore, DEFAULT_ATTACHMENT_MAX_BYTES, DEFAULT_ATTACHMENT_TOTAL_BYTES } from './attachments.js'
import { createAttachmentActions } from './attachment-actions.js'

export const name = 'dsh-jot'
export const inject = ['webServer', 'connection', 'tools']
export const Config = z.object({
  directory: z.string(),
  attachmentMaxBytes: z.number().default(DEFAULT_ATTACHMENT_MAX_BYTES),
  attachmentMaxTotalBytes: z.number().default(DEFAULT_ATTACHMENT_TOTAL_BYTES),
})

export function apply(ctx: Context, config: { directory?: string; attachmentMaxBytes?: number; attachmentMaxTotalBytes?: number } = {}): void {
  const directory = resolve(config.directory ?? resolve(process.env.DSH_HOME || resolve(homedir(), '.dsh'), 'jot'))
  const store = new JotStore({ directory })
  const attachments = new AttachmentStore({ directory, maxFileBytes: config.attachmentMaxBytes, maxTotalBytes: config.attachmentMaxTotalBytes })
  const actions = createAttachmentActions(attachments)
  const handler = createJotHandler(store, { authorize: request => ctx.connection.requestRejection(request), attachments, actions })
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: JOT_API_PATH, handler }), 'dsh-jot: authenticated application routes')
  registerJotTools(ctx.tools, store)
}

export { createJotHandler, JOT_API_PATH } from './http.js'
export { createJotTools, registerJotTools } from './tools.js'
export { AttachmentStore, attachmentUrl } from './attachments.js'
export { createAttachmentActions } from './attachment-actions.js'
export default { name, inject, Config, apply }
