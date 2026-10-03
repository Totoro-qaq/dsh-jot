export interface RichNode {
  type: string
  attrs?: Record<string, unknown>
  content?: RichNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

export interface RichDoc extends RichNode {
  type: 'doc'
}

export interface Note {
  id: string
  title: string
  content: RichDoc
  text: string
  folderId: string | null
  pinned: boolean
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Folder { id: string; name: string }
export interface JotState { version: 1; notes: Note[]; folders: Folder[]; agentEnabled: boolean }
export interface NoteInput { title?: string; content?: RichDoc; folderId?: string | null }
export interface NotePatch extends NoteInput { revision: number; pinned?: boolean }
export interface NoteQuery { q?: string; folderId?: string | null; trash?: boolean }
export interface AttachmentInfo {
  id: string; name: string; mimeType: string; size: number; createdAt: string
  kind: 'image' | 'pdf' | 'file'; url: string; downloadUrl: string
}
export type ExportFormat = 'txt' | 'md' | 'pdf' | 'docx'
export interface NoteDownload { blob: Blob; filename: string }

export interface JotApi {
  getState(): Promise<JotState>
  listNotes(query?: NoteQuery): Promise<Note[]>
  getNote(id: string): Promise<Note>
  createNote(input?: NoteInput): Promise<Note>
  updateNote(id: string, patch: NotePatch): Promise<Note>
  deleteNote(id: string, revision: number): Promise<Note>
  restoreNote(id: string, revision: number): Promise<Note>
  createFolder(name: string): Promise<Folder>
  updateFolder(id: string, name: string): Promise<Folder>
  deleteFolder(id: string): Promise<void>
  setAgentEnabled(agentEnabled: boolean): Promise<{ agentEnabled: boolean }>
  uploadAttachment(file: File): Promise<AttachmentInfo>
  getAttachment(id: string): Promise<AttachmentInfo>
  exportNote(input: { title: string; content: RichDoc }, format: ExportFormat): Promise<NoteDownload>
}

export type JotLocale = 'zh' | 'en'
