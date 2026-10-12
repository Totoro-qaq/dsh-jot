import { getMarkRange } from '@tiptap/core'
import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { validateRichDoc } from '../model.js'
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
    if (url.username !== '' || url.password !== '') return null
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

/** 可以在新窗口或外部应用里打开的地址。页内 # 锚点留给浏览器自己处理。 */
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
  const link = doc.type.schema.marks.link
  if (!link || from === to) return null
  let href: string | null | undefined
  doc.nodesBetween(from, to, node => {
    if (!node.isText) return
    const mark = link.isInSet(node.marks)
    const value = mark ? String(mark.attrs.href ?? '') : null
    if (href === undefined) href = value
    else if (href !== value) href = null
  })
  return href || null
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

function marksAcross(state: EditorState, from: number, to: number): readonly Mark[] {
  if (from === to) return state.storedMarks ?? state.doc.resolve(from).marks()
  let found: readonly Mark[] | null = null
  state.doc.nodesBetween(from, to, node => {
    if (!node.isText) return
    found = found === null ? node.marks : found.filter(mark => mark.isInSet(node.marks))
  })
  return found ?? []
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
 * 给选区加上或改写链接。文字没改时只加标记；文字有变化时在同一段内替换，并保留整段都有的其它格式。
 * 一次事务，撤销一步即可还原。
 */
export function applyEditorLink(state: EditorState, dispatch: Dispatch, input: {
  from: number; to: number; original: string; text: string; href: string
}): true | LinkApplyFailure {
  const link = state.schema.marks.link
  if (!link) return 'unsupported'
  const { from, to } = input
  if (from < 0 || to < from || to > state.doc.content.size) return 'stale'
  if (state.doc.textBetween(from, to, '\n') !== input.original) return 'stale'
  const href = normalizeLinkHref(input.href)
  if (!href) return 'invalid-href'
  if (blocksLink(state.doc, from, to)) return 'unsupported'
  // 文字没改时只加链接标记，保留首尾空白、连续空格，以及只覆盖其中一段的粗体等。
  const unchanged = input.text === input.original
  const sameParent = from === to || state.doc.resolve(from).sameParent(state.doc.resolve(to))
  let replacement: string | null = null
  if (!unchanged) {
    replacement = input.text.replace(/\s+/gu, ' ').trim()
    if (!replacement) return 'empty-text'
    if (!sameParent) return 'unsupported'
  } else if (from === to || input.text === '') {
    return 'empty-text'
  }
  if (!dispatch) return true
  const mark = link.create({ href })
  let tr = state.tr
  let end = to
  if (replacement !== null) {
    const kept = marksAcross(state, from, to).filter(item =>
      item.type !== link && !item.type.excludes(mark.type) && !mark.type.excludes(item.type))
    let node
    try { node = state.schema.text(replacement, [...kept, mark]) } catch { return 'unsupported' }
    tr = tr.replaceWith(from, to, node)
    end = from + replacement.length
  } else {
    tr = tr.addMark(from, to, mark)
  }
  // 行内代码会排除其它标记。没有真正加上链接时不能报成功，也不留下只覆盖一部分的结果。
  if (!rangeHasHref(tr.doc, from, end, href)) return 'unsupported'
  if (!tr.docChanged) return true
  try { validateRichDoc(tr.doc.toJSON()) } catch { return 'unsupported' }
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

/** 去掉选区上的链接。光标收起时先扩到整段链接。位置已经失效时返回 false，不抛错。 */
export function removeEditorLink(state: EditorState, dispatch: Dispatch, range: { from: number; to: number }): boolean {
  const link = state.schema.marks.link
  if (!link) return false
  let { from, to } = range
  const size = state.doc.content.size
  if (from < 0 || to < from || from > size || to > size) return false
  if (from === to) {
    const found = getMarkRange(state.doc.resolve(from), link)
    if (!found) return false
    from = found.from
    to = found.to
  }
  if (from >= to || from < 0 || to > size || !state.doc.rangeHasMark(from, to, link)) return false
  if (!dispatch) return true
  const tr = state.tr.removeMark(from, to, link)
  if (!tr.docChanged) return false
  dispatch(tr.setSelection(TextSelection.create(tr.doc, from, to)).scrollIntoView())
  return true
}

export interface LinkClickProbe {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  editable: boolean
  href: string | null
  attachment: boolean
}

/** 编辑时单击只落光标；只读或按住主修饰键才打开。附件卡片仍走原来的预览。 */
export function linkClickAction(input: LinkClickProbe): 'ignore' | 'open' | 'place-caret' {
  if (input.button !== 0 || input.attachment || !input.href) return 'ignore'
  if (!input.editable || input.metaKey || input.ctrlKey) return openableLinkHref(input.href) ? 'open' : 'ignore'
  return 'place-caret'
}
