import { compareNotes } from '../model.js'
import type { AgentEdit, AttachmentCapabilities, AttachmentInfo, Folder, ImportSummary, JotApi, JotState, LibraryDownload, Note, NoteDownload, NoteInput, NotePatch, NoteQuery, PurgeResult } from './types.js'

export class JotApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'JotApiError'
  }
}

/** Read a generated file response, keeping the Host's file name when it is safe. */
async function download(response: Response, fallback: string): Promise<NoteDownload> {
  if (!response.ok) {
    const payload = await response.json() as { error?: { code?: string; message?: string } }
    throw new JotApiError(response.status, payload.error?.code ?? 'EXPORT_FAILED', payload.error?.message ?? 'Export failed.')
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  let filename = fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  if (encoded) try { filename = decodeURIComponent(encoded).replace(/[\\/\u0000-\u001f]/g, '_') } catch { /* retain safe fallback */ }
  return { blob: await response.blob(), filename }
}

/** The Host's answer when it still knows the client's version: what changed since `base`. */
export interface StateDelta {
  base: string
  notes: Note[]
  removed: string[]
  folders: Folder[]
  agentEnabled: boolean
  agentEdits: Record<string, AgentEdit>
}
/** Unchanged notes keep their identity, so the list re-renders only what changed. */
export function applyStateDelta(previous: JotState, delta: StateDelta): JotState {
  const replaced = new Set([...delta.removed, ...delta.notes.map(note => note.id)])
  return {
    version: 1, folders: delta.folders, agentEnabled: delta.agentEnabled, agentEdits: delta.agentEdits,
    notes: [...previous.notes.filter(note => !replaced.has(note.id)), ...delta.notes].sort(compareNotes),
  }
}

export function createJotApi(base = '/jot/api'): JotApi {
  let stateGeneration = 0
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
    if (method !== 'GET' && /^\/(?:notes(?:\/|$)|folders(?:\/|$)|settings$|trash(?:\/|$))/u.test(path)) stateGeneration++
    return payload.data as T
  }
  const notePath = (id: string) => `/notes/${encodeURIComponent(id)}`
  // Shared by every mounted panel: an unchanged library returns the identical
  // object, which callers can compare by reference and skip re-rendering.
  let cachedState: { request: number; tag: string | null; state: JotState } | null = null
  let stateRequest = 0
  const getState = async (): Promise<JotState> => {
    const sequence = ++stateRequest
    const generation = stateGeneration
    const previous = cachedState
    // With a known version, a changed library comes back as the changes only.
    const response = await fetch(`${base}/state`, {
      credentials: 'same-origin', cache: 'no-store',
      headers: previous?.tag ? { 'if-none-match': previous.tag, 'x-jot-state-delta': '1' } : undefined,
    })
    if (response.status === 304) {
      if (!previous?.tag) throw new JotApiError(304, 'REQUEST_FAILED', 'The Host returned an unchanged state without a cached snapshot.')
      // A mutation may finish while the old conditional request is in flight.
      if (generation !== stateGeneration) return getState()
      // 304 describes this request's old snapshot. It cannot overwrite a
      // different successful snapshot received while this request waited.
      const accepted = cachedState ?? previous
      cachedState = { ...accepted, request: Math.max(sequence, accepted.request) }
      return cachedState.state
    }
    const payload = await response.json() as { data?: JotState; delta?: StateDelta; error?: { code?: string; message?: string } }
    if (!response.ok || payload.error) {
      throw new JotApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? `HTTP ${response.status}`)
    }
    const tag = response.headers.get('etag')
    if (payload.delta && (!previous || payload.delta.base !== previous.tag)) {
      // Changes for a version this panel does not hold: ask once more for the whole library.
      if (cachedState?.tag === previous?.tag) cachedState = cachedState && { ...cachedState, tag: null }
      return getState()
    }
    const state = payload.delta ? applyStateDelta(previous!.state, payload.delta) : payload.data
    if (!state) throw new JotApiError(response.status, 'REQUEST_FAILED', 'The Host returned no notes snapshot.')
    if (generation !== stateGeneration) return getState()
    // Only a newer successful response supersedes this one. A later request
    // that failed must not prevent an older success from initializing state.
    if (cachedState && sequence < cachedState.request) return cachedState.state
    cachedState = { request: sequence, tag, state }
    return state
  }
  return {
    getState,
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
    purgeNote: (id, revision) => request<PurgeResult>(`${notePath(id)}/purge`, 'POST', { revision }),
    emptyTrash: () => request<PurgeResult>('/trash/empty', 'POST', {}),
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
      return download(response, `note.${format}`)
    },
    async exportLibrary(options): Promise<LibraryDownload> {
      const response = await fetch(`${base}/export-library`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options),
      })
      const file = await download(response, 'Jot.zip')
      return { ...file, notes: Number(response.headers.get('x-jot-export-notes') ?? 0), attachments: Number(response.headers.get('x-jot-export-attachments') ?? 0) }
    },
    revertAgentEdit: (id, revision) => request<Note>(`${notePath(id)}/revert-agent-edit`, 'POST', { revision }),
    async importNotes(archive, options) {
      const response = await fetch(`${base}/import?locale=${options.locale === 'en' ? 'en' : 'zh'}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/zip' }, body: archive,
      })
      const payload = await response.json() as { data?: ImportSummary; error?: { code?: string; message?: string } }
      if (!response.ok || payload.error || !payload.data) {
        throw new JotApiError(response.status, payload.error?.code ?? 'IMPORT_FAILED', payload.error?.message ?? `HTTP ${response.status}`)
      }
      stateGeneration++
      return payload.data
    },
  }
}

export const defaultJotApi = createJotApi()
