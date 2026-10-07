/**
 * Jot Markdown: what agents read and write, and what Markdown imports use.
 * Parsing returns validated rich documents and never produces HTML. Only the
 * few inline tags that carry Jot formatting (<u>, <mark>, colored <span>,
 * <strong>, <em>, <s>, <code>, <a href>, <br>) are read; any other tag stays
 * literal text. Browser-safe.
 */
import {
  StoreError, HIGHLIGHT_COLORS, MAX_TEXT_LENGTH, TEXT_COLORS, boundedString, normalizePaletteColor, validateRichDoc,
  type RichDoc, type RichMark, type RichNode,
} from './model.js'

function invalid(message: string): never { throw new StoreError('INVALID_INPUT', message) }

/** The highlight that `==text==` and `<mark>` produce. */
export const DEFAULT_HIGHLIGHT = HIGHLIGHT_COLORS[0]
export interface MarkdownAsset { attachmentId: string; image: boolean }
export interface MarkdownOptions {
  /**
   * Resolve an image, or a link standing alone on its line, to a stored
   * attachment. Unresolved targets stay links or literal text.
   */
  asset?: (target: string, embedded: boolean) => MarkdownAsset | undefined
  /** Imports: [[wiki links]] keep their text and ![[embeds]] resolve like images. */
  wikiLinks?: boolean
  /** Imports: links to other local files keep only their text. */
  localLinksAsText?: boolean
  /** Source length limit; agent text defaults to the note text limit. */
  maxLength?: number
}

/** Agents name stored files as attachment:<id>, exactly as jot_read shows them. */
export const AGENT_MARKDOWN: MarkdownOptions = {
  asset: (target, embedded) => {
    const id = /^attachment:([0-9a-f]{32})$/u.exec(target)?.[1]
    return id ? { attachmentId: id, image: embedded } : undefined
  },
}

// ---------------------------------------------------------------------------
// Parsing

/** Container depth keeps nested quotes and lists inside the document depth limit. */
const MAX_NESTING = 12
interface Context { options: MarkdownOptions; depth: number }

function columns(line: string): number {
  let width = 0
  for (const character of line) {
    if (character === ' ') width++
    else if (character === '\t') width += 4 - (width % 4)
    else break
  }
  return width
}
function dedent(line: string, amount: number): string {
  let width = 0
  let index = 0
  while (index < line.length && width < amount) {
    const character = line[index]
    if (character === ' ') width++
    else if (character === '\t') {
      const step = 4 - (width % 4)
      if (width + step > amount) return ' '.repeat(width + step - amount) + line.slice(index + 1)
      width += step
    } else break
    index++
  }
  return line.slice(index)
}

interface Fence { marker: string; language: string | null; indent: number }
function fenceOpen(line: string): Fence | null {
  const indent = columns(line)
  if (indent > 3) return null
  const match = /^(`{3,}|~{3,})(.*)$/u.exec(line.trimStart())
  if (!match) return null
  const info = match[2]!.trim()
  if (match[1]![0] === '`' && info.includes('`')) return null
  const language = info.split(/\s+/u)[0] ?? ''
  return { marker: match[1]!, language: language && language.length <= 80 ? language : null, indent }
}
function fenceClose(line: string, marker: string): boolean {
  const trimmed = line.trim()
  return columns(line) <= 3 && trimmed.length >= marker.length && [...trimmed].every(character => character === marker[0])
}

function heading(line: string): { level: number; text: string } | null {
  if (columns(line) > 3) return null
  const match = /^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/u.exec(line.trimStart())
  if (!match) return null
  const text = match[2] ?? ''
  // Closing hashes need a separator; the # in "C#" is content.
  return { level: match[1]!.length, text: /^#+$/u.test(text) ? '' : text.replace(/[ \t]+#+$/u, '') }
}
const thematicBreak = (line: string) => columns(line) <= 3 && /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/u.test(line.trimStart())
const quoteLine = (line: string) => columns(line) <= 3 && line.trimStart().startsWith('>')
const TABLE_ROW = /^\|.*\|$/u
const TABLE_DELIMITER = /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?$/u

interface Marker { indent: number; kind: 'bullet' | 'ordered' | 'task'; start: number; checked: boolean; text: string }
function listMarker(line: string): Marker | null {
  const indent = columns(line)
  const body = line.trimStart()
  const match = /^([-*+]|(\d{1,9})[.)])(?:[ \t]+(.*))?$/u.exec(body)
  // A bare "[ ] item" is a checklist item, as plain note text shows tasks.
  const bare = match ? null : /^\[( |x|X)\](?:[ \t]+(.*))?$/u.exec(body)
  if (bare) return { indent, kind: 'task', start: 1, checked: bare[1] !== ' ', text: bare[2] ?? '' }
  if (!match) return null
  const text = match[3] ?? ''
  const start = match[2] === undefined ? 1 : Math.max(1, Math.min(1_000_000, Number(match[2])))
  const task = /^\[( |x|X)\](?:[ \t]+(.*))?$/u.exec(text)
  if (task) return { indent, kind: 'task', start, checked: task[1] !== ' ', text: task[2] ?? '' }
  return { indent, kind: match[2] === undefined ? 'bullet' : 'ordered', start, checked: false, text }
}
function startsBlock(line: string): boolean {
  return Boolean(fenceOpen(line) || heading(line) || thematicBreak(line) || quoteLine(line) || listMarker(line)
    || (columns(line) <= 3 && line.trimStart().startsWith('|')))
}

function splitCells(row: string): string[] {
  let source = row.trim()
  if (source.startsWith('|')) source = source.slice(1)
  if (source.endsWith('|') && !source.endsWith('\\|')) source = source.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!
    if (character === '\\' && index + 1 < source.length) {
      // \| is a literal pipe; other escapes belong to the cell's inline text.
      cell += source[index + 1] === '|' ? '|' : character + source[index + 1]
      index++
    } else if (character === '|') { cells.push(cell.trim()); cell = '' }
    else cell += character
  }
  cells.push(cell.trim())
  return cells
}

function table(lines: readonly string[], index: number, context: Context): { node: RichNode; next: number } | null {
  const head = lines[index]!.trim()
  const rule = lines[index + 1]?.trim()
  if (columns(lines[index]!) > 3 || !TABLE_ROW.test(head) || rule === undefined || !rule.includes('-') || !TABLE_DELIMITER.test(rule)) return null
  const alignments = splitCells(rule).map(cell => {
    const left = cell.startsWith(':'), right = cell.endsWith(':')
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null
  })
  const rows = [splitCells(head)]
  let next = index + 2
  while (next < lines.length && rows.length < 200 && columns(lines[next]!) <= 3 && TABLE_ROW.test(lines[next]!.trim())) rows.push(splitCells(lines[next++]!))
  const width = Math.max(...rows.map(row => row.length))
  if (width > 50) invalid('Markdown table exceeds the 50-column limit')
  return { next, node: { type: 'table', content: rows.map((row, rowIndex) => ({ type: 'tableRow', content: Array.from({ length: width }, (_, column) => ({
    type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
    ...alignments[column] ? { attrs: { align: alignments[column]! } } : {},
    content: [paragraph(row[column] ?? '', context)],
  }) as RichNode) })) } }
}

function parseList(lines: readonly string[], start: number, first: Marker, context: Context): { node: RichNode; next: number } {
  const items: RichNode[] = []
  let index = start
  while (index < lines.length) {
    const marker = listMarker(lines[index]!)
    if (!marker || marker.kind !== first.kind || marker.indent < first.indent || marker.indent >= first.indent + 2) break
    const body: string[] = []
    let pending: string[] = []
    let next = index + 1
    while (next < lines.length) {
      const line = lines[next]!
      if (!line.trim()) { pending.push(line); next++; continue }
      // Content indented past the marker belongs to the item, including nested lists.
      if (columns(line) < first.indent + 2) break
      body.push(...pending, line)
      pending = []
      next++
    }
    const content: RichNode[] = [paragraph(marker.text, context)]
    if (body.length) {
      const amount = Math.min(...body.filter(line => line.trim()).map(columns))
      content.push(...blocks(body.map(line => dedent(line, amount)), { ...context, depth: context.depth + 1 }))
    }
    items.push(marker.kind === 'task' ? { type: 'taskItem', attrs: { checked: marker.checked }, content } : { type: 'listItem', content })
    index = next
  }
  const type = first.kind === 'task' ? 'taskList' : first.kind === 'ordered' ? 'orderedList' : 'bulletList'
  return { next: index, node: { type, ...type === 'orderedList' ? { attrs: { start: first.start } } : {}, content: items } }
}

/** A line holding only an image, a file link or an embed becomes that file's block. */
function assetBlock(line: string, context: Context): RichNode | null {
  const resolve = context.options.asset
  if (!resolve) return null
  const source = line.trim()
  if (context.options.wikiLinks) {
    const embed = /^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/u.exec(source)
    if (embed) {
      const asset = resolve(embed[1]!.trim(), true)
      const alias = embed[2]?.trim() ?? ''
      return asset ? assetNode(asset, /^\d+(?:x\d+)?$/u.test(alias) ? '' : alias) : null
    }
  }
  const embedded = source.startsWith('!')
  if (!source.startsWith(embedded ? '![' : '[')) return null
  const link = parseLink(source, embedded ? 1 : 0)
  if (!link || link.end !== source.length) return null
  const asset = resolve(link.destination, embedded)
  return asset ? assetNode(asset, plainText(inline(link.label, context, []))) : null
}
function assetNode(asset: MarkdownAsset, label: string): RichNode {
  return asset.image ? { type: 'image', attrs: { attachmentId: asset.attachmentId, alt: label.slice(0, 1_000) } }
    : { type: 'attachment', attrs: { attachmentId: asset.attachmentId, caption: label.slice(0, 1_000) } }
}

function paragraph(text: string, context: Context): RichNode {
  const content = merge(inline(text.trim(), context, []))
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function blocks(lines: readonly string[], context: Context): RichNode[] {
  const result: RichNode[] = []
  const nested = context.depth < MAX_NESTING
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    // Blank lines only separate blocks.
    if (!line.trim()) { index++; continue }
    const fence = fenceOpen(line)
    if (fence) {
      const body: string[] = []
      let next = index + 1
      while (next < lines.length && !fenceClose(lines[next]!, fence.marker)) body.push(dedent(lines[next++]!, fence.indent))
      const text = body.join('\n')
      result.push({ type: 'codeBlock', attrs: { language: fence.language }, ...text ? { content: [{ type: 'text', text }] } : {} })
      index = next + 1
      continue
    }
    const title = heading(line)
    if (title) { result.push({ type: 'heading', attrs: { level: title.level }, ...nonEmpty(merge(inline(title.text, context, []))) }); index++; continue }
    if (thematicBreak(line)) { result.push({ type: 'horizontalRule' }); index++; continue }
    const grid = table(lines, index, context)
    if (grid) { result.push(grid.node); index = grid.next; continue }
    if (quoteLine(line) && nested) {
      const inner: string[] = []
      while (index < lines.length && quoteLine(lines[index]!)) inner.push(lines[index++]!.trimStart().slice(1).replace(/^[ \t]/u, ''))
      const content = blocks(inner, { ...context, depth: context.depth + 1 })
      result.push({ type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] })
      continue
    }
    const marker = nested ? listMarker(line) : null
    if (marker) {
      const list = parseList(lines, index, marker, context)
      result.push(list.node)
      index = list.next
      continue
    }
    const asset = assetBlock(line, context)
    if (asset) { result.push(asset); index++; continue }
    // A line ending in two spaces or a backslash continues with a line break.
    const parts = [line]
    while (hardBreakEnd(parts.at(-1)!) && index + parts.length < lines.length) {
      const next = lines[index + parts.length]!
      if (!next.trim() || startsBlock(next)) break
      parts.push(next)
    }
    if (parts.length === 1) result.push(...splitAssets(line, context))
    else {
      const content: RichNode[] = []
      parts.forEach((part, position) => {
        if (position) content.push({ type: 'hardBreak' })
        const text = position < parts.length - 1 ? part.replace(/(?: {2,}|\\)$/u, '') : part
        content.push(...inline(text.trim(), context, []))
      })
      result.push({ type: 'paragraph', ...nonEmpty(merge(content)) })
    }
    index += parts.length
  }
  return result
}

/** Images inside a line of text become their own blocks between the surrounding text. */
function splitAssets(line: string, context: Context): RichNode[] {
  const resolve = context.options.asset
  if (!resolve || !line.includes('![')) return [paragraph(line, context)]
  const result: RichNode[] = []
  let start = 0
  for (let index = line.indexOf('!['); index >= 0; index = line.indexOf('![', index + 1)) {
    if (index < start || line[index - 1] === '\\') continue
    let end = -1
    let asset: RichNode | null = null
    if (context.options.wikiLinks && line[index + 2] === '[') {
      const close = line.indexOf(']]', index + 3)
      if (close > 0) { end = close + 2; asset = assetBlock(line.slice(index, end), context) }
    } else {
      const link = parseLink(line, index + 1)
      if (link) { end = link.end; asset = assetBlock(line.slice(index, end), context) }
    }
    if (!asset) continue
    const before = line.slice(start, index)
    if (before.trim()) result.push(paragraph(before, context))
    result.push(asset)
    start = end
    index = end - 1
  }
  const rest = line.slice(start)
  if (rest.trim() || !result.length) result.push(paragraph(rest, context))
  return result
}

const nonEmpty = (content: RichNode[]) => content.length ? { content } : {}
/** Two trailing spaces, or an unescaped trailing backslash, break the line. */
const hardBreakEnd = (line: string) => / {2,}$/u.test(line) || (/\\+$/u.exec(line)?.[0].length ?? 0) % 2 === 1

// Inline -------------------------------------------------------------------

const PUNCTUATION = /[!-/:-@[-`{-~]/u
const WORD = /[\p{L}\p{N}]/u
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

function sameMarks(left: readonly RichMark[] = [], right: readonly RichMark[] = []): boolean {
  return markKey(left) === markKey(right)
}
function markKey(marks: readonly RichMark[] = []): string {
  return JSON.stringify([...marks].map(mark => [mark.type, mark.type === 'link' ? mark.attrs?.href : mark.attrs?.color ?? null])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}
/** Code text carries no other mark, as in the editor. */
function withMark(marks: readonly RichMark[], mark: RichMark): RichMark[] {
  if (marks.some(item => item.type === 'code')) return [...marks]
  return [...marks.filter(item => item.type !== mark.type), mark]
}
function textNode(text: string, marks: readonly RichMark[]): RichNode {
  return marks.length ? { type: 'text', text, marks: marks.map(mark => ({ ...mark, ...mark.attrs ? { attrs: { ...mark.attrs } } : {} })) } : { type: 'text', text }
}
function merge(nodes: readonly RichNode[]): RichNode[] {
  const result: RichNode[] = []
  for (const node of nodes) {
    const last = result.at(-1)
    if (node.type === 'text' && !node.text) continue
    if (node.type === 'text' && last?.type === 'text' && sameMarks(last.marks, node.marks)) result[result.length - 1] = { ...last, text: last.text! + node.text! }
    else result.push(node)
  }
  return result
}
const plainText = (nodes: readonly RichNode[]) => nodes.map(node => node.type === 'text' ? node.text : node.type === 'hardBreak' ? ' ' : '').join('').trim()
function runLength(source: string, index: number, character: string): number {
  let end = index
  while (source[end] === character) end++
  return end - index
}
function codeClose(source: string, from: number, length: number): number {
  for (let index = source.indexOf('`', from); index >= 0; index = source.indexOf('`', index)) {
    const run = runLength(source, index, '`')
    if (run === length) return index
    index += run
  }
  return -1
}
export function safeHref(value: string): string | undefined {
  return /^(?:https?:\/\/|mailto:|tel:|#)/iu.test(value) && !/[\u0000-\u0020]/u.test(value) && value.length <= 2_048 ? value : undefined
}

interface Link { label: string; destination: string; end: number }
/** `[label](destination "title")` starting at `index`; the destination may be <bracketed>. */
function parseLink(source: string, index: number): Link | null {
  if (source[index] !== '[') return null
  let depth = 0
  let cursor = index
  for (; cursor < source.length; cursor++) {
    const character = source[cursor]
    if (character === '\\') cursor++
    else if (character === '[') depth++
    else if (character === ']' && --depth === 0) break
  }
  if (cursor >= source.length || source[cursor + 1] !== '(') return null
  const label = source.slice(index + 1, cursor)
  let position = cursor + 2
  while (source[position] === ' ' || source[position] === '\t') position++
  let destination: string
  if (source[position] === '<') {
    const close = source.indexOf('>', position + 1)
    if (close < 0) return null
    destination = source.slice(position + 1, close)
    if (/[<\n]/u.test(destination)) return null
    position = close + 1
  } else {
    const begin = position
    let parentheses = 0
    while (position < source.length) {
      const character = source[position]!
      if (character === '\\' && position + 1 < source.length) { position += 2; continue }
      if (/\s/u.test(character)) break
      if (character === '(' && ++parentheses > 32) return null
      if (character === ')') { if (parentheses === 0) break; parentheses-- }
      position++
    }
    destination = source.slice(begin, position)
  }
  let end = position
  while (source[end] === ' ' || source[end] === '\t') end++
  if (end > position && (source[end] === '"' || source[end] === "'" || source[end] === '(')) {
    const close = source[end] === '(' ? ')' : source[end]
    let cursor = end + 1
    while (cursor < source.length && source[cursor] !== close) cursor += source[cursor] === '\\' ? 2 : 1
    if (cursor >= source.length) return null
    end = cursor + 1
    while (source[end] === ' ' || source[end] === '\t') end++
  }
  if (source[end] !== ')') return null
  return { label, destination: destination.replace(/\\([!-/:-@[-`{-~])/gu, '$1'), end: end + 1 }
}

const TAG_MARKS: Record<string, RichMark> = {
  u: { type: 'underline' }, mark: { type: 'highlight', attrs: { color: DEFAULT_HIGHLIGHT } },
  strong: { type: 'bold' }, b: { type: 'bold' }, em: { type: 'italic' }, i: { type: 'italic' },
  s: { type: 'strike' }, del: { type: 'strike' }, code: { type: 'code' },
}
function styleMarks(attributes: string): RichMark[] {
  const style = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/iu.exec(attributes)
  const marks: RichMark[] = []
  for (const declaration of (style?.[1] ?? style?.[2] ?? '').split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (property === 'color') {
      const color = normalizePaletteColor(value, TEXT_COLORS)
      if (color) marks.push({ type: 'textStyle', attrs: { color } })
    } else if (property === 'background-color' || property === 'background') {
      const color = normalizePaletteColor(value, HIGHLIGHT_COLORS)
      if (color) marks.push({ type: 'highlight', attrs: { color } })
    }
  }
  return marks
}
function inlineTag(source: string, index: number, context: Context, marks: readonly RichMark[]): { nodes: RichNode[]; end: number } | null {
  const rest = source.slice(index)
  const lineBreak = /^<br\s*\/?>/iu.exec(rest)
  if (lineBreak) return { nodes: [{ type: 'hardBreak' }], end: index + lineBreak[0].length }
  const autolink = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/iu.exec(rest)
  if (autolink) {
    const href = safeHref(autolink[1]!)
    return href ? { nodes: [textNode(autolink[1]!, withMark(marks, { type: 'link', attrs: { href } }))], end: index + autolink[0].length } : null
  }
  const open = /^<(u|mark|span|strong|b|em|i|s|del|code|a)(\s[^<>]*)?>/iu.exec(rest)
  if (!open) return null
  const name = open[1]!.toLowerCase()
  const tags = new RegExp(`<(/?)${name}(?:\\s[^<>]*)?>`, 'giu')
  tags.lastIndex = index + open[0].length
  let depth = 1
  let close: RegExpExecArray | null = null
  while ((close = tags.exec(source))) {
    depth += close[1] ? -1 : 1
    if (depth === 0) break
  }
  if (!close) return null
  const inner = source.slice(index + open[0].length, close.index)
  const end = close.index + close[0].length
  if (name === 'code') return { nodes: inner ? [textNode(inner, [{ type: 'code' }])] : [], end }
  let next = [...marks]
  if (name === 'a') {
    const href = safeHref(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/iu.exec(open[2] ?? '')?.slice(1).find(value => value !== undefined) ?? '')
    if (href) next = withMark(next, { type: 'link', attrs: { href } })
  } else for (const mark of name === 'span' ? styleMarks(open[2] ?? '') : [TAG_MARKS[name]!]) next = withMark(next, mark)
  return { nodes: inline(inner, context, next), end }
}

/** `*`, `_`, `~~` and `==` runs; a closing run must match the opening run's length. */
function emphasis(source: string, index: number, context: Context, marks: readonly RichMark[]): { nodes: RichNode[]; end: number } | null {
  const character = source[index]!
  const run = runLength(source, index, character)
  if (character === '~' || character === '=' ? run !== 2 : run > 3) return null
  const after = source[index + run]
  if (after === undefined || /\s/u.test(after)) return null
  if (character === '_' && index > 0 && WORD.test(source[index - 1]!)) return null
  for (let cursor = index + run; cursor < source.length;) {
    const current = source[cursor]!
    if (current === '\\') { cursor += 2; continue }
    if (current === '`') {
      const ticks = runLength(source, cursor, '`')
      const close = codeClose(source, cursor + ticks, ticks)
      cursor = close >= 0 ? close + ticks : cursor + ticks
      continue
    }
    if (current !== character) { cursor++; continue }
    const length = runLength(source, cursor, character)
    if (length === run && cursor > index + run && !/\s/u.test(source[cursor - 1]!)
      && !(character === '_' && WORD.test(source[cursor + length] ?? ''))) {
      const added: RichMark[] = character === '~' ? [{ type: 'strike' }]
        : character === '=' ? [{ type: 'highlight', attrs: { color: DEFAULT_HIGHLIGHT } }]
          : run === 1 ? [{ type: 'italic' }] : run === 2 ? [{ type: 'bold' }] : [{ type: 'bold' }, { type: 'italic' }]
      let next = [...marks]
      for (const mark of added) next = withMark(next, mark)
      return { nodes: inline(source.slice(index + run, cursor), context, next), end: cursor + length }
    }
    cursor += length
  }
  return null
}

function inline(source: string, context: Context, marks: readonly RichMark[]): RichNode[] {
  const result: RichNode[] = []
  let buffer = ''
  const flush = () => { if (buffer) result.push(textNode(buffer, marks)); buffer = '' }
  const push = (nodes: readonly RichNode[]) => { flush(); result.push(...nodes) }
  let index = 0
  while (index < source.length) {
    const character = source[index]!
    if (character === '\\' && index + 1 < source.length && PUNCTUATION.test(source[index + 1]!)) {
      buffer += source[index + 1]
      index += 2
      continue
    }
    if (character === '`') {
      const run = runLength(source, index, '`')
      const close = codeClose(source, index + run, run)
      if (close < 0) { buffer += source.slice(index, index + run); index += run; continue }
      let code = source.slice(index + run, close)
      if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)
      if (code) push([textNode(code, [{ type: 'code' }])])
      index = close + run
      continue
    }
    if (character === '<') {
      const tag = inlineTag(source, index, context, marks)
      if (tag) { push(tag.nodes); index = tag.end; continue }
    }
    if (character === '&') {
      const reference = /^&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-z]{2,6}));/u.exec(source.slice(index, index + 12))
      const named = reference?.[3] === undefined ? undefined : ENTITIES[reference[3]]
      if (reference && (reference[3] === undefined || named !== undefined)) {
        const code = reference[1] ? Number(reference[1]) : reference[2] ? parseInt(reference[2], 16) : 0
        buffer += named ?? (code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : '\ufffd')
        index += reference[0].length
        continue
      }
    }
    if (character === '[' && context.options.wikiLinks && source[index + 1] === '[') {
      const close = source.indexOf(']]', index + 2)
      if (close > index + 2) {
        const inner = source.slice(index + 2, close)
        buffer += (inner.split('|').at(-1) ?? inner).trim()
        index = close + 2
        continue
      }
    }
    if (character === '[' || (character === '!' && source[index + 1] === '[')) {
      const image = character === '!'
      const link = parseLink(source, image ? index + 1 : index)
      if (link) {
        const href = safeHref(link.destination)
        const local = !/^[a-z][a-z0-9+.-]*:/iu.test(link.destination)
        if (href && !image) { push(inline(link.label, context, withMark(marks, { type: 'link', attrs: { href } }))); index = link.end; continue }
        if (href) {
          // A web image cannot be stored inline; keep it as a link.
          push([textNode(plainText(inline(link.label, context, [])) || link.destination, withMark(marks, { type: 'link', attrs: { href } }))])
          index = link.end
          continue
        }
        if (local && context.options.localLinksAsText && !image) { push(inline(link.label, context, marks)); index = link.end; continue }
        buffer += source.slice(index, link.end)
        index = link.end
        continue
      }
    }
    if (character === '*' || character === '_' || character === '~' || character === '=') {
      const marked = emphasis(source, index, context, marks)
      if (marked) { push(marked.nodes); index = marked.end; continue }
      const run = runLength(source, index, character)
      buffer += source.slice(index, index + run)
      index += run
      continue
    }
    buffer += character
    index++
  }
  flush()
  return result
}

/**
 * Convert Markdown into a rich document: # headings, - / 1. / - [ ] lists
 * (indent to nest), > quotes, fenced code, --- rules, | tables |, **bold**,
 * *italic*, ~~strike~~, ==highlight==, `code`, [links](https://…), a few
 * formatting tags, and stored files named by the options. Every other line
 * becomes a literal paragraph.
 */
export function docFromMarkdown(source: string, options: MarkdownOptions = AGENT_MARKDOWN): RichDoc {
  boundedString(source, options.maxLength ?? MAX_TEXT_LENGTH, 'text')
  const content = blocks(source.replace(/\r\n?/gu, '\n').split('\n'), { options, depth: 0 })
  return validateRichDoc({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] })
}

// ---------------------------------------------------------------------------
// Serializing

const isWord = (character: string | undefined) => character !== undefined && WORD.test(character)
function escapeText(text: string): string {
  let result = ''
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!
    const previous = text[index - 1], next = text[index + 1]
    if ('\\`*[]<'.includes(character)) result += `\\${character}`
    else if (character === '_' && !(isWord(previous) && isWord(next))) result += '\\_'
    else if ((character === '~' || character === '=') && (previous === character || next === character)) result += `\\${character}`
    else if (character === '&' && /^&(?:#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/u.test(text.slice(index, index + 12))) result += '\\&'
    else result += character
  }
  return result
}
/** Text that would otherwise start a heading, list, quote, rule or table. */
function escapeLineStart(line: string): string {
  if (/^(?:#{1,6}|[-+>|])(?:[ \t]|$)/u.test(line) || /^>|^\|/u.test(line) || /^([-_])(?:[ \t]*\1){2,}[ \t]*$/u.test(line)) return `\\${line}`
  const ordered = /^(\d{1,9})([.)])(?=[ \t]|$)/u.exec(line)
  return ordered ? `${ordered[1]}\\${line.slice(ordered[1]!.length)}` : line
}
function codeSpan(text: string): string {
  const fence = '`'.repeat(1 + Math.max(0, ...[...text.matchAll(/`+/gu)].map(match => match[0].length)))
  return `${fence}${/^[ `]|[ `]$/u.test(text) ? ` ${text} ` : text}${fence}`
}

type InlineStyle = 'markdown' | 'tags'
const MARK_RANK = ['link', 'textStyle', 'highlight', 'underline', 'strike', 'bold', 'italic']
function openMark(mark: RichMark, style: InlineStyle): string {
  switch (mark.type) {
    case 'link': return '['
    case 'bold': return style === 'tags' ? '<strong>' : '**'
    case 'italic': return style === 'tags' ? '<em>' : '*'
    case 'strike': return style === 'tags' ? '<s>' : '~~'
    case 'underline': return '<u>'
    case 'highlight': return mark.attrs?.color === DEFAULT_HIGHLIGHT ? '<mark>' : `<span style="background-color:${mark.attrs?.color}">`
    case 'textStyle': return `<span style="color:${mark.attrs?.color}">`
    default: return ''
  }
}
function closeMark(mark: RichMark, style: InlineStyle): string {
  switch (mark.type) {
    case 'link': { const href = String(mark.attrs?.href); return /[()<>\\]/u.test(href) && !/[<>]/u.test(href) ? `](<${href}>)` : `](${href})` }
    case 'bold': return style === 'tags' ? '</strong>' : '**'
    case 'italic': return style === 'tags' ? '</em>' : '*'
    case 'strike': return style === 'tags' ? '</s>' : '~~'
    case 'underline': return '</u>'
    case 'highlight': return mark.attrs?.color === DEFAULT_HIGHLIGHT ? '</mark>' : '</span>'
    case 'textStyle': return '</span>'
    default: return ''
  }
}
/** Marks that show nothing on spaces; delimiters cannot open or close beside a space. */
const SPACE_INVISIBLE = new Set(['bold', 'italic', 'strike'])
const visibleMarks = (node: RichNode): RichMark[] => (node.marks ?? []).filter(mark =>
  !((mark.type === 'textStyle' || mark.type === 'highlight') && !mark.attrs?.color)
  && !(SPACE_INVISIBLE.has(mark.type) && !node.text?.trim()))

/** Leading and trailing spaces leave bold, italic and strike runs so their delimiters stay valid. */
function inlineItems(nodes: readonly RichNode[]): RichNode[] {
  const items: RichNode[] = []
  for (const node of nodes) {
    if (node.type !== 'text' || !node.text || !node.marks?.some(mark => SPACE_INVISIBLE.has(mark.type))) { items.push(node); continue }
    const match = /^(\s*)(.*?)(\s*)$/su.exec(node.text)!
    const plain = node.marks.filter(mark => !SPACE_INVISIBLE.has(mark.type))
    if (match[1]) items.push(textNode(match[1], plain))
    if (match[2]) items.push(node.text === match[2] ? node : { ...node, text: match[2] })
    if (match[3]) items.push(textNode(match[3], plain))
  }
  return merge(items)
}
function inlineMarkdown(nodes: readonly RichNode[], style: InlineStyle): string {
  const items = inlineItems(nodes)
  const marksOf = items.map(node => node.type === 'text' ? visibleMarks(node) : [])
  const same = (left: RichMark, right: RichMark) => markKey([left]) === markKey([right])
  const reach = (start: number, mark: RichMark) => {
    let end = start
    while (end < items.length && (items[end]!.type === 'hardBreak' || marksOf[end]!.some(item => same(item, mark)))) end++
    return end
  }
  let result = ''
  const stack: RichMark[] = []
  items.forEach((node, index) => {
    if (node.type === 'hardBreak') { result += '<br>'; return }
    const marks = marksOf[index]!
    if (marks.some(mark => mark.type === 'code')) {
      while (stack.length && !marks.some(mark => same(mark, stack.at(-1)!))) result += closeMark(stack.pop()!, style)
      result += codeSpan(node.text ?? '')
      return
    }
    let keep = 0
    while (keep < stack.length && marks.some(mark => same(mark, stack[keep]!))) keep++
    while (stack.length > keep) result += closeMark(stack.pop()!, style)
    const opening = marks.filter(mark => !stack.some(open => same(open, mark)))
      .sort((a, b) => reach(index, b) - reach(index, a) || MARK_RANK.indexOf(a.type) - MARK_RANK.indexOf(b.type))
    for (const mark of opening) { result += openMark(mark, style); stack.push(mark) }
    result += escapeText(node.text ?? '')
  })
  while (stack.length) result += closeMark(stack.pop()!, style)
  return result
}
/** Delimiters are readable; formatting they cannot express exactly falls back to tags. */
function textMarkdown(nodes: readonly RichNode[], table = false): string {
  // In a table every pipe is escaped, including inside code, as GFM requires.
  const render = (style: InlineStyle) => table ? inlineMarkdown(nodes, style).replace(/\|/gu, '\\|') : inlineMarkdown(nodes, style)
  const parse = (source: string) => JSON.stringify(canonicalInline(inline(table ? splitCells(`|${source}|`)[0] ?? '' : source, { options: AGENT_MARKDOWN, depth: 0 }, [])))
  const expected = JSON.stringify(canonicalInline(nodes))
  const markdown = render('markdown')
  if (parse(markdown) === expected) return markdown
  const tags = render('tags')
  return parse(tags) === expected ? tags : markdown
}

function indentBody(text: string, width: number): string {
  return text.split('\n').map(line => line ? ' '.repeat(width) + line : '').join('\n')
}
function blockMarkdown(node: RichNode): string {
  switch (node.type) {
    case 'paragraph': return escapeLineStart(textMarkdown(node.content ?? []))
    case 'heading': {
      let text = textMarkdown(node.content ?? [])
      if (/(?:^|[ \t])#+$/u.test(text)) text = `${text.slice(0, -1)}\\#`
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))}${text ? ` ${text}` : ''}`
    }
    case 'codeBlock': {
      const text = (node.content ?? []).map(child => child.text ?? '').join('')
      const fence = '`'.repeat(Math.max(3, 1 + Math.max(0, ...[...text.matchAll(/`+/gu)].map(match => match[0].length))))
      const language = typeof node.attrs?.language === 'string' && /^[^\s`]+$/u.test(node.attrs.language) ? node.attrs.language : ''
      return `${fence}${language}\n${text ? `${text}\n` : ''}${fence}`
    }
    case 'horizontalRule': return '---'
    case 'blockquote': return blocksMarkdown(node.content ?? []).split('\n').map(line => line ? `> ${line}` : '>').join('\n')
    case 'bulletList': case 'orderedList': case 'taskList': {
      const start = Number(node.attrs?.start ?? 1)
      return (node.content ?? []).map((item, index) => {
        const marker = node.type === 'orderedList' ? `${start + index}. ` : node.type === 'taskList' ? `- [${item.attrs?.checked ? 'x' : ' '}] ` : '- '
        const [first, ...rest] = item.content ?? []
        const head = first?.type === 'paragraph' ? textMarkdown(first.content ?? []) : ''
        const body = rest.map(blockMarkdown).join('\n')
        return `${marker}${head}${body ? `\n${indentBody(body, node.type === 'orderedList' ? marker.length : 2)}` : ''}`
      }).join('\n')
    }
    case 'table': {
      const rows = node.content ?? []
      const cell = (value: RichNode) => (value.content ?? []).map(child => child.type === 'paragraph'
        ? textMarkdown(child.content ?? [], true) : escapeText(plainBlock(child)).replace(/\|/gu, '\\|')).join('<br>')
      const width = Math.max(0, ...rows.map(row => row.content?.length ?? 0))
      const align = Array.from({ length: width }, (_, column) => rows[0]?.content?.[column]?.attrs?.align)
      const lines = rows.map(row => `| ${(row.content ?? []).map(cell).join(' | ')} |`)
      return [lines[0]!, `| ${align.map(value => value === 'center' ? ':---:' : value === 'right' ? '---:' : value === 'left' ? ':---' : '---').join(' | ')} |`, ...lines.slice(1)].join('\n')
    }
    case 'image': return `![${escapeText(String(node.attrs?.alt ?? ''))}](attachment:${node.attrs?.attachmentId})`
    case 'attachment': return `[${escapeText(String(node.attrs?.caption ?? ''))}](attachment:${node.attrs?.attachmentId})`
    default: return ''
  }
}
const plainBlock = (node: RichNode): string => node.type === 'text' ? node.text ?? '' : (node.content ?? []).map(plainBlock).join(' ')
const blocksMarkdown = (nodes: readonly RichNode[]) => nodes.map(blockMarkdown).join('\n\n')

/** The note as the Markdown agents read: docFromMarkdown turns it back into the same document when markdownLosses is empty. */
export function docToMarkdown(input: RichDoc): string {
  return blocksMarkdown(validateRichDoc(input).content)
}

// ---------------------------------------------------------------------------
// Round trips

/** Comparable form: whitespace at block edges, empty paragraphs and invisible marks do not count. */
function canonicalInline(nodes: readonly RichNode[]): unknown[] {
  const items = merge(inlineItems(nodes).flatMap(node => node.type !== 'text' ? [{ type: node.type }]
    : [textNode(node.text ?? '', visibleMarks(node).map((mark): RichMark => mark.type === 'link' ? { type: mark.type, attrs: { href: mark.attrs?.href ?? null } }
      : mark.attrs?.color ? { type: mark.type, attrs: { color: mark.attrs.color } } : { type: mark.type }))]))
  while (items[0]?.type === 'text' && !items[0].text!.trim()) items.shift()
  while (items.at(-1)?.type === 'text' && !items.at(-1)!.text!.trim()) items.pop()
  if (items[0]?.type === 'text') items[0] = { ...items[0], text: items[0].text!.trimStart() }
  if (items.at(-1)?.type === 'text') items[items.length - 1] = { ...items.at(-1)!, text: items.at(-1)!.text!.trimEnd() }
  return items.map(node => node.type === 'text' ? [node.text, markKey(node.marks)] : node.type)
}
function canonicalBlocks(nodes: readonly RichNode[]): unknown[] {
  return nodes.flatMap(node => {
    switch (node.type) {
      case 'paragraph': { const content = canonicalInline(node.content ?? []); return content.length ? [['p', content]] : [] }
      case 'heading': return [['h', node.attrs?.level, canonicalInline(node.content ?? [])]]
      case 'codeBlock': return [['code', node.attrs?.language ?? null, (node.content ?? []).map(child => child.text).join('')]]
      case 'bulletList': case 'orderedList': case 'taskList':
        return [[node.type, node.type === 'orderedList' ? node.attrs?.start ?? 1 : null,
          (node.content ?? []).map(item => [item.attrs?.checked ?? null, canonicalBlocks(item.content ?? [])])]]
      case 'blockquote': return [['quote', canonicalBlocks(node.content ?? [])]]
      case 'table': return [['table', (node.content ?? []).map(row => (row.content ?? []).map(cell => [cell.type, cell.attrs ?? null, canonicalBlocks(cell.content ?? [])]))]]
      case 'image': return [['image', node.attrs?.attachmentId, node.attrs?.alt ?? '']]
      case 'attachment': return [['file', node.attrs?.attachmentId, node.attrs?.caption ?? '']]
      default: return [[node.type]]
    }
  })
}
const roundTrips = (nodes: readonly RichNode[]): boolean => {
  try {
    const parsed = docFromMarkdown(blocksMarkdown(nodes), { ...AGENT_MARKDOWN, maxLength: Number.MAX_SAFE_INTEGER })
    return JSON.stringify(canonicalBlocks(parsed.content)) === JSON.stringify(canonicalBlocks(nodes))
  } catch { return false }
}
const LOSS: Partial<Record<string, string>> = {
  table: 'table layout (merged cells, column widths, cell alignment or cells with several blocks)',
  bulletList: 'list structure', orderedList: 'list structure', taskList: 'list structure',
  blockquote: 'quote structure', codeBlock: 'code block details',
}

/**
 * Formatting that the Markdown from docToMarkdown cannot carry. Replacing the
 * note with rewritten Markdown would silently drop exactly these things.
 */
export function markdownLosses(input: RichDoc): string[] {
  const doc = validateRichDoc(input)
  if (roundTrips(doc.content)) return []
  const losses = new Set<string>()
  for (const node of doc.content) if (!roundTrips([node])) losses.add(LOSS[node.type] ?? 'some text formatting')
  if (!losses.size) losses.add('the boundary between neighbouring lists')
  return [...losses]
}

/** The plain text of one line of inline Markdown, such as an imported title. */
export function markdownInlineText(source: string): string {
  return plainText(merge(inline(source, { options: {}, depth: 0 }, [])))
}
