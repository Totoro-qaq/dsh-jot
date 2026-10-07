/** JSON-only rich documents shared by the editor, persistence, and agent tools. */
export type Actor = 'user' | 'agent'
export type ErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'REVISION_CONFLICT' |
  'AGENT_DISABLED' | 'HUMAN_ONLY' | 'CORRUPT_STATE' | 'PERSISTENCE_ERROR' | 'LOCK_TIMEOUT'

const ERROR_STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400, NOT_FOUND: 404, REVISION_CONFLICT: 409,
  AGENT_DISABLED: 403, HUMAN_ONLY: 403, CORRUPT_STATE: 500,
  PERSISTENCE_ERROR: 500, LOCK_TIMEOUT: 503,
}

export class StoreError extends Error {
  readonly status: number
  constructor(readonly code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StoreError'
    this.status = ERROR_STATUS[code]
  }
}

export type RichNodeType = 'paragraph' | 'heading' | 'text' | 'hardBreak' |
  'bulletList' | 'orderedList' | 'listItem' | 'taskList' | 'taskItem' |
  'codeBlock' | 'blockquote' | 'horizontalRule' | 'table' | 'tableRow' | 'tableCell' | 'tableHeader' | 'image' | 'attachment'
export type RichMarkType = 'bold' | 'italic' | 'strike' | 'underline' | 'code' | 'link' | 'textStyle' | 'highlight'
export type RichAttrs = Record<string, string | number | boolean | null | number[]>
export interface RichMark { type: RichMarkType; attrs?: RichAttrs }
export interface RichNode {
  type: RichNodeType
  attrs?: RichAttrs
  content?: RichNode[]
  text?: string
  marks?: RichMark[]
}
export interface RichDoc { type: 'doc'; content: RichNode[] }
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
export type NoteSummary = Omit<Note, 'content' | 'text'>
/** Library order: pinned first, then most recently modified. */
export function compareNotes(a: Pick<Note, 'id' | 'pinned' | 'updatedAt'>, b: Pick<Note, 'id' | 'pinned' | 'updatedAt'>): number {
  return Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
}
export interface Folder { id: string; name: string; createdAt: string; updatedAt: string }
export interface JotState { version: 1; notes: Note[]; folders: Folder[]; agentEnabled: boolean }
export interface CreateNoteInput {
  title?: string
  content?: RichDoc
  folderId?: string | null
  pinned?: boolean
}
export interface UpdateNotePatch {
  title?: string
  content?: RichDoc
  /** Append paragraphs without replacing existing formatting or earlier text. */
  appendText?: string
  /** Append structured blocks without replacing earlier content. */
  appendContent?: RichDoc
  folderId?: string | null
  pinned?: boolean
}

export const MAX_DOC_BYTES = 1_048_576
export const MAX_TEXT_LENGTH = 200_000
export const MAX_TITLE_LENGTH = 240
export const MAX_FOLDER_NAME_LENGTH = 80
const MAX_NODES = 10_000
const MAX_DEPTH = 32
export const TEXT_COLORS = ['#374151', '#dc2626', '#d97706', '#16a34a', '#2563eb', '#9333ea', '#db2777'] as const
export const HIGHLIGHT_COLORS = ['#fef08a', '#fed7aa', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecdd3'] as const
const BLOCKS = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList',
  'codeBlock', 'blockquote', 'horizontalRule', 'table', 'image', 'attachment'])
const MARKS = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link', 'textStyle', 'highlight'])

/** Normalize equivalent clipboard CSS colors to a finite stored hex palette. */
export function normalizePaletteColor(value: unknown, palette: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  let color = value.trim().toLowerCase()
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*1(?:\.0+)?)?\s*\)$/u.exec(color)
  if (rgb) {
    const channels = rgb.slice(1).map(Number)
    if (channels.some(channel => channel > 255)) return null
    color = '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('')
  }
  return palette.includes(color) ? color : null
}

export function validateAttachmentId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{32}$/u.test(value)) invalid('Invalid attachment id')
  return value
}

function invalid(message: string): never { throw new StoreError('INVALID_INPUT', message) }
export function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(`${name} must be an object`)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) invalid(`${name} must be a plain object`)
  return value as Record<string, unknown>
}
export function onlyKeys(value: Record<string, unknown>, keys: string[], name: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`Unsupported ${name} field: ${key}`)
}
export function boundedString(value: unknown, max: number, name: string, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.trim().length === 0)) {
    invalid(`${name} must be ${allowEmpty ? 'a' : 'a non-empty'} string of at most ${max} characters`)
  }
  return value as string
}
export function validateId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) invalid('Invalid id')
  return value as string
}
export function validateActor(actor: unknown): Actor {
  if (actor !== 'user' && actor !== 'agent') invalid('Invalid actor')
  return actor
}

function mark(value: unknown): RichMark {
  const data = record(value, 'mark')
  onlyKeys(data, ['type', 'attrs'], 'mark')
  if (typeof data.type !== 'string' || !MARKS.has(data.type)) invalid('Unsupported mark type')
  const type = data.type as RichMarkType
  if (type === 'textStyle' || type === 'highlight') {
    const attrs = data.attrs === undefined ? {} : record(data.attrs, 'color attrs')
    onlyKeys(attrs, ['color'], 'color attrs')
    if (attrs.color == null) return { type, attrs: { color: null } }
    const color = normalizePaletteColor(attrs.color, type === 'textStyle' ? TEXT_COLORS : HIGHLIGHT_COLORS)
    if (!color) invalid('Unsupported color')
    return { type, attrs: { color } }
  }
  if (type !== 'link') {
    if (data.attrs !== undefined) onlyKeys(record(data.attrs, 'mark attrs'), [], 'mark attrs')
    return { type }
  }
  const attrs = record(data.attrs, 'link attrs')
  onlyKeys(attrs, ['href', 'target', 'rel', 'class', 'title'], 'link attrs')
  const href = boundedString(attrs.href, 2_048, 'link href', false)
  if (!/^(https?:\/\/|mailto:|tel:|#)/i.test(href) || /[\u0000-\u0020]/.test(href)) invalid('Unsafe link href')
  const result: RichAttrs = { href }
  if (attrs.target !== undefined) {
    if (attrs.target !== null && attrs.target !== '_blank' && attrs.target !== '_self') invalid('Invalid link target')
    result.target = attrs.target as string | null
  }
  for (const key of ['rel', 'class', 'title']) if (attrs[key] !== undefined) {
    result[key] = attrs[key] === null ? null : boundedString(attrs[key], key === 'title' ? 1_000 : 256, `link ${key}`)
  }
  return { type, attrs: result }
}

/** Validate and return a detached canonical document; arbitrary HTML and unknown nodes are rejected. */
export function validateRichDoc(value: unknown): RichDoc {
  const root = record(value, 'document')
  onlyKeys(root, ['type', 'content'], 'document')
  if (root.type !== 'doc' || !Array.isArray(root.content) || root.content.length === 0) invalid('Document requires block content')
  let count = 0
  let textLength = 0
  const node = (input: unknown, depth: number): RichNode => {
    if (depth > MAX_DEPTH || ++count > MAX_NODES) invalid('Document is too complex')
    const data = record(input, 'node')
    onlyKeys(data, ['type', 'attrs', 'content', 'text', 'marks'], 'node')
    if (typeof data.type !== 'string') invalid('Node type is required')
    const type = data.type as RichNodeType
    if (!BLOCKS.has(type) && !['text', 'hardBreak', 'listItem', 'taskItem', 'tableRow', 'tableCell', 'tableHeader'].includes(type)) invalid('Unsupported node type')
    const result: RichNode = { type }
    if (type === 'text') {
      if (data.attrs !== undefined || data.content !== undefined) invalid('Text cannot have attrs or children')
      const text = boundedString(data.text, MAX_TEXT_LENGTH, 'text')
      if (text.length === 0) invalid('Empty text nodes are invalid')
      textLength += text.length
      if (textLength > MAX_TEXT_LENGTH) invalid('Document text is too long')
      result.text = text
      if (data.marks !== undefined) {
        if (!Array.isArray(data.marks) || data.marks.length > MARKS.size) invalid('Invalid marks')
        const validated = data.marks.map(mark)
        if (new Set(validated.map(item => item.type)).size !== validated.length) invalid('Duplicate marks')
        result.marks = validated
      }
      return result
    }
    if (data.text !== undefined || data.marks !== undefined) invalid('Only text nodes carry text or marks')
    const attrs = data.attrs === undefined ? undefined : record(data.attrs, 'node attrs')
    if (type === 'heading') {
      const level = attrs?.level
      if (!attrs || !Number.isInteger(level) || (level as number) < 1 || (level as number) > 6) invalid('Heading level must be 1–6')
      onlyKeys(attrs, ['level'], 'heading attrs')
      result.attrs = { level: level as number }
    } else if (type === 'taskItem') {
      if (!attrs || typeof attrs.checked !== 'boolean') invalid('Task item needs a checked boolean')
      onlyKeys(attrs, ['checked'], 'task attrs')
      result.attrs = { checked: attrs.checked }
    } else if (type === 'orderedList') {
      if (attrs) {
        onlyKeys(attrs, ['start'], 'ordered list attrs')
        if (attrs.start !== undefined && (!Number.isInteger(attrs.start) || (attrs.start as number) < 1 || (attrs.start as number) > 1_000_000)) invalid('Invalid ordered list start')
        result.attrs = { start: (attrs.start as number | undefined) ?? 1 }
      }
    } else if (type === 'codeBlock') {
      if (attrs) {
        onlyKeys(attrs, ['language'], 'code attrs')
        result.attrs = { language: attrs.language == null ? null : boundedString(attrs.language, 80, 'code language') }
      }
    } else if (type === 'tableCell' || type === 'tableHeader') {
      const cell = attrs ?? {}
      onlyKeys(cell, ['colspan', 'rowspan', 'colwidth', 'align'], 'cell attrs')
      const colspan = cell.colspan ?? 1
      const rowspan = cell.rowspan ?? 1
      if (!Number.isInteger(colspan) || (colspan as number) < 1 || (colspan as number) > 50
        || !Number.isInteger(rowspan) || (rowspan as number) < 1 || (rowspan as number) > 200) invalid('Invalid cell span')
      const colwidth = cell.colwidth ?? null
      if (colwidth !== null && (!Array.isArray(colwidth) || colwidth.length !== colspan
        || colwidth.some(width => !Number.isInteger(width) || width < 1 || width > 5_000))) invalid('Invalid column widths')
      const align = cell.align ?? null
      if (align !== null && !['left', 'center', 'right', 'justify'].includes(align as string)) invalid('Invalid cell alignment')
      result.attrs = { colspan: colspan as number, rowspan: rowspan as number,
        colwidth: Array.isArray(colwidth) ? [...colwidth] : null, align: align as string | null }
    } else if (type === 'image' || type === 'attachment') {
      if (!attrs) invalid('Attachment attrs are required')
      onlyKeys(attrs, type === 'image' ? ['attachmentId', 'alt'] : ['attachmentId', 'caption'], 'attachment attrs')
      result.attrs = { attachmentId: validateAttachmentId(attrs.attachmentId),
        [type === 'image' ? 'alt' : 'caption']: boundedString(attrs[type === 'image' ? 'alt' : 'caption'] ?? '', 1_000, 'attachment description') }
    } else if (attrs) onlyKeys(attrs, [], 'node attrs')
    if (['hardBreak', 'horizontalRule', 'image', 'attachment'].includes(type)) {
      if (data.content !== undefined) invalid('Leaf nodes cannot have children')
      return result
    }
    if (data.content !== undefined && !Array.isArray(data.content)) invalid('Node content must be an array')
    const children = ((data.content ?? []) as unknown[]).map(child => node(child, depth + 1))
    if (['paragraph', 'heading', 'codeBlock'].includes(type)) {
      if (children.some(child => type === 'codeBlock' ? child.type !== 'text' || (child.marks?.length ?? 0) > 0 : !['text', 'hardBreak'].includes(child.type))) invalid('Invalid inline content')
    } else if (['bulletList', 'orderedList', 'taskList'].includes(type)) {
      const expected = type === 'taskList' ? 'taskItem' : 'listItem'
      if (children.length === 0 || children.some(child => child.type !== expected)) invalid('Invalid list children')
    } else if (type === 'table') {
      if (!children.length || children.length > 200 || children.some(child => child.type !== 'tableRow')) invalid('Invalid table rows')
      const grid: boolean[][] = Array.from({ length: children.length }, () => [])
      let columns = 0
      for (let row = 0; row < children.length; row++) {
        let column = 0
        for (const cell of children[row]!.content ?? []) {
          while (grid[row]![column]) column++
          const colspan = cell.attrs!.colspan as number
          const rowspan = cell.attrs!.rowspan as number
          if (column + colspan > 50 || row + rowspan > children.length) invalid('Table exceeds its bounds')
          for (let r = row; r < row + rowspan; r++) for (let c = column; c < column + colspan; c++) {
            if (grid[r]![c]) invalid('Overlapping table cells')
            grid[r]![c] = true
          }
          column += colspan
          columns = Math.max(columns, column)
        }
      }
      if (columns === 0 || grid.some(row => row.length !== columns || Array.from({ length: columns }, (_, index) => row[index]).some(cell => !cell))) invalid('Table rows must form a complete rectangle')
    } else if (type === 'tableRow') {
      if (children.length > 50 || children.some(child => !['tableCell', 'tableHeader'].includes(child.type))) invalid('Invalid table cells')
    } else {
      if (children.length === 0 || children.some(child => !BLOCKS.has(child.type))) invalid('Invalid block children')
      if (['listItem', 'taskItem'].includes(type) && children[0]?.type !== 'paragraph') invalid('List items must begin with a paragraph')
    }
    if (children.length > 0) result.content = children
    return result
  }
  const content = root.content.map(child => node(child, 1))
  if (content.some(child => !BLOCKS.has(child.type))) invalid('Document children must be blocks')
  const doc: RichDoc = { type: 'doc', content }
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_DOC_BYTES) invalid('Document exceeds the byte limit')
  return doc
}

export function docFromText(text: string): RichDoc {
  boundedString(text, MAX_TEXT_LENGTH, 'text')
  return validateRichDoc({ type: 'doc', content: text.replace(/\r\n?/g, '\n').split('\n').map(line => ({
    type: 'paragraph', ...(line.length ? { content: [{ type: 'text', text: line }] } : {}),
  })) })
}
export const plaintextToDoc = docFromText

export function docToText(input: RichDoc): string {
  const doc = validateRichDoc(input)
  const render = (node: RichNode): string => {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'horizontalRule') return '---'
    if (node.type === 'image') return String(node.attrs?.alt || '[image]')
    if (node.type === 'attachment') return String(node.attrs?.caption || '[attachment]')
    const inline = ['paragraph', 'heading', 'codeBlock'].includes(node.type)
    const text = (node.content ?? []).map(render).join(inline ? '' : node.type === 'tableRow' ? '\t' : '\n')
    return node.type === 'taskItem' ? `[${node.attrs?.checked ? 'x' : ' '}] ${text}` : text
  }
  return doc.content.map(render).join('\n')
}

// ---------------------------------------------------------------------------
// Block helpers shared by the store, agent tools and the client. Browser-safe.

const isBlankDoc = (doc: RichDoc): boolean => doc.content.length === 1
  && doc.content[0]!.type === 'paragraph' && !doc.content[0]!.content?.length

/** True for a new note's single empty paragraph. */
export function documentIsBlank(doc: RichDoc): boolean { return isBlankDoc(doc) }

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

/**
 * Append blocks after an existing document. A blank document is replaced, and
 * a list continuing a list of the same kind joins it, so "add a to-do" extends
 * the existing checklist instead of starting a second one.
 */
export function appendBlocks(existing: readonly RichNode[], added: readonly RichNode[]): RichNode[] {
  const base = existing.length === 1 && existing[0]!.type === 'paragraph' && !existing[0]!.content?.length ? [] : [...existing]
  const incoming = [...added]
  const last = base.at(-1)
  const first = incoming[0]
  if (last && first && LIST_TYPES.has(last.type) && last.type === first.type) {
    base[base.length - 1] = { ...last, content: [...(last.content ?? []), ...(first.content ?? [])] }
    incoming.shift()
  }
  const content = [...base, ...incoming]
  return content.length ? content : [{ type: 'paragraph' }]
}

/** Managed attachment ids referenced by images and file cards. */
export function documentAttachmentIds(doc: RichDoc): Set<string> {
  const ids = new Set<string>()
  const visit = (node: RichNode) => {
    if ((node.type === 'image' || node.type === 'attachment') && typeof node.attrs?.attachmentId === 'string') ids.add(node.attrs.attachmentId)
    for (const child of node.content ?? []) visit(child)
  }
  for (const node of doc.content) visit(node)
  return ids
}

export interface DocumentTask { index: number; text: string; checked: boolean }

/** Checklist items in document order; indexes are 1-based for agents and people. */
export function documentTasks(doc: RichDoc): DocumentTask[] {
  const tasks: DocumentTask[] = []
  const text = (node: RichNode): string => node.type === 'text' ? node.text ?? ''
    : (node.content ?? []).filter(child => !LIST_TYPES.has(child.type)).map(text).join(node.type === 'paragraph' ? '' : ' ')
  const visit = (node: RichNode) => {
    if (node.type === 'taskItem') tasks.push({ index: tasks.length + 1, text: text(node).trim(), checked: node.attrs?.checked === true })
    for (const child of node.content ?? []) visit(child)
  }
  for (const node of doc.content) visit(node)
  return tasks
}

/** Return a copy with one checklist item changed; the item is chosen by its 1-based index. */
export function setDocumentTask(doc: RichDoc, index: number, checked: boolean): RichDoc {
  if (!Number.isSafeInteger(index) || index < 1) invalid('Task index must be a positive integer')
  let seen = 0
  let found = false
  const visit = (node: RichNode): RichNode => {
    let next = node
    if (node.type === 'taskItem' && ++seen === index) { next = { ...node, attrs: { ...node.attrs, checked } }; found = true }
    return next.content ? { ...next, content: next.content.map(visit) } : next
  }
  const result: RichDoc = { type: 'doc', content: doc.content.map(visit) }
  if (!found) throw new StoreError('NOT_FOUND', `Task ${index} was not found; this note has ${seen} checklist items`)
  return validateRichDoc(result)
}

export interface TextEdit { find: string; replace: string; all?: boolean }
const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])
const blockText = (node: RichNode) => (node.content ?? []).map(child => child.type === 'text' ? child.text ?? '' : '\n').join('')

function occurrences(text: string, find: string): number[] {
  const found: number[] = []
  for (let index = text.indexOf(find); index >= 0; index = text.indexOf(find, index + find.length)) found.push(index)
  return found
}
/** The inline content of [from, to) in a text block; partial text keeps its marks. */
function sliceInline(children: readonly RichNode[], from: number, to: number): RichNode[] {
  const result: RichNode[] = []
  let position = 0
  for (const child of children) {
    const length = child.type === 'text' ? child.text!.length : 1
    const start = Math.max(from, position), end = Math.min(to, position + length)
    if (start < end) result.push(child.type === 'text' ? { ...child, text: child.text!.slice(start - position, end - position) } : child)
    position += length
  }
  return result
}
function marksAt(children: readonly RichNode[], offset: number): RichMark[] | undefined {
  let position = 0
  for (const child of children) {
    const length = child.type === 'text' ? child.text!.length : 1
    if (offset < position + length) return child.type === 'text' ? child.marks : undefined
    position += length
  }
  return undefined
}
function replaceInBlock(node: RichNode, find: string, replace: string, limit: number): RichNode {
  const children = node.content ?? []
  const text = blockText(node)
  const matches = occurrences(text, find).slice(0, limit)
  if (!matches.length) return node
  const content: RichNode[] = []
  let position = 0
  for (const start of matches) {
    content.push(...sliceInline(children, position, start))
    const marks = marksAt(children, start)
    const lines = node.type === 'codeBlock' ? [replace] : replace.split('\n')
    lines.forEach((line, index) => {
      if (index) content.push({ type: 'hardBreak' })
      if (line) content.push(marks?.length ? { type: 'text', text: line, marks: structuredClone(marks) } : { type: 'text', text: line })
    })
    position = start + find.length
  }
  content.push(...sliceInline(children, position, text.length))
  // Neighbouring text with the same formatting becomes one run again.
  const merged: RichNode[] = []
  for (const child of content) {
    const last = merged.at(-1)
    if (child.type === 'text' && last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(child.marks ?? [])) {
      merged[merged.length - 1] = { ...last, text: last.text! + child.text! }
    } else merged.push(child)
  }
  const { content: _previous, ...rest } = node
  return merged.length ? { ...rest, content: merged } : rest
}

/**
 * Replace exact text inside paragraphs, headings and code blocks without
 * touching formatting: the new text takes the marks of the first character it
 * replaces, and a match never crosses blocks. Every edit must match; one that
 * matches several places needs `all`. Applied in order; all or nothing.
 */
export function applyTextEdits(doc: RichDoc, edits: readonly TextEdit[]): { content: RichDoc; counts: number[] } {
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > 50) invalid('edits must list 1 to 50 changes')
  let content = validateRichDoc(doc).content
  const counts: number[] = []
  edits.forEach((edit, position) => {
    const data = record(edit, 'edit')
    onlyKeys(data, ['find', 'replace', 'all'], 'edit')
    const find = boundedString(data.find, 10_000, `edits[${position}].find`, false)
    const replace = boundedString(data.replace, MAX_TEXT_LENGTH, `edits[${position}].replace`)
    if (data.all !== undefined && typeof data.all !== 'boolean') invalid(`edits[${position}].all must be a boolean`)
    let total = 0
    const count = (node: RichNode) => {
      if (TEXT_BLOCKS.has(node.type)) total += occurrences(blockText(node), find).length
      else (node.content ?? []).forEach(count)
    }
    content.forEach(count)
    const label = find.length > 60 ? `${find.slice(0, 57)}…` : find
    if (total === 0) {
      throw new StoreError('INVALID_INPUT', `Edit ${position + 1}: "${label}" is not in the note. Match the note's visible text exactly, without Markdown markers such as ** or #, and within one paragraph.`)
    }
    if (total > 1 && data.all !== true) {
      throw new StoreError('INVALID_INPUT', `Edit ${position + 1}: "${label}" appears ${total} times. Include nearby words so it is unique, or set all: true to replace every occurrence.`)
    }
    const visit = (node: RichNode): RichNode => TEXT_BLOCKS.has(node.type) ? replaceInBlock(node, find, replace, data.all === true ? Infinity : 1)
      : node.content ? { ...node, content: node.content.map(visit) } : node
    content = content.map(visit)
    counts.push(total)
  })
  return { content: validateRichDoc({ type: 'doc', content }), counts }
}
