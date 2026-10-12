import { getMarkRange } from '@tiptap/core'
import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { linkHrefHasCredentials, validateRichDoc } from '../model.js'
import type { JotLocale } from './types.js'

type Dispatch = ((tr: Transaction) => void) | undefined

/** 浮层提交失败时给界面的原因，文案由 `linkApplyMessage` 翻译。 */
export type LinkApplyFailure = 'invalid-href' | 'empty-text' | 'unsupported' | 'stale'

export interface LinkSelection {
  from: number
  to: number
  text: string
  /** 选区落在同一条链接里时的地址；否则为 null。 */
  href: string | null
}

const SCHEME = /^(https?:\/\/|mailto:|tel:|#)/iu

/**
 * 把用户输入收成笔记可以保存的地址。
 * 已带 http(s)、mailto、tel 或 # 的原样保留；没有协议的主机名补上 https。
 * 其它协议（javascript、data、ftp 等）拒绝，避免写进正文后保存失败。
 */
export function normalizeLinkHref(raw: string): string | null {
  let value = raw.trim()
  if (!value || /[\u0000-\u0020]/u.test(value)) return null
  if (!SCHEME.test(value)) {
    if (value.startsWith('//') || value.startsWith('\\')) return null
    const scheme = /^([a-z][a-z0-9+.-]*):/iu.exec(value)
    // localhost:4178 是主机加端口，不是协议。javascript:、ftp:// 这类才拒绝。
    if (scheme && !/^\d/u.test(value.slice(scheme[0].length))) return null
    value = `https://${value}`
  }
  if (value.length > 2_048 || /^(mailto:|tel:|#)$/iu.test(value)) return null
  if (/^https?:\/\//iu.test(value)) {
    let url: URL
    try { url = new URL(value) } catch { return null }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null
    // 带账号口令的地址不写入、也不打开。已经存在的笔记仍能加载，见 model 的校验。
    if (linkHrefHasCredentials(value)) return null
    // 用户没写协议时，单词不能变成链接；localhost 和带点的主机名可以。
    if (!SCHEME.test(raw.trim()) && url.hostname !== 'localhost' && !url.hostname.includes('.')) return null
  }
  try {
    validateRichDoc({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: value } }] },
    ] }] })
  } catch { return null }
  return value
}

/** 可以在新窗口或外部应用里打开的地址。# 锚点不算：笔记里没有可跳转的位置。 */
export function openableLinkHref(raw: string): string | null {
  const href = normalizeLinkHref(raw)
  return href && /^(https?:\/\/|mailto:|tel:)/iu.test(href) ? href : null
}

export function openLinkHref(raw: string): boolean {
  const href = openableLinkHref(raw)
  if (!href || typeof globalThis.open !== 'function') return false
  globalThis.open(href, '_blank', 'noopener,noreferrer')
  return true
}

function hrefInRange(doc: ProseMirrorNode, from: number, to: number): string | null {
  const runs = linkHrefSegments(doc, from, to)
  if (runs.length !== 1) return null
  return runs[0]?.href ?? null
}

/** 选区里每一段连续文字当时的地址。没有链接的文字 href 为 null。相邻且地址相同的会并成一段。 */
export interface LinkHrefSegment { text: string; href: string | null }

export function linkHrefSegments(doc: ProseMirrorNode, from: number, to: number): LinkHrefSegment[] {
  const link = doc.type.schema.marks.link
  if (!link || from >= to) return []
  const segments: LinkHrefSegment[] = []
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.slice(Math.max(0, from - pos), Math.min(node.text.length, to - pos))
    if (!text) return
    const mark = link.isInSet(node.marks)
    const href = mark && mark.attrs.href ? String(mark.attrs.href) : null
    const last = segments.at(-1)
    if (last && last.href === href) last.text += text
    else segments.push({ text, href })
  })
  return segments
}

function sameHrefSegments(left: readonly LinkHrefSegment[], right: readonly LinkHrefSegment[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment.text === right[index]?.text && segment.href === right[index]?.href)
}

/** 光标在链接内时取整段链接；否则用当前选区，方便给选中的文字加链接。 */
export function linkSelection(state: EditorState): LinkSelection {
  const link = state.schema.marks.link
  const { from, to, empty, $from } = state.selection
  if (link && empty) {
    const range = getMarkRange($from, link)
    if (range) {
      return { from: range.from, to: range.to, text: state.doc.textBetween(range.from, range.to, '\n'),
        href: hrefInRange(state.doc, range.from, range.to) }
    }
  }
  return { from, to, text: state.doc.textBetween(from, to, '\n'), href: hrefInRange(state.doc, from, to) }
}

function excludesLink(mark: Mark, linkType: Mark['type']): boolean {
  return mark.type !== linkType && (mark.type.excludes(linkType) || linkType.excludes(mark.type))
}

/**
 * 选区里每个字符的标记。下标与 `textBetween` 对齐，同一父节点内不会插入换行。
 * 光标收起时没有字符可读，返回当前存储的标记，避免插入链接丢掉刚打开的粗体。
 * 空数组表示用户清掉了标记，不能再退回到光标两侧的标记。
 */
function marksAt(state: EditorState, from: number, to: number): (index: number) => readonly Mark[] {
  if (from === to) {
    const stored = state.storedMarks ?? state.doc.resolve(from).marks()
    return () => stored
  }
  const slices: Array<{ text: string; marks: readonly Mark[] }> = []
  if (from < to) state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.slice(Math.max(0, from - pos), Math.min(node.text.length, to - pos))
    if (text) slices.push({ text, marks: node.marks })
  })
  return index => {
    let cursor = 0
    for (const slice of slices) {
      if (index < cursor + slice.text.length) return slice.marks
      cursor += slice.text.length
    }
    return []
  }
}

function sameMarks(left: readonly Mark[], right: readonly Mark[]): boolean {
  return left.length === right.length && left.every(mark => mark.isInSet(right))
}

interface TextPiece { text: string; marks: readonly Mark[] }

/**
 * 按公共前缀和后缀把新文字对齐到旧文字，逐字保留原来的标记。
 * 中间被替换或插入的一段继承被替换字符的公共标记；纯插入则继承相邻字符。
 * 没有任何原文时继承 `markAt(0)`，收起的光标会在那里给出存储的标记。
 */
function piecesForEdit(original: string, next: string, markAt: (index: number) => readonly Mark[]): TextPiece[] {
  let prefix = 0
  const limit = Math.min(original.length, next.length)
  while (prefix < limit && original[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < original.length - prefix && suffix < next.length - prefix
    && original[original.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix++
  const pieces: TextPiece[] = []
  const push = (text: string, marks: readonly Mark[]) => {
    if (!text) return
    const last = pieces.at(-1)
    if (last && sameMarks(last.marks, marks)) last.text += text
    else pieces.push({ text, marks: [...marks] })
  }
  for (let index = 0; index < prefix; index++) push(next[index]!, markAt(index))
  const middle = next.slice(prefix, next.length - suffix)
  if (middle) {
    const replacedEnd = original.length - suffix
    let inherited: readonly Mark[] = []
    if (prefix < replacedEnd) {
      inherited = markAt(prefix)
      for (let index = prefix + 1; index < replacedEnd; index++) {
        const there = markAt(index)
        inherited = inherited.filter(mark => mark.isInSet(there))
      }
    } else if (prefix > 0) inherited = markAt(prefix - 1)
    else if (suffix > 0) inherited = markAt(replacedEnd)
    else inherited = markAt(0)
    push(middle, inherited)
  }
  for (let index = next.length - suffix; index < next.length; index++) {
    push(next[index]!, markAt(original.length - (next.length - index)))
  }
  return pieces
}

function rangeExcludesLink(state: EditorState, from: number, to: number, linkType: Mark['type']): boolean {
  let excluded = false
  state.doc.nodesBetween(from, to, node => {
    if (node.isText && node.marks.some(mark => excludesLink(mark, linkType))) excluded = true
  })
  return excluded
}

function blocksLink(doc: ProseMirrorNode, from: number, to: number): boolean {
  const link = doc.type.schema.marks.link
  if (!link) return true
  const allows = (pos: number) => doc.resolve(pos).parent.type.allowsMarkType(link)
  if (!allows(from)) return true
  if (from === to) return false
  let blocked = false
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText && !doc.resolve(pos).parent.type.allowsMarkType(link)) blocked = true
  })
  return blocked
}

export function linkApplyMessage(result: LinkApplyFailure, locale: JotLocale): string {
  const en = locale === 'en'
  switch (result) {
    case 'invalid-href': return en
      ? 'Enter an http, https, mailto, or tel address, or one that starts with #.'
      : '请输入 http、https、mailto、tel 网址，或以 # 开头的地址。'
    case 'empty-text': return en ? 'Enter the link text.' : '请填写链接文字。'
    case 'stale': return en ? 'The note changed. Open the link again.' : '正文已变化，请重新打开链接。'
    default: return en ? 'A link cannot be added here.' : '这里不能添加链接。'
  }
}

/**
 * 给选区加上或改写链接。文字没改时只加标记。
 * 文字有变化时按前缀和后缀对齐，保留空格和每个字符原有的格式；行内代码不能带链接，就留在代码里。
 * 整段都不能加链接时不改文档。一次事务，撤销一步即可还原。
 */
export function applyEditorLink(state: EditorState, dispatch: Dispatch, input: {
  from: number; to: number; original: string; text: string; href: string
  /** 打开浮层时每一段的地址。混合链接不能收成一个 null，否则并发改过的地址会被盖掉。 */
  originalSegments?: readonly LinkHrefSegment[]
}): true | LinkApplyFailure {
  const link = state.schema.marks.link
  if (!link) return 'unsupported'
  const { from, to } = input
  if (from < 0 || to < from || to > state.doc.content.size) return 'stale'
  if (state.doc.textBetween(from, to, '\n') !== input.original) return 'stale'
  if (input.originalSegments && !sameHrefSegments(linkHrefSegments(state.doc, from, to), input.originalSegments)) return 'stale'
  const href = normalizeLinkHref(input.href)
  if (!href) return 'invalid-href'
  if (blocksLink(state.doc, from, to)) return 'unsupported'
  const unchanged = input.text === input.original
  const sameParent = from === to || state.doc.resolve(from).sameParent(state.doc.resolve(to))
  const mark = link.create({ href })
  let nodes: ProseMirrorNode[] | null = null
  if (!unchanged) {
    // 只拒绝纯空白。用户留下的连续空格和首尾空格都要写回去。
    if (input.text.trim() === '') return 'empty-text'
    if (!sameParent) return 'unsupported'
    nodes = []
    let linked = false
    for (const piece of piecesForEdit(input.original, input.text, marksAt(state, from, to))) {
      const blocked = piece.marks.some(item => excludesLink(item, link))
      const kept = piece.marks.filter(item => item.type !== link && (blocked || !excludesLink(item, link)))
      let node: ProseMirrorNode
      try { node = state.schema.text(piece.text, blocked ? kept : [...kept, mark]) } catch { return 'unsupported' }
      if (!blocked) linked = true
      nodes.push(node)
    }
    // 整段都是行内代码时不加链接，也不把代码标记剥掉。
    if (!linked) return 'unsupported'
  } else if (from === to || input.text === '') {
    return 'empty-text'
  } else if (rangeExcludesLink(state, from, to, link)) {
    return 'unsupported'
  }
  // 先建事务并做和正式提交相同的校验。干跑不能在超长文字上提前返回 true。
  let tr = state.tr
  let end = to
  if (nodes) {
    tr = tr.replaceWith(from, to, nodes)
    end = from + input.text.length
  } else {
    tr = tr.addMark(from, to, mark)
    // 文字没改时，链接必须盖住整段，不能只加上一部分还报成功。
    if (!rangeHasHref(tr.doc, from, end, href)) return 'unsupported'
  }
  if (!tr.docChanged) return true
  try { validateRichDoc(tr.doc.toJSON()) } catch { return 'unsupported' }
  if (!dispatch) return true
  dispatch(tr.setSelection(TextSelection.create(tr.doc, from, end)).scrollIntoView())
  return true
}

function rangeHasHref(doc: ProseMirrorNode, from: number, to: number, href: string): boolean {
  const link = doc.type.schema.marks.link
  if (!link || from >= to) return false
  let found = false
  let covered = true
  doc.nodesBetween(from, to, node => {
    if (!node.isText || !node.text) return
    found = true
    const mark = link.isInSet(node.marks)
    if (!mark || String(mark.attrs.href ?? '') !== href) covered = false
  })
  return found && covered
}

/**
 * 去掉选区上的链接。光标收起时先扩到整段链接。
 * 位置还落在另一条链接上时，地址或原文对不上就不动它。位置越界时返回 false，不抛错。
 */
export function removeEditorLink(state: EditorState, dispatch: Dispatch, range: {
  from: number; to: number; href?: string | null; original?: string
}): boolean {
  const link = state.schema.marks.link
  if (!link) return false
  let { from, to } = range
  if (from < 0 || to < from || to > state.doc.content.size) return false
  if (from === to) {
    const found = getMarkRange(state.doc.resolve(from), link)
    if (!found) return false
    from = found.from
    to = found.to
  }
  if (!state.doc.rangeHasMark(from, to, link)) return false
  if (range.href != null && hrefInRange(state.doc, from, to) !== range.href) return false
  if (range.original !== undefined && state.doc.textBetween(from, to, '\n') !== range.original) return false
  if (!dispatch) return true
  const tr = state.tr.removeMark(from, to, link)
  if (!tr.docChanged) return false
  dispatch(tr.setSelection(TextSelection.create(tr.doc, from, to)).scrollIntoView())
  return true
}

/**
 * 正文里一次 `click` 或 `auxclick` 落在链接上时怎么处理。键盘 Enter 也是 click，detail 为 0。
 * 编辑时单击只落光标，交给浏览器。中键、只读时单击、按住 Command 或 Ctrl 单击由 Jot 打开，并取消原生导航。
 * 右键的 auxclick 和 macOS 的 Ctrl+单击（浏览器不发 click）都不经过这里打开。
 * 双击的第二下只取消、不再打开。# 锚点、没有 href 的 `<a>`（带账号口令的地址）也只取消。
 */
export function linkClickAction(event: { button: number; detail: number; metaKey: boolean; ctrlKey: boolean }, href: string | null, editable: boolean): 'ignore' | 'open' | 'block' {
  const activates = event.button === 1 || (event.button === 0 && (!editable || event.metaKey || event.ctrlKey))
  if (!activates) return 'ignore'
  return href && openableLinkHref(href) && event.detail <= 1 ? 'open' : 'block'
}
