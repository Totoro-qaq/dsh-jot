import { strToU8, zipSync, type Zippable } from 'fflate'

/** Mirrors the Host: one import is a ZIP of at most 200 MiB, and no stored file exceeds 20 MiB. */
export const MAX_IMPORT_BYTES = 200 * 1_048_576
const MAX_FILE_BYTES = 20 * 1_048_576
const NOTE_FILE = /\.(?:md|markdown|txt)$/iu
const ARCHIVE = /\.zip$/iu
const IMPORT_DATES = '.jot-import.json'

export type ImportPackProblem = 'mixed-archive' | 'too-large' | 'empty'
export class ImportPackError extends Error {
  constructor(readonly problem: ImportPackProblem) {
    super(problem)
    this.name = 'ImportPackError'
  }
}

/** A picked file: its path inside the picked folder, and its bytes on demand. */
export interface ImportFile { path: string; size: number; lastModified: number; read(): Promise<Uint8Array>; blob?: Blob }
export const importFile = (file: File): ImportFile => ({
  path: (file.webkitRelativePath || file.name).replace(/\\/gu, '/'), size: file.size, lastModified: file.lastModified,
  read: async () => new Uint8Array(await file.arrayBuffer()), blob: file,
})

export function normalizePath(path: string): string | null {
  const parts: string[] = []
  for (const part of path.replace(/\\/gu, '/').split('/')) {
    if (!part || part === '.') continue
    if (part !== '..') parts.push(part)
    else if (!parts.pop()) return null
  }
  return parts.length ? parts.join('/') : null
}
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Files a Markdown note embeds or links: relative to the note, to the picked folder, or by name alone. */
export function noteReferences(path: string, text: string): { paths: Set<string>; names: Set<string> } {
  const paths = new Set<string>()
  const names = new Set<string>()
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
  const root = path.includes('/') ? path.slice(0, path.indexOf('/') + 1) : ''
  const add = (raw: string) => {
    let target = raw.trim().replace(/^<|>$/gu, '')
    if (!target || /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith('#')) return
    target = target.replace(/[?#].*$/u, '')
    try { target = decodeURIComponent(target) } catch { /* keep the raw text */ }
    const relative = target.replace(/^\/+/u, '')
    for (const candidate of [folder + target, root + relative, relative]) {
      const normalized = normalizePath(candidate)
      if (normalized) paths.add(normalized)
    }
    if (!target.includes('/')) names.add(target.toLowerCase())
  }
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]*>|[^)\s]+)/gu)) add(match[1]!)
  for (const match of text.matchAll(/!?\[\[([^\]|#\n]+)/gu)) add(match[1]!)
  return { paths, names }
}

/**
 * The single ZIP an import uploads: a picked ZIP unchanged, or the picked
 * Markdown and text files with only the images and files they use, plus each
 * file's date so imported notes keep their order.
 */
export async function packImport(files: readonly ImportFile[]): Promise<Blob> {
  // Folder picks have relative paths. ZIPs inside them are ordinary attachments,
  // including backup files that must be ignored along with their hidden folder.
  const visible = files.filter(file => !file.path.split('/').some(part => part.startsWith('.') || part === '__MACOSX'))
  const archives = visible.filter(file => !file.path.includes('/') && ARCHIVE.test(file.path))
  if (archives.length) {
    if (visible.length > 1) throw new ImportPackError('mixed-archive')
    const [archive] = archives as [ImportFile]
    if (archive.size > MAX_IMPORT_BYTES) throw new ImportPackError('too-large')
    return archive.blob ?? new Blob([await archive.read() as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
  }
  const notes = visible.filter(file => NOTE_FILE.test(file.path))
  if (!notes.length) throw new ImportPackError('empty')
  const entries: Zippable = {}
  const modified: Record<string, number> = {}
  const wanted = { paths: new Set<string>(), names: new Set<string>() }
  let total = 0
  const add = (file: ImportFile, bytes: Uint8Array, compress: boolean) => {
    total += bytes.byteLength
    if (total > MAX_IMPORT_BYTES) throw new ImportPackError('too-large')
    entries[file.path] = [bytes, { level: compress ? 6 : 0 }]
    modified[file.path] = file.lastModified
  }
  const decoder = new TextDecoder()
  for (const file of notes) {
    const bytes = await file.read()
    add(file, bytes, true)
    if (/\.txt$/iu.test(file.path)) continue
    const references = noteReferences(file.path, decoder.decode(bytes))
    for (const path of references.paths) wanted.paths.add(path)
    for (const name of references.names) wanted.names.add(name)
  }
  for (const file of visible) {
    const path = normalizePath(file.path)
    if (!path || NOTE_FILE.test(path) || file.size > MAX_FILE_BYTES) continue
    if (wanted.paths.has(path) || wanted.names.has(basename(path).toLowerCase())) add(file, await file.read(), false)
  }
  entries[IMPORT_DATES] = strToU8(JSON.stringify({ version: 1, modified }))
  return new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}
