import { randomBytes } from 'node:crypto'
import { posix } from 'node:path'
import { unzipSync } from 'fflate'
import { AttachmentError, attachmentMedia, type AttachmentStore } from './attachments.js'
import { LIBRARY_MANIFEST, MAX_LIBRARY_EXPORT_NOTES } from './exports.js'
import { docFromMarkdown, markdownInlineText, type MarkdownAsset } from './markdown.js'
import {
  StoreError, MAX_TITLE_LENGTH, docFromText, documentAttachmentIds, onlyKeys, record, validateRichDoc,
  type RichDoc, type RichNode,
} from './model.js'
import type { ContentVerifier, ImportedNote, JotStore } from './store.js'

/** Imports arrive as one ZIP: a Jot library export, or Markdown and text files the client packed. */
export const MAX_IMPORT_BYTES = 200 * 1_048_576
const MAX_IMPORT_ENTRIES = 5_000
const MAX_EXPANDED_BYTES = 512 * 1_048_576
const MAX_NOTE_FILE_BYTES = 4 * 1_048_576
const MAX_MANIFEST_BYTES = 64 * 1_048_576
const NOTE_FILE = /\.(?:md|markdown|txt)$/iu
/** The modification time of each file the client packed, so imported notes keep their order. */
export const IMPORT_DATES = '.jot-import.json'

export interface ImportSummary {
  /** `jot` restored a Jot library export exactly; `markdown` converted Markdown and text files. */
  source: 'jot' | 'markdown'
  notes: number
  /** Notes identical to one already in Jot. */
  skipped: number
  folders: number
  /** Images and files the new notes use. */
  attachments: number
  /** Images and files the notes refer to that the import did not contain, or that exceed the size limit. */
  missing: number
  /** Note files that were too large or could not be read. */
  unreadable: number
}
export interface ImportOptions {
  store: JotStore
  attachments: AttachmentStore
  verify?: ContentVerifier
  locale?: 'zh' | 'en'
}

function invalid(message: string): never { throw new StoreError('INVALID_INPUT', message) }

// ---------------------------------------------------------------------------
// Archive

function entryPath(raw: string): string | null {
  let name = raw
  // Many ZIP tools write UTF-8 names without flagging them, which then read as Latin-1.
  if (/[\x80-\xff]/u.test(name) && [...name].every(character => character.charCodeAt(0) <= 0xff)) {
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(name, character => character.charCodeAt(0))) }
    catch { /* keep the name as read */ }
  }
  const parts = name.replace(/\\/gu, '/').split('/').filter(part => part && part !== '.')
  if (!parts.length || parts.includes('..')) return null
  const path = parts.join('/')
  if (path === IMPORT_DATES) return path
  // Hidden files and app folders (.obsidian, .git, __MACOSX) are neither notes nor attachments.
  return parts.some(part => part.startsWith('.') || part === '__MACOSX') ? null : path
}

function readArchive(archive: Uint8Array): Map<string, Uint8Array> {
  let count = 0
  let expanded = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(archive, {
      filter: file => {
        if (++count > MAX_IMPORT_ENTRIES) invalid(`The archive holds more than ${MAX_IMPORT_ENTRIES} files`)
        expanded += file.originalSize
        if (expanded > MAX_EXPANDED_BYTES) invalid('The archive expands beyond 512 MiB')
        return !file.name.endsWith('/')
      },
    })
  } catch (cause) {
    if (cause instanceof StoreError) throw cause
    invalid('This file is not a readable ZIP archive')
  }
  const entries = new Map<string, Uint8Array>()
  for (const [name, data] of Object.entries(files)) {
    const path = entryPath(name)
    if (path && !entries.has(path)) entries.set(path, data)
  }
  return entries
}

function decode(label: string, bytes: Uint8Array, fatal: boolean): string | undefined {
  try { return new TextDecoder(label, { fatal }).decode(bytes) } catch { return undefined }
}
/** UTF-8 first; Notepad on Chinese Windows saves GB18030, and some editors UTF-16. */
function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decode('utf-16le', bytes.subarray(2), false) ?? ''
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decode('utf-16be', bytes.subarray(2), false) ?? ''
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes
  return decode('utf-8', body, true) ?? decode('gb18030', body, true) ?? decode('utf-8', body, false) ?? ''
}

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
  txt: 'text/plain', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
const mediaType = (path: string) => MEDIA_TYPES[posix.extname(path).slice(1).toLowerCase()] ?? 'application/octet-stream'

/** A stored file name: the archive name without control or direction characters, at most 200 characters. */
function storedName(value: string): string {
  const cleaned = [...value].filter(character => {
    const code = character.codePointAt(0)!
    return code > 0x1f && code !== 0x7f && !(code >= 0x202a && code <= 0x202e) && !(code >= 0x2066 && code <= 0x2069)
  }).join('').replace(/[/\\]/gu, '_').trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'attachment'
  if (cleaned.length <= 200 && Buffer.byteLength(cleaned, 'utf8') <= 500) return cleaned
  const extension = posix.extname(cleaned).slice(0, 20)
  let stem = [...cleaned.slice(0, cleaned.length - extension.length)].slice(0, 120).join('')
  while (Buffer.byteLength(stem + extension, 'utf8') > 500) stem = [...stem].slice(0, -1).join('')
  return stem + extension
}

/** Each archive file is stored once, or an identical stored file is reused. */
class Uploads {
  readonly created: string[] = []
  missing = 0
  private readonly pending = new Map<string, Promise<string | null>>()
  constructor(private readonly entries: ReadonlyMap<string, Uint8Array>, private readonly attachments: AttachmentStore) {}
  /** The stored id, or null for a file the archive lacks or that exceeds the attachment size limit. */
  id(path: string, name = posix.basename(path), type = mediaType(path)): Promise<string | null> {
    let result = this.pending.get(path)
    if (!result) {
      result = (async () => {
        const bytes = this.entries.get(path)
        if (!bytes) return null
        try {
          const { attachment, created } = await this.attachments.uploadOrReuse({ name: storedName(name), mimeType: type, bytes })
          if (created) this.created.push(attachment.id)
          return attachment.id
        } catch (cause) {
          if (cause instanceof AttachmentError && cause.code === 'ATTACHMENT_TOO_LARGE') return null
          throw cause
        }
      })()
      this.pending.set(path, result)
    }
    return result
  }
}

/** Point image and file blocks at stored files; one that could not be kept stays visible as a line of text. */
function relink(nodes: readonly RichNode[], ids: ReadonlyMap<string, string | null>, locale: 'zh' | 'en'): RichNode[] {
  return nodes.map(node => {
    if (node.type === 'image' || node.type === 'attachment') {
      const target = ids.get(String(node.attrs?.attachmentId))
      if (target) return { ...node, attrs: { ...node.attrs, attachmentId: target } }
      const label = String(node.attrs?.[node.type === 'image' ? 'alt' : 'caption'] ?? '').trim()
      const text = locale === 'en'
        ? `[Missing ${node.type === 'image' ? 'image' : 'file'}${label ? `: ${label}` : ''}]`
        : `［缺少${node.type === 'image' ? '图片' : '附件'}${label ? `：${label}` : ''}］`
      return { type: 'paragraph', content: [{ type: 'text', text }] }
    }
    return node.content ? { ...node, content: relink(node.content, ids, locale) } : node
  })
}

// ---------------------------------------------------------------------------
// A Jot library export

interface Library {
  prefix: string
  folders: Map<string, string>
  files: Map<string, { name: string; mimeType: string; path: string }>
  notes: Array<{ title: string; content: RichDoc; folderId: string | null; pinned: boolean; createdAt?: string; updatedAt?: string }>
}

const optionalString = (value: unknown) => typeof value === 'string' ? value : undefined
function readLibrary(entries: ReadonlyMap<string, Uint8Array>): Library | null {
  const paths = [...entries.keys()].filter(path => path === LIBRARY_MANIFEST
    || (path.endsWith(`/${LIBRARY_MANIFEST}`) && path.split('/').length === 2))
  if (paths.length !== 1) return null
  const bytes = entries.get(paths[0]!)!
  if (bytes.length > MAX_MANIFEST_BYTES) invalid('The library file in this archive is too large')
  let data: Record<string, unknown>
  try { data = record(JSON.parse(decodeText(bytes)), 'library') } catch { return null }
  if (data.format !== 'dsh-jot-library') return null
  if (data.version !== 1) invalid('This archive comes from a newer Jot; update Jot before importing it')
  if (!Array.isArray(data.notes) || !Array.isArray(data.folders) || !Array.isArray(data.attachments)) invalid('The library file in this archive is damaged')
  if (data.notes.length > MAX_LIBRARY_EXPORT_NOTES) invalid(`Import at most ${MAX_LIBRARY_EXPORT_NOTES} notes at once`)
  const folders = new Map<string, string>()
  for (const value of data.folders) {
    const folder = record(value, 'library folder')
    if (typeof folder.id === 'string' && typeof folder.name === 'string') folders.set(folder.id, folder.name)
  }
  const files = new Map<string, { name: string; mimeType: string; path: string }>()
  for (const value of data.attachments) {
    const file = record(value, 'library file')
    if (typeof file.id === 'string' && typeof file.path === 'string') {
      files.set(file.id, { name: optionalString(file.name) ?? posix.basename(file.path), mimeType: optionalString(file.mimeType) ?? mediaType(file.path), path: file.path })
    }
  }
  const notes = data.notes.map(value => {
    const note = record(value, 'library note')
    onlyKeys(note, ['title', 'content', 'folderId', 'pinned', 'createdAt', 'updatedAt', 'path'], 'library note')
    if (typeof note.title !== 'string') invalid('The library file in this archive is damaged')
    return {
      title: note.title.slice(0, MAX_TITLE_LENGTH), content: validateRichDoc(note.content),
      folderId: typeof note.folderId === 'string' ? note.folderId : null, pinned: note.pinned === true,
      createdAt: optionalString(note.createdAt), updatedAt: optionalString(note.updatedAt),
    }
  })
  return { prefix: paths[0]!.slice(0, -LIBRARY_MANIFEST.length), folders, files, notes }
}

async function fromLibrary(library: Library, uploads: Uploads, locale: 'zh' | 'en'): Promise<ImportedNote[]> {
  const ids = new Map<string, string | null>()
  for (const note of library.notes) for (const id of documentAttachmentIds(note.content)) {
    if (ids.has(id)) continue
    const file = library.files.get(id)
    const stored = file ? await uploads.id(library.prefix + file.path, file.name, file.mimeType) : null
    if (!stored) uploads.missing++
    ids.set(id, stored)
  }
  return library.notes.map(note => ({
    title: note.title, content: { type: 'doc', content: relink(note.content.content, ids, locale) },
    folder: note.folderId ? library.folders.get(note.folderId) ?? null : null, pinned: note.pinned,
    ...note.createdAt ? { createdAt: note.createdAt } : {}, ...note.updatedAt ? { updatedAt: note.updatedAt } : {},
  }))
}

// ---------------------------------------------------------------------------
// Markdown and text files

/** Front matter is metadata: its title field, or a leading "# heading", becomes the note title. */
export function splitMarkdownTitle(text: string): { body: string; title?: string } {
  let body = text.replace(/\r\n?/gu, '\n')
  let title: string | undefined
  const front = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/u.exec(body)
  if (front && /^[A-Za-z_][\w-]*:/mu.test(front[1]!)) {
    const field = /^title:[ \t]*(.*?)[ \t]*$/mu.exec(front[1]!)?.[1]
    if (field) title = field.replace(/^(["'])(.*)\1$/u, '$2').trim() || undefined
    body = body.slice(front[0].length)
  }
  const heading = /^\s*#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*(?:\n|$)/u.exec(body)
  if (heading) {
    title = markdownInlineText(heading[1]!) || title
    body = body.slice(heading[0].length)
  }
  return { body, ...title ? { title } : {} }
}

/** The folder the person picked is the import itself; only its subfolders become Jot folders. */
function sharedRoot(paths: readonly string[]): string {
  const first = paths[0]!.split('/')[0]!
  return paths.every(path => path.includes('/') && path.split('/')[0] === first) ? `${first}/` : ''
}

function readDates(entries: ReadonlyMap<string, Uint8Array>): Map<string, string> {
  const dates = new Map<string, string>()
  const bytes = entries.get(IMPORT_DATES)
  if (!bytes || bytes.length > 4 * 1_048_576) return dates
  try {
    const data = record(JSON.parse(decodeText(bytes)), 'import dates')
    const modified = record(data.modified, 'import dates')
    for (const [name, value] of Object.entries(modified)) {
      const path = entryPath(name)
      if (path && typeof value === 'number' && Number.isFinite(value) && value > 0) dates.set(path, new Date(value).toISOString())
    }
  } catch { /* dates are optional */ }
  return dates
}

async function fromMarkdown(entries: ReadonlyMap<string, Uint8Array>, uploads: Uploads, locale: 'zh' | 'en'): Promise<{ notes: ImportedNote[]; unreadable: number }> {
  const paths = [...entries.keys()].filter(path => NOTE_FILE.test(path)).sort((a, b) => a.localeCompare(b))
  if (!paths.length) invalid('There are no Markdown or text files to import')
  if (paths.length > MAX_LIBRARY_EXPORT_NOTES) invalid(`Import at most ${MAX_LIBRARY_EXPORT_NOTES} notes at once`)
  const dates = readDates(entries)
  // Wiki-style links name a file anywhere in the vault; an ambiguous name resolves to nothing.
  const byName = new Map<string, string | null>()
  for (const path of entries.keys()) {
    if (NOTE_FILE.test(path) || path === IMPORT_DATES) continue
    const key = posix.basename(path).toLowerCase()
    byName.set(key, byName.has(key) ? null : path)
  }
  const root = sharedRoot(paths)
  const placeholders = new Map<string, string>()
  // The parser may ask about one reference more than once; each missing file counts once per note.
  const unresolved = new Set<string>()
  const resolve = (notePath: string, target: string, embedded: boolean): MarkdownAsset | undefined => {
    let reference = target.trim()
    if (!reference || /^[a-z][a-z0-9+.-]*:/iu.test(reference) || reference.startsWith('#')) return undefined
    reference = reference.replace(/[?#].*$/u, '')
    try { reference = decodeURIComponent(reference) } catch { /* keep the raw text */ }
    const candidates = [posix.normalize(posix.join(posix.dirname(notePath), reference)), posix.normalize(root + reference.replace(/^\/+/u, '')),
      posix.normalize(reference.replace(/^\/+/u, ''))]
    let path = candidates.find(candidate => !candidate.startsWith('..') && entries.has(candidate) && !NOTE_FILE.test(candidate))
    if (!path && !reference.includes('/')) path = byName.get(reference.toLowerCase()) ?? undefined
    if (!path) {
      if (embedded && !unresolved.has(`${notePath}\n${target}`)) { unresolved.add(`${notePath}\n${target}`); uploads.missing++ }
      return undefined
    }
    let id = placeholders.get(path)
    if (!id) { id = randomBytes(16).toString('hex'); placeholders.set(path, id) }
    return { attachmentId: id, image: embedded && attachmentMedia(entries.get(path)!, mediaType(path)).kind === 'image' }
  }
  const parsed: Array<{ path: string; title: string; content: RichDoc }> = []
  let unreadable = 0
  for (const path of paths) {
    const bytes = entries.get(path)!
    if (bytes.length > MAX_NOTE_FILE_BYTES) { unreadable++; continue }
    const text = decodeText(bytes)
    const name = posix.basename(path).replace(/\.[^.]+$/u, '')
    try {
      if (/\.txt$/iu.test(path)) parsed.push({ path, title: name, content: docFromText(text.replace(/\s+$/u, '')) })
      else {
        const { body, title } = splitMarkdownTitle(text)
        const content = docFromMarkdown(body, {
          wikiLinks: true, localLinksAsText: true, maxLength: MAX_NOTE_FILE_BYTES,
          asset: (target, embedded) => resolve(path, target, embedded),
        })
        parsed.push({ path, title: title ?? name, content })
      }
    } catch { unreadable++ }
  }
  const ids = new Map<string, string | null>()
  for (const [path, placeholder] of placeholders) {
    const stored = await uploads.id(path)
    if (!stored) uploads.missing++
    ids.set(placeholder, stored)
  }
  return {
    unreadable,
    notes: parsed.map(item => {
      const directory = posix.dirname(item.path.slice(root.length))
      const updatedAt = dates.get(item.path)
      return {
        title: item.title.slice(0, MAX_TITLE_LENGTH), content: { type: 'doc', content: relink(item.content.content, ids, locale) },
        folder: directory === '.' ? null : directory.split('/').join(' / '),
        ...updatedAt ? { createdAt: updatedAt, updatedAt } : {},
      }
    }),
  }
}

// ---------------------------------------------------------------------------

/**
 * Import one ZIP. A Jot library export (any format) is restored exactly from
 * its jot-library.json; otherwise every Markdown and text file becomes a note,
 * its subfolders become folders, and the images and files it uses are stored.
 * Files stored for an import that fails are removed again.
 */
export async function importArchive(archive: Uint8Array, options: ImportOptions): Promise<ImportSummary> {
  if (archive.byteLength > MAX_IMPORT_BYTES) invalid('Import at most 200 MiB at once')
  const locale = options.locale === 'en' ? 'en' : 'zh'
  const entries = readArchive(archive)
  const uploads = new Uploads(entries, options.attachments)
  try {
    const library = readLibrary(entries)
    const plan = library ? { source: 'jot' as const, notes: await fromLibrary(library, uploads, locale), unreadable: 0 }
      : { source: 'markdown' as const, ...await fromMarkdown(entries, uploads, locale) }
    if (!plan.notes.length) invalid('There are no Markdown or text files to import')
    const outcome = await options.store.importNotes(plan.notes, 'user', options.verify)
    // A file only a skipped duplicate needed is not kept twice.
    const used = new Set(outcome.created.flatMap(note => [...documentAttachmentIds(note.content)]))
    const unused = uploads.created.filter(id => !used.has(id))
    if (unused.length) await options.attachments.remove(unused).catch(() => {})
    return { source: plan.source, notes: outcome.created.length, skipped: outcome.skipped, folders: outcome.folders,
      attachments: used.size, missing: uploads.missing, unreadable: plan.unreadable }
  } catch (cause) {
    if (uploads.created.length) await options.attachments.remove(uploads.created).catch(() => {})
    throw cause
  }
}
