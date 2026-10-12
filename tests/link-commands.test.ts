import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Editor, type JSONContent } from '@tiptap/core'
import { closeHistory, history, undoDepth } from '@tiptap/pm/history'
import { Fragment, Slice } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { createJotExtensions } from '../src/client/editor-extensions.js'
import { linkPopoverFocusKey, linkPopoverInitialFocus } from '../src/client/LinkPopover.js'
import { applyEditorLink, blockCredentialLinkEvent, handleLinkClick, linkApplyMessage, linkClickAction, linkMarkHref, linkSelection, normalizeLinkHref, openedLinkRange, openableLinkHref, openLinkHref, removeEditorLink } from '../src/client/link-commands.js'
import { MAX_TEXT_LENGTH, validateRichDoc } from '../src/model.js'

const text = (value: string, marks?: JSONContent['marks']) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const paragraph = (...content: JSONContent[]) => ({ type: 'paragraph', ...(content.length ? { content } : {}) })
function create(content: JSONContent[]) {
  const editor = new Editor({ element: null, extensions: createJotExtensions(), content: { type: 'doc', content } })
  // 无头编辑器不会挂载，StarterKit 的撤销插件要在这里补上。
  editor.registerPlugin(history())
  return editor
}
/** 自动链接和粘贴规则挂在插件上；无头编辑器要先登记才会在输入时运行。 */
function mountPlugins(editor: Editor) {
  const names = new Set(editor.state.plugins.map(plugin => (plugin.spec.key as { key?: string } | undefined)?.key))
  for (const plugin of editor.extensionManager.plugins) {
    const name = (plugin.spec.key as { key?: string } | undefined)?.key
    if (name && names.has(name)) continue
    editor.registerPlugin(plugin)
    if (name) names.add(name)
  }
}
function rangeOf(editor: Editor, needle: string) {
  let from = -1
  editor.state.doc.descendants((node, position) => {
    if (from < 0 && node.isText && node.text!.includes(needle)) from = position + node.text!.indexOf(needle)
  })
  assert.ok(from >= 0, `missing ${needle}`)
  const to = from + needle.length
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)))
  return { from, to }
}
function linkAt(editor: Editor, needle: string) {
  let href: string | null = null
  let marks: string[] = []
  editor.state.doc.descendants(node => {
    if (node.isText && node.text!.includes(needle)) {
      marks = node.marks.map(mark => mark.type.name)
      href = String(node.marks.find(mark => mark.type.name === 'link')?.attrs.href ?? '')
    }
  })
  return { href, marks }
}

test('link addresses keep the schemes notes can store and reject the rest', () => {
  assert.equal(normalizeLinkHref('  https://example.com/a  '), 'https://example.com/a')
  assert.equal(normalizeLinkHref('example.com/docs'), 'https://example.com/docs')
  assert.equal(normalizeLinkHref('localhost:4178/notes'), 'https://localhost:4178/notes')
  assert.equal(normalizeLinkHref('example.com:8080/a'), 'https://example.com:8080/a')
  assert.equal(normalizeLinkHref('mailto:a@b.example'), 'mailto:a@b.example')
  assert.equal(normalizeLinkHref('tel:+1-555'), 'tel:+1-555')
  assert.equal(normalizeLinkHref('#section'), '#section')
  assert.equal(normalizeLinkHref('https://foo'), 'https://foo')
  for (const raw of ['', '   ', 'hello', 'mailto:', 'tel:', '#', 'javascript:alert(1)', 'data:text/html,hi',
    'ftp://example.com', '//example.org', 'http://bad host', 'https://user:pass@example.com/a', 'https://user@example.com/a',
    'https://:secret@example.com', `https://example.com/${'a'.repeat(2100)}`]) {
    assert.equal(normalizeLinkHref(raw), null, raw)
  }
  assert.equal(openableLinkHref('#section'), null)
  assert.equal(openableLinkHref('example.com'), 'https://example.com')
  assert.equal(openableLinkHref('https://user:pass@example.com'), null)
  // 已经写进笔记的账号口令地址仍要能加载；拒绝的是新建和打开。
  const stored = validateRichDoc({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'secret', marks: [{ type: 'link', attrs: { href: 'https://user:pass@example.com/a' } }] },
  ] }] })
  assert.equal(stored.content[0]?.content?.[0]?.marks?.[0]?.attrs?.href, 'https://user:pass@example.com/a')
})

test('applying a link stores a savable mark, keeps marks that cover the range, and undoes in one step', t => {
  const editor = create([paragraph(text('hello '), text('world', [{ type: 'bold' }]))])
  t.after(() => editor.destroy())
  const link = editor.extensionManager.extensions.find(extension => extension.name === 'link')!
  assert.equal(link.options.openOnClick, false)
  assert.equal(link.options.autolink, true)
  assert.equal(link.options.linkOnPaste, true)
  const { from, to } = rangeOf(editor, 'world')
  const before = undoDepth(editor.state)
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    from, to, original: 'world', text: 'world', href: 'example.com',
  }), true)
  const stored = linkAt(editor, 'world')
  assert.equal(stored.href, 'https://example.com')
  assert.deepEqual(stored.marks.slice().sort(), ['bold', 'link'])
  validateRichDoc(editor.getJSON())
  assert.equal(undoDepth(editor.state), before + 1)
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    from: linkSelection(editor.state).from, to: linkSelection(editor.state).to,
    original: 'world', text: 'world', href: 'https://example.com',
  }), true)
  assert.equal(undoDepth(editor.state), before + 1, 'saving the same address adds no undo step')
  assert.equal(editor.commands.undo(), true)
  assert.equal(linkAt(editor, 'world').href, '')
})

test('editing link text replaces the range, a collapsed caret covers the whole link, and remove clears it', t => {
  const editor = create([paragraph(text('see '), text('docs', [{ type: 'link', attrs: { href: 'https://example.com/docs' } }]))])
  t.after(() => editor.destroy())
  let caret = -1
  editor.state.doc.descendants((node, position) => {
    if (caret < 0 && node.isText && node.text === 'docs') caret = position + 2
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, caret)))
  const selected = linkSelection(editor.state)
  assert.equal(selected.text, 'docs')
  assert.equal(selected.href, 'https://example.com/docs')
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    ...selected, original: selected.text, text: 'the docs', href: 'https://example.com/guide',
  }), true)
  assert.equal(editor.state.doc.textContent, 'see the docs')
  assert.deepEqual(linkAt(editor, 'the docs'), { href: 'https://example.com/guide', marks: ['link'] })
  editor.view.dispatch(closeHistory(editor.state.tr))
  const again = linkSelection(editor.state)
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, again), true)
  assert.equal(linkAt(editor, 'the docs').marks.includes('link'), false)
  assert.equal(editor.commands.undo(), true)
  assert.equal(linkAt(editor, 'the docs').href, 'https://example.com/guide')
})

test('a link is refused in a code block, across blocks when the text changes, and when the note moved', t => {
  const editor = create([{ type: 'codeBlock', content: [text('const x = 1')] }, paragraph(text('one')), paragraph(text('two'))])
  t.after(() => editor.destroy())
  const code = rangeOf(editor, 'const')
  assert.equal(applyEditorLink(editor.state, undefined, { ...code, original: 'const', text: 'const', href: 'https://example.com' }), 'unsupported')
  let from = -1
  let to = -1
  editor.state.doc.descendants((node, position) => {
    if (node.isText && node.text === 'one') from = position
    if (node.isText && node.text === 'two') to = position + node.text!.length
  })
  assert.equal(applyEditorLink(editor.state, undefined, { from, to, original: 'one\ntwo', text: 'changed', href: 'https://example.com' }), 'unsupported')
  assert.equal(applyEditorLink(editor.state, undefined, { from, to, original: 'stale', text: 'one\ntwo', href: 'https://example.com' }), 'stale')
  assert.equal(applyEditorLink(editor.state, undefined, { from, to, original: 'one\ntwo', text: 'one\ntwo', href: 'not a url' }), 'invalid-href')
  assert.equal(applyEditorLink(editor.state, undefined, { from, to, original: 'one\ntwo', text: '   ', href: 'https://example.com' }), 'empty-text')
  assert.match(linkApplyMessage('invalid-href', 'zh'), /http/)
  assert.match(linkApplyMessage('empty-text', 'en'), /link text/)
})

test('an unchanged selection keeps its whitespace and partial marks', t => {
  const editor = create([paragraph(text(' '), text('A', [{ type: 'bold' }]), text('B  '))])
  t.after(() => editor.destroy())
  let from = -1
  let to = -1
  editor.state.doc.descendants((node, position) => {
    if (!node.isText) return
    if (from < 0) from = position
    to = position + node.text!.length
  })
  assert.equal(editor.state.doc.textBetween(from, to, ''), ' AB  ')
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    from, to, original: ' AB  ', text: ' AB  ', href: 'https://example.com',
  }), true)
  assert.equal(editor.state.doc.textContent, ' AB  ')
  const marks = new Map<string, string[]>()
  editor.state.doc.descendants(node => {
    if (node.isText) marks.set(node.text!, node.marks.map(mark => mark.type.name).sort())
  })
  assert.deepEqual(marks.get(' '), ['link'])
  assert.deepEqual(marks.get('A'), ['bold', 'link'])
  assert.deepEqual(marks.get('B  '), ['link'])
  const spaced = create([paragraph(text('A  B'))])
  t.after(() => spaced.destroy())
  const range = rangeOf(spaced, 'A  B')
  assert.equal(applyEditorLink(spaced.state, spaced.view.dispatch, {
    ...range, original: 'A  B', text: 'A  B', href: 'https://example.com/spaced',
  }), true)
  assert.equal(spaced.state.doc.textContent, 'A  B')
  assert.equal(linkAt(spaced, 'A  B').href, 'https://example.com/spaced')
})

test('inline code is not reported as linked, and a stale remove does not throw', t => {
  const editor = create([paragraph(text('const', [{ type: 'code' }]), text(' value'))])
  t.after(() => editor.destroy())
  const code = rangeOf(editor, 'const')
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    ...code, original: 'const', text: 'const', href: 'https://example.com',
  }), 'unsupported')
  assert.deepEqual(linkAt(editor, 'const').marks, ['code'])
  assert.equal(editor.state.doc.textContent, 'const value')
  const size = editor.state.doc.content.size
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, { from: -1, to: 0 }), false)
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, { from: size + 4, to: size + 4 }), false)
  assert.equal(editor.state.doc.textContent, 'const value')
  assert.equal(linkPopoverInitialFocus({ readOnly: false, text: 'const', canOpen: true }), 'href')
  assert.equal(linkPopoverInitialFocus({ readOnly: false, text: '', canOpen: true }), 'text')
  assert.equal(linkPopoverInitialFocus({ readOnly: true, text: 'const', canOpen: true }), 'open')
  assert.equal(linkPopoverInitialFocus({ readOnly: true, text: 'secret', canOpen: false }), 'dialog')
})

test('typing several characters in a new link does not retarget focus', () => {
  const open = { id: 4, readOnly: false, placed: true }
  const first = linkPopoverFocusKey(open)
  assert.equal(linkPopoverInitialFocus({ readOnly: false, text: '', canOpen: false }), 'text')
  let text = ''
  for (const character of 'hello') {
    text += character
    assert.equal(linkPopoverFocusKey(open), first, text)
    // 若聚焦效果仍依赖文字，打完第一个字就会改去选中网址。
    assert.equal(linkPopoverInitialFocus({ readOnly: false, text, canOpen: false }), 'href')
  }
  assert.equal(text, 'hello')
  assert.equal(linkPopoverFocusKey({ ...open, placed: false }), null)
  assert.notEqual(linkPopoverFocusKey({ ...open, id: 5 }), first)
  assert.notEqual(linkPopoverFocusKey({ ...open, readOnly: true }), first)
})

test('a plain click in an editable note only places the caret; read-only and modified clicks open', () => {
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: true, href: 'https://example.com', attachment: false }), 'place-caret')
  assert.equal(linkClickAction({ button: 0, metaKey: true, ctrlKey: false, editable: true, href: 'example.com', attachment: false }), 'open')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: true, editable: true, href: 'mailto:a@b.example', attachment: false }), 'open')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href: 'tel:1', attachment: false }), 'open')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href: '#section', attachment: false }), 'ignore')
  assert.equal(linkClickAction({ button: 2, metaKey: false, ctrlKey: false, editable: false, href: 'https://example.com', attachment: false }), 'ignore')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href: 'https://example.com', attachment: true }), 'ignore')
  const opened: unknown[][] = []
  const previous = globalThis.open
  globalThis.open = ((...args: unknown[]) => { opened.push(args); return null }) as typeof globalThis.open
  try {
    assert.equal(openLinkHref('example.com'), true)
    assert.deepEqual(opened, [['https://example.com', '_blank', 'noopener,noreferrer']])
    assert.equal(openLinkHref('javascript:alert(1)'), false)
    assert.equal(openLinkHref('https://user:pass@example.com'), false)
    assert.equal(opened.length, 1)
  } finally {
    globalThis.open = previous
  }
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href: 'https://user:pass@example.com', attachment: false }), 'block')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: true, href: 'https://user:pass@example.com', attachment: false }), 'block')
  assert.equal(linkClickAction({ button: 2, metaKey: true, ctrlKey: false, editable: false, href: 'https://user@example.com/a', attachment: false }), 'block')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href: 'https://user:pass@example.com', attachment: true }), 'ignore')
  let prevented = 0
  assert.equal(handleLinkClick('block', { preventDefault() { prevented++ } }, () => { throw new Error('blocked links are not opened') }), true)
  assert.equal(handleLinkClick('ignore', { preventDefault() { prevented++ } }, () => {}), false)
  assert.equal(prevented, 1)
})

test('editing link text keeps spaces and inline code', t => {
  const spaced = create([paragraph(text('A  B'))])
  t.after(() => spaced.destroy())
  const range = rangeOf(spaced, 'A  B')
  assert.equal(applyEditorLink(spaced.state, spaced.view.dispatch, {
    ...range, original: 'A  B', text: 'A  C', href: 'https://example.com/spaced',
  }), true)
  assert.equal(spaced.state.doc.textContent, 'A  C')
  assert.equal(linkAt(spaced, 'A  C').href, 'https://example.com/spaced')
  const mixed = create([paragraph(text('fn', [{ type: 'code' }]), text('()'))])
  t.after(() => mixed.destroy())
  let from = -1
  let to = -1
  mixed.state.doc.descendants((node, position) => {
    if (!node.isText) return
    if (from < 0) from = position
    to = position + node.text!.length
  })
  assert.equal(mixed.state.doc.textBetween(from, to, ''), 'fn()')
  assert.equal(applyEditorLink(mixed.state, mixed.view.dispatch, {
    from, to, original: 'fn()', text: 'fn(x)', href: 'https://example.com/fn',
  }), true)
  assert.equal(mixed.state.doc.textContent, 'fn(x)')
  const pieces = new Map<string, string[]>()
  mixed.state.doc.descendants(node => {
    if (node.isText) pieces.set(node.text!, node.marks.map(mark => mark.type.name).sort())
  })
  assert.deepEqual(pieces.get('fn'), ['code'])
  assert.deepEqual(pieces.get('(x)'), ['link'])
  const codeOnly = create([paragraph(text('fn', [{ type: 'code' }]))])
  t.after(() => codeOnly.destroy())
  const code = rangeOf(codeOnly, 'fn')
  const before = codeOnly.getJSON()
  assert.equal(applyEditorLink(codeOnly.state, codeOnly.view.dispatch, {
    ...code, original: 'fn', text: 'fnx', href: 'https://example.com/fn',
  }), 'unsupported')
  assert.deepEqual(codeOnly.getJSON(), before)
})

test('a stale remove does not clear a different link now at those positions', t => {
  const editor = create([paragraph(
    text('one', [{ type: 'link', attrs: { href: 'https://one.example' } }]),
    text('two', [{ type: 'link', attrs: { href: 'https://two.example' } }]),
  )])
  t.after(() => editor.destroy())
  const first = rangeOf(editor, 'one')
  editor.commands.setContent({ type: 'doc', content: [paragraph(
    text('two', [{ type: 'link', attrs: { href: 'https://two.example' } }]),
  )] })
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, {
    from: first.from, to: first.to, href: 'https://one.example', original: 'one',
  }), false)
  assert.equal(linkAt(editor, 'two').href, 'https://two.example')
  const current = rangeOf(editor, 'two')
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, {
    ...current, href: 'https://two.example', original: 'two',
  }), true)
  assert.equal(linkAt(editor, 'two').marks.includes('link'), false)
})

test('typing or pasting a credential address does not create a link', t => {
  const editor = create([paragraph(text('go'))])
  mountPlugins(editor)
  t.after(() => editor.destroy())
  let end = 1
  editor.state.doc.descendants((node, position) => {
    if (node.isText && node.text === 'go') end = position + node.text.length
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end))
    .insertText(' https://user:pass@example.com '))
  assert.match(editor.state.doc.textContent, /user:pass@example\.com/)
  assert.equal(linkAt(editor, 'user:pass').href, '')
  editor.view.dispatch(editor.state.tr.insertText('https://example.com '))
  assert.equal(linkAt(editor, 'https://example.com').href, 'https://example.com')
  const label = rangeOf(editor, 'user:pass@example.com')
  assert.equal(editor.chain().setTextSelection(label).setLink({ href: 'https://user:pass@example.com' }).run(), false)
  assert.equal(linkAt(editor, 'user:pass').href, '')
  const pasted = create([paragraph(text('replace-me'))])
  mountPlugins(pasted)
  t.after(() => pasted.destroy())
  rangeOf(pasted, 'replace-me')
  const paste = (slice: Slice) => pasted.extensionManager.plugins.some(plugin =>
    plugin.props.handlePaste?.call(plugin, pasted.view, { preventDefault() {} } as ClipboardEvent, slice) === true)
  const slice = new Slice(Fragment.from(pasted.schema.text('https://user:pass@example.com')), 0, 0)
  assert.equal(paste(slice), false)
  assert.equal(pasted.state.doc.textContent, 'replace-me')
  assert.equal(linkAt(pasted, 'replace-me').href, '')
  const allowed = new Slice(Fragment.from(pasted.schema.text('https://example.com/docs')), 0, 0)
  assert.equal(paste(allowed), true)
  assert.equal(pasted.state.doc.textContent, 'replace-me')
  assert.equal(linkAt(pasted, 'replace-me').href, 'https://example.com/docs')
  const stored = create([paragraph(text('secret', [{ type: 'link', attrs: { href: 'https://user:pass@example.com/a' } }]))])
  t.after(() => stored.destroy())
  let pos = -1
  stored.state.doc.descendants((node, position) => {
    if (pos < 0 && node.isText && node.text === 'secret') pos = position + 1
  })
  const href = linkMarkHref(stored.state, pos)
  assert.equal(href, 'https://user:pass@example.com/a')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: false, href, attachment: false }), 'block')
  assert.equal(linkClickAction({ button: 0, metaKey: false, ctrlKey: false, editable: true, href, attachment: false }), 'block')
})

function linkDomAttrs(editor: Editor, href: string): Record<string, unknown> {
  const type = editor.schema.marks.link!
  const spec = type.spec.toDOM?.(type.create({ href }), true)
  assert.ok(Array.isArray(spec))
  const attrs = spec[1]
  assert.equal(typeof attrs, 'object')
  assert.ok(attrs && !Array.isArray(attrs))
  return attrs as Record<string, unknown>
}

test('a credential link is rendered without an href, and click and middle-click are cancelled', t => {
  const editor = create([paragraph(text('secret', [{ type: 'link', attrs: { href: 'https://user:pass@example.com/a' } }]))])
  t.after(() => editor.destroy())
  const blocked = linkDomAttrs(editor, 'https://user:pass@example.com/a')
  assert.equal(Object.hasOwn(blocked, 'href'), false)
  assert.equal(linkDomAttrs(editor, 'https://example.com/docs').href, 'https://example.com/docs')
  let prevented = 0
  const prevent = () => { prevented++ }
  assert.equal(blockCredentialLinkEvent({ type: 'click', preventDefault: prevent }, 'https://user:pass@example.com/a', false), true)
  assert.equal(blockCredentialLinkEvent({ type: 'auxclick', preventDefault: prevent }, 'https://user@example.com/a', false), true)
  assert.equal(prevented, 2)
  assert.equal(blockCredentialLinkEvent({ type: 'click', preventDefault: prevent }, 'https://example.com', false), false)
  assert.equal(blockCredentialLinkEvent({ type: 'auxclick', preventDefault: prevent }, 'https://example.com', false), false)
  assert.equal(blockCredentialLinkEvent({ type: 'mousedown', preventDefault: prevent }, 'https://user:pass@example.com/a', false), false)
  assert.equal(blockCredentialLinkEvent({ type: 'auxclick', preventDefault: prevent }, 'https://user:pass@example.com/a', true), false)
  assert.equal(prevented, 2)
})

test('the boundary between two links resolves to the link on the right', t => {
  const editor = create([paragraph(
    text('left', [{ type: 'link', attrs: { href: 'https://left.example' } }]),
    text('right', [{ type: 'link', attrs: { href: 'https://right.example' } }]),
  )])
  t.after(() => editor.destroy())
  let boundary = -1
  editor.state.doc.descendants((node, position) => {
    if (boundary < 0 && node.isText && node.text === 'right') boundary = position
  })
  assert.ok(boundary > 0)
  assert.equal(linkMarkHref(editor.state, boundary), 'https://right.example')
  assert.equal(linkMarkHref(editor.state, boundary + 1), 'https://right.example')
  assert.equal(linkMarkHref(editor.state, boundary - 1), 'https://left.example')
})

test('inserting a link at the caret keeps stored marks such as bold', t => {
  const editor = create([paragraph()])
  t.after(() => editor.destroy())
  const pos = editor.state.selection.from
  assert.equal(editor.state.selection.empty, true)
  editor.view.dispatch(editor.state.tr.setStoredMarks([editor.schema.marks.bold!.create()]))
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, {
    from: pos, to: pos, original: '', text: 'docs', href: 'https://example.com/docs',
  }), true)
  assert.equal(editor.state.doc.textContent, 'docs')
  assert.deepEqual(linkAt(editor, 'docs').marks.slice().sort(), ['bold', 'link'])
  const coded = create([paragraph()])
  t.after(() => coded.destroy())
  const caret = coded.state.selection.from
  coded.view.dispatch(coded.state.tr.setStoredMarks([coded.schema.marks.code!.create()]))
  const before = coded.getJSON()
  assert.equal(applyEditorLink(coded.state, coded.view.dispatch, {
    from: caret, to: caret, original: '', text: 'fn', href: 'https://example.com/fn',
  }), 'unsupported')
  assert.deepEqual(coded.getJSON(), before)
})

test('a link edit that exceeds the note length is unsupported on a dry run and on apply', t => {
  const editor = create([paragraph(text('hi'))])
  t.after(() => editor.destroy())
  const { from, to } = rangeOf(editor, 'hi')
  const huge = 'x'.repeat(MAX_TEXT_LENGTH + 1)
  const before = editor.getJSON()
  const input = { from, to, original: 'hi', text: huge, href: 'https://example.com' }
  assert.equal(applyEditorLink(editor.state, undefined, input), 'unsupported')
  assert.deepEqual(editor.getJSON(), before)
  assert.equal(applyEditorLink(editor.state, editor.view.dispatch, input), 'unsupported')
  assert.deepEqual(editor.getJSON(), before)
  assert.equal(applyEditorLink(editor.state, undefined, {
    from, to, original: 'hi', text: 'hey', href: 'https://example.com',
  }), true)
  assert.deepEqual(editor.getJSON(), before)
})

test('remove uses the address from when the popover opened, not the address typed afterwards', t => {
  const editor = create([paragraph(text('docs', [{ type: 'link', attrs: { href: 'https://example.com/docs' } }]))])
  t.after(() => editor.destroy())
  const range = rangeOf(editor, 'docs')
  const opened = { from: range.from, to: range.to, original: 'docs', originalHref: 'https://example.com/docs' as string | null }
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, {
    from: opened.from, to: opened.to, original: opened.original, href: 'https://edited.example',
  }), false)
  assert.equal(linkAt(editor, 'docs').href, 'https://example.com/docs')
  assert.deepEqual(openedLinkRange({ ...opened, originalHref: opened.originalHref }), {
    from: range.from, to: range.to, original: 'docs', href: 'https://example.com/docs',
  })
  assert.equal(removeEditorLink(editor.state, editor.view.dispatch, openedLinkRange(opened)), true)
  assert.equal(linkAt(editor, 'docs').marks.includes('link'), false)
})
