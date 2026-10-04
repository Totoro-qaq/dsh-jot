import type { AttachmentCapabilities, AttachmentInfo, Folder, JotApi, JotState, Note, NoteInput, NotePatch, NoteQuery } from './types.js'

export class JotApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'JotApiError'
  }
}

export function createJotApi(base = '/jot/api'): JotApi {
  const request = async <T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(`${base}${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = await response.json() as { data?: T; error?: { code?: string; message?: string } }
    if (!response.ok || payload.error) {
      throw new JotApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? `HTTP ${response.status}`)
    }
    return payload.data as T
  }
  const notePath = (id: string) => `/notes/${encodeURIComponent(id)}`
  return {
    getState: () => request<JotState>('/state'),
    listNotes(query: NoteQuery = {}) {
      const params = new URLSearchParams()
      if (query.q) params.set('q', query.q)
      if (query.folderId !== undefined) params.set('folderId', query.folderId ?? '')
      if (query.trash) params.set('trash', '1')
      const suffix = params.toString()
      return request<Note[]>(`/notes${suffix ? `?${suffix}` : ''}`)
    },
    getNote: id => request<Note>(notePath(id)),
    createNote: (input: NoteInput = {}) => request<Note>('/notes', 'POST', input),
    updateNote: (id: string, patch: NotePatch) => request<Note>(notePath(id), 'PATCH', patch),
    deleteNote: (id, revision) => request<Note>(notePath(id), 'DELETE', { revision }),
    restoreNote: (id, revision) => request<Note>(`${notePath(id)}/restore`, 'POST', { revision }),
    createFolder: name => request<Folder>('/folders', 'POST', { name }),
    updateFolder: (id, name) => request<Folder>(`/folders/${encodeURIComponent(id)}`, 'PATCH', { name }),
    deleteFolder: id => request<void>(`/folders/${encodeURIComponent(id)}`, 'DELETE'),
    setAgentEnabled: agentEnabled => request<{ agentEnabled: boolean }>('/settings', 'PATCH', { agentEnabled }),
    getAttachment: id => request<AttachmentInfo>(`/attachments/${encodeURIComponent(id)}`),
    getAttachmentCapabilities: () => request<AttachmentCapabilities>('/attachment-capabilities'),
    prepareAttachmentPreview: (id, options) => request<{ path: string }>(`/attachments/${encodeURIComponent(id)}/preview`, 'POST', {}, options?.signal),
    openAttachment: (id, options) => request<void>(`/attachments/${encodeURIComponent(id)}/open`, 'POST', {}, options?.signal),
    async uploadAttachment(file) {
      const response = await fetch(`${base}/attachments`, {
        method: 'POST', credentials: 'same-origin', body: file,
        headers: { 'content-type': 'application/octet-stream', 'x-jot-filename': encodeURIComponent(file.name || 'image.png'), 'x-jot-mime-type': file.type || 'application/octet-stream' },
      })
      const payload = await response.json()
      if (!response.ok || payload.error) throw new JotApiError(response.status, payload.error?.code ?? 'UPLOAD_FAILED', payload.error?.message ?? 'Upload failed.')
      return payload.data as AttachmentInfo
    },
    async exportNote(input, format) {
      const response = await fetch(`${base}/export`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, format }),
      })
      if (!response.ok) {
        const payload = await response.json()
        throw new JotApiError(response.status, payload.error?.code ?? 'EXPORT_FAILED', payload.error?.message ?? 'Export failed.')
      }
      const disposition = response.headers.get('content-disposition') ?? ''
      let filename = `note.${format}`
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
      if (encoded) try { filename = decodeURIComponent(encoded).replace(/[\\/\u0000-\u001f]/g, '_') } catch { /* retain safe fallback */ }
      return { blob: await response.blob(), filename }
    },
  }
}

export const defaultJotApi = createJotApi()
