import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { acquireFileLock } from './file-lock.js'
import {
  StoreError, boundedString, docFromText, docToText, onlyKeys, record,
  validateActor, validateId, validateRichDoc,
  MAX_FOLDER_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH,
  type Actor, type CreateNoteInput, type Folder, type JotState,
  type Note, type NoteSummary, type UpdateNotePatch,
} from './model.js'

export { StoreError } from './model.js'
export const STATE_FILENAME = 'jot.json'
export const BACKUP_FILENAME = 'jot.json.bak'
export const LOCK_FILENAME = '.jot.lock'
const MAX_STATE_BYTES = 32 * 1_048_576
const NOTE_KEYS = ['id', 'title', 'content', 'text', 'folderId', 'pinned', 'revision', 'createdAt', 'updatedAt', 'deletedAt']

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
function invalid(message: string): never { throw new StoreError('INVALID_INPUT', message) }
function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') invalid(`${name} must be a boolean`)
  return value
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid('Invalid timestamp')
  return value
}
function timestamp(previous?: string): string {
  return new Date(Math.max(Date.now(), previous === undefined ? 0 : Date.parse(previous) + 1)).toISOString()
}
function compareNotes(a: Note, b: Note): number {
  return Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
}
function summary(note: Note): NoteSummary {
  const { content: _content, text: _text, ...metadata } = note
  return structuredClone(metadata)
}
function emptyState(): JotState { return { version: 1, notes: [], folders: [], agentEnabled: false } }

function validateState(input: unknown): JotState {
  const data = record(input, 'state')
  onlyKeys(data, ['version', 'notes', 'folders', 'agentEnabled'], 'state')
  if (data.version !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.folders)) invalid('Unsupported state format')
  if (data.notes.length > 10_000 || data.folders.length > 1_000) invalid('State contains too many entries')
  const folders: Folder[] = data.folders.map(value => {
    const folder = record(value, 'folder')
    onlyKeys(folder, ['id', 'name', 'createdAt', 'updatedAt'], 'folder')
    const name = boundedString(folder.name, MAX_FOLDER_NAME_LENGTH, 'folder name', false)
    if (name !== name.trim()) invalid('Folder names must be trimmed')
    return { id: validateId(folder.id), name, createdAt: date(folder.createdAt), updatedAt: date(folder.updatedAt) }
  })
  const folderIds = new Set(folders.map(folder => folder.id))
  if (folderIds.size !== folders.length) invalid('Duplicate folder ids')
  const notes: Note[] = data.notes.map(value => {
    const note = record(value, 'note')
    onlyKeys(note, NOTE_KEYS, 'note')
    const content = validateRichDoc(note.content)
    const text = boundedString(note.text, MAX_TEXT_LENGTH, 'derived text')
    if (text !== docToText(content)) invalid('Derived text does not match the document')
    if (!Number.isSafeInteger(note.revision) || (note.revision as number) < 1) invalid('Invalid revision')
    const folderId = note.folderId === null ? null : validateId(note.folderId)
    if (folderId !== null && !folderIds.has(folderId)) invalid('A note references a missing folder')
    const createdAt = date(note.createdAt)
    const updatedAt = date(note.updatedAt)
    const deletedAt = note.deletedAt === null ? null : date(note.deletedAt)
    if (updatedAt < createdAt || (deletedAt !== null && deletedAt > updatedAt)) invalid('Inconsistent note timestamps')
    return {
      id: validateId(note.id), title: boundedString(note.title, MAX_TITLE_LENGTH, 'title'),
      content, text, folderId, pinned: boolean(note.pinned, 'pinned'), revision: note.revision as number,
      createdAt, updatedAt, deletedAt,
    }
  })
  if (new Set(notes.map(note => note.id)).size !== notes.length) invalid('Duplicate note ids')
  return { version: 1, notes, folders, agentEnabled: boolean(data.agentEnabled, 'agentEnabled') }
}

export interface StoreOptions { directory: string; lockTimeoutMs?: number }

/**
 * A lockfile serializes reads and writes across store instances and processes.
 * Every operation reloads the latest state while holding that lock, including permission checks.
 * Locks left by a killed process time out visibly; they are never stolen from an active writer.
 * No mutable state cache is kept, so a failed write cannot advance in-memory state.
 */
export class JotStore {
  readonly directory: string
  readonly statePath: string
  readonly backupPath: string
  readonly lockPath: string
  private readonly lockTimeoutMs: number

  constructor(options: StoreOptions) {
    const input = record(options, 'store options')
    onlyKeys(input, ['directory', 'lockTimeoutMs'], 'store options')
    this.directory = resolve(boundedString(input.directory, 4_096, 'directory', false))
    this.statePath = join(this.directory, STATE_FILENAME)
    this.backupPath = join(this.directory, BACKUP_FILENAME)
    this.lockPath = join(this.directory, LOCK_FILENAME)
    this.lockTimeoutMs = input.lockTimeoutMs === undefined ? 5_000 : input.lockTimeoutMs as number
    if (!Number.isSafeInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 1 || this.lockTimeoutMs > 60_000) invalid('Invalid lock timeout')
  }

  private async lock(): Promise<() => Promise<void>> {
    try { await mkdir(this.directory, { recursive: true, mode: 0o700 }) }
    catch (cause) { throw new StoreError('PERSISTENCE_ERROR', 'Cannot create the notes directory', { cause }) }
    return acquireFileLock({
      path: this.lockPath, timeoutMs: this.lockTimeoutMs,
      initialize: async file => { await file.writeFile(JSON.stringify({ pid: process.pid, createdAt: timestamp() })) },
      persistenceError: cause => new StoreError('PERSISTENCE_ERROR', 'Cannot acquire the notes lock', { cause }),
      timeoutError: () => new StoreError('LOCK_TIMEOUT', 'Notes are locked by another operation; inspect .jot.lock if its process has stopped'),
    })
  }

  private async load(): Promise<{ state: JotState; previous: string | null }> {
    let source: string
    try {
      const info = await stat(this.statePath)
      if (info.size > MAX_STATE_BYTES) throw new StoreError('CORRUPT_STATE', 'The notes state exceeds its size limit')
      source = await readFile(this.statePath, 'utf8')
    } catch (cause) {
      if (isErrno(cause, 'ENOENT')) {
        try { await stat(this.backupPath) }
        catch (backupError) {
          if (isErrno(backupError, 'ENOENT')) return { state: emptyState(), previous: null }
          throw new StoreError('PERSISTENCE_ERROR', 'Cannot inspect the notes backup', { cause: backupError })
        }
        throw new StoreError('CORRUPT_STATE', 'The main notes file is missing but a backup exists; restore it explicitly before continuing')
      }
      if (cause instanceof StoreError) throw cause
      throw new StoreError('PERSISTENCE_ERROR', 'Cannot read the notes state', { cause })
    }
    try { return { state: validateState(JSON.parse(source)), previous: source } }
    catch (cause) {
      throw new StoreError('CORRUPT_STATE', 'The notes state is invalid; the original and its backup were preserved', { cause })
    }
  }

  private async writeSynced(path: string, contents: string): Promise<void> {
    const file = await open(path, 'wx', 0o600)
    try { await file.writeFile(contents, 'utf8'); await file.sync() }
    finally { await file.close() }
  }

  private async persist(state: JotState, previous: string | null): Promise<void> {
    const serialized = JSON.stringify(validateState(state)) + '\n'
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) invalid('Notes storage has reached its size limit')
    const suffix = `${process.pid}-${randomUUID()}`
    const temporary = join(this.directory, `.jot-${suffix}.tmp`)
    const backupTemporary = join(this.directory, `.jot-${suffix}.bak.tmp`)
    try {
      await this.writeSynced(temporary, serialized)
      if (previous !== null) {
        await this.writeSynced(backupTemporary, previous)
        await rename(backupTemporary, this.backupPath)
      }
      await rename(temporary, this.statePath)
    } catch (cause) {
      throw new StoreError('PERSISTENCE_ERROR', 'Could not save notes; the previous state remains active', { cause })
    } finally {
      await Promise.all([rm(temporary, { force: true }), rm(backupTemporary, { force: true })])
    }
  }

  private async access<T>(actor: Actor, mutate: boolean, operation: (state: JotState) => T): Promise<T> {
    validateActor(actor)
    const unlock = await this.lock()
    try {
      const { state, previous } = await this.load()
      if (actor === 'agent' && !state.agentEnabled) throw new StoreError('AGENT_DISABLED', 'Agent access to notes is disabled')
      const result = operation(state)
      if (mutate) await this.persist(state, previous)
      return structuredClone(result)
    } finally { await unlock() }
  }

  private note(state: JotState, id: string, actor: Actor, activeOnly = false): Note {
    validateId(id)
    const note = state.notes.find(item => item.id === id)
    if (!note || (note.deletedAt !== null && (actor === 'agent' || activeOnly))) throw new StoreError('NOT_FOUND', 'Note not found')
    return note
  }
  private checkRevision(note: Note, revision: number): void {
    if (!Number.isSafeInteger(revision) || revision < 1) invalid('An expected revision is required')
    if (note.revision !== revision) throw new StoreError('REVISION_CONFLICT', `Note changed; expected revision ${revision}, current revision ${note.revision}`)
  }
  private folder(state: JotState, id: string): Folder {
    validateId(id)
    const folder = state.folders.find(item => item.id === id)
    if (!folder) throw new StoreError('NOT_FOUND', 'Folder not found')
    return folder
  }
  private folderId(state: JotState, value: unknown): string | null {
    if (value === null) return null
    const id = validateId(value)
    this.folder(state, id)
    return id
  }

  async readState(actor: Actor = 'user'): Promise<JotState> {
    return this.access(actor, false, state => ({ ...state,
      notes: state.notes.filter(note => actor === 'user' || note.deletedAt === null).sort(compareNotes),
    }))
  }
  async getNote(id: string, actor: Actor = 'user'): Promise<Note> {
    return this.access(actor, false, state => this.note(state, id, actor))
  }
  async search(query: string, folderId?: string | null, actor: Actor = 'user'): Promise<Note[]> {
    return this.access(actor, false, state => {
      const needle = boundedString(query, 512, 'query').trim().toLocaleLowerCase()
      if (folderId !== undefined && folderId !== null) validateId(folderId)
      return state.notes.filter(note => note.deletedAt === null && (folderId === undefined || note.folderId === folderId) &&
        (needle === '' || note.title.toLocaleLowerCase().includes(needle) || note.text.toLocaleLowerCase().includes(needle)))
        .sort((a, b) => Number(b.title.toLocaleLowerCase().includes(needle)) - Number(a.title.toLocaleLowerCase().includes(needle)) || compareNotes(a, b))
    })
  }
  async createNote(input: CreateNoteInput, actor: Actor = 'user'): Promise<Note> {
    return this.access(actor, true, state => {
      const data = record(input, 'new note')
      onlyKeys(data, ['title', 'content', 'folderId', 'pinned'], 'new note')
      const content = data.content === undefined ? docFromText('') : validateRichDoc(data.content)
      const now = timestamp()
      const note: Note = { id: randomUUID(), title: data.title === undefined ? '' : boundedString(data.title, MAX_TITLE_LENGTH, 'title'),
        content, text: docToText(content), folderId: data.folderId === undefined ? null : this.folderId(state, data.folderId),
        pinned: data.pinned === undefined ? false : boolean(data.pinned, 'pinned'), revision: 1,
        createdAt: now, updatedAt: now, deletedAt: null }
      state.notes.push(note)
      return note
    })
  }
  async updateNote(id: string, revision: number, patch: UpdateNotePatch, actor: Actor = 'user'): Promise<Note> {
    return this.access(actor, true, state => {
      const note = this.note(state, id, actor, true)
      this.checkRevision(note, revision)
      const data = record(patch, 'note patch')
      onlyKeys(data, ['title', 'content', 'appendText', 'folderId', 'pinned'], 'note patch')
      if (Object.keys(data).length === 0) invalid('Note patch must change at least one field')
      if (data.content !== undefined && data.appendText !== undefined) invalid('Choose document replacement or appendText, not both')
      if (data.title !== undefined) note.title = boundedString(data.title, MAX_TITLE_LENGTH, 'title')
      if (data.content !== undefined) note.content = validateRichDoc(data.content)
      if (data.appendText !== undefined) {
        const text = boundedString(data.appendText, MAX_TEXT_LENGTH, 'appendText', false)
        note.content = validateRichDoc({ type: 'doc', content: [...note.content.content, ...docFromText(text).content] })
      }
      if (data.folderId !== undefined) note.folderId = this.folderId(state, data.folderId)
      if (data.pinned !== undefined) note.pinned = boolean(data.pinned, 'pinned')
      note.text = docToText(note.content)
      note.revision++
      note.updatedAt = timestamp(note.updatedAt)
      return note
    })
  }
  async deleteNote(id: string, revision: number, actor: Actor = 'user'): Promise<NoteSummary> {
    return this.access(actor, true, state => {
      const note = this.note(state, id, actor, true)
      this.checkRevision(note, revision)
      note.updatedAt = timestamp(note.updatedAt)
      note.deletedAt = note.updatedAt
      note.revision++
      return summary(note)
    })
  }
  async restoreNote(id: string, revision: number, actor: Actor = 'user'): Promise<Note> {
    return this.access(actor, true, state => {
      // Agents may restore by id/revision, but never read the deleted body beforehand.
      const note = this.note(state, id, 'user')
      this.checkRevision(note, revision)
      if (note.deletedAt === null) invalid('Note is not deleted')
      note.deletedAt = null
      note.updatedAt = timestamp(note.updatedAt)
      note.revision++
      return note
    })
  }
  async createFolder(name: string, actor: Actor = 'user'): Promise<Folder> {
    return this.access(actor, true, state => {
      const clean = boundedString(name, MAX_FOLDER_NAME_LENGTH, 'folder name', false).trim()
      if (state.folders.some(folder => folder.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) invalid('Folder name already exists')
      const now = timestamp()
      const folder: Folder = { id: randomUUID(), name: clean, createdAt: now, updatedAt: now }
      state.folders.push(folder)
      return folder
    })
  }
  async renameFolder(id: string, name: string, actor: Actor = 'user'): Promise<Folder> {
    return this.access(actor, true, state => {
      const folder = this.folder(state, id)
      const clean = boundedString(name, MAX_FOLDER_NAME_LENGTH, 'folder name', false).trim()
      if (state.folders.some(item => item.id !== id && item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) invalid('Folder name already exists')
      folder.name = clean
      folder.updatedAt = timestamp(folder.updatedAt)
      return folder
    })
  }
  async deleteFolder(id: string, actor: Actor = 'user'): Promise<void> {
    return this.access(actor, true, state => {
      this.folder(state, id)
      state.folders = state.folders.filter(folder => folder.id !== id)
      for (const note of state.notes) if (note.folderId === id) {
        note.folderId = null
        note.updatedAt = timestamp(note.updatedAt)
        note.revision++
      }
    })
  }
  async setAgentEnabled(enabled: boolean, actor: Actor = 'user'): Promise<void> {
    validateActor(actor)
    if (actor !== 'user') throw new StoreError('HUMAN_ONLY', 'Only the user can change agent access')
    return this.access(actor, true, state => { state.agentEnabled = boolean(enabled, 'agentEnabled') })
  }
}
