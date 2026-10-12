import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Editor, type JSONContent } from '@tiptap/core'
import { history } from '@tiptap/pm/history'
import { TextSelection } from '@tiptap/pm/state'
import { createJotExtensions, refreshTaskCheckboxLabels, taskCheckboxLabel } from '../src/client/editor-extensions.js'
import { moveListItem, tidyCompletedTasks, toggleTaskAtSelection } from '../src/client/list-commands.js'
import { validateRichDoc } from '../src/model.js'

const text = (value: string) => ({ type: 'text', text: value })
const paragraph = (value?: string) => ({ type: 'paragraph', ...(value ? { content: [text(value)] } : {}) })
const task = (value: string, checked = false, nested?: JSONContent) => ({ type: 'taskItem', attrs: { checked },
  content: [paragraph(value), ...(nested ? [nested] : [])] })
const bullet = (value: string) => ({ type: 'listItem', content: [paragraph(value)] })
function create(content: JSONContent[], locale: 'zh' | 'en' = 'zh') {
  const editor = new Editor({ element: null, extensions: createJotExtensions({ locale: () => locale }), content: { type: 'doc', content } })
  editor.registerPlugin(history())
  return editor
}
/** Put the caret inside the first text node containing `needle`, `offset` characters in. */
function caret(editor: Editor, needle: string, offset = 1) {
  let found = -1
  editor.state.doc.descendants((node, position) => {
    if (found < 0 && node.isText && node.text!.includes(needle)) found = position + node.text!.indexOf(needle) + offset
  })
  assert.ok(found >= 0, `missing ${needle}`)
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, found)))
}
const mac = /Mac|iP(hone|[oa]d)/.test(globalThis.navigator?.platform ?? '')
/** Run the editor's keymap plugins in priority order, as ProseMirror does for a real keydown. */
function press(editor: Editor, key: string, options: { mod?: boolean; alt?: boolean; shift?: boolean; keyCode?: number } = {}) {
  const event = { key, keyCode: options.keyCode ?? 0, code: '', altKey: Boolean(options.alt), shiftKey: Boolean(options.shift),
    metaKey: Boolean(options.mod) && mac, ctrlKey: Boolean(options.mod) && !mac, isComposing: false,
    preventDefault() {}, stopPropagation() {} } as unknown as KeyboardEvent
  // A headless editor has no mounted view, so its plugin list lives on the extension manager.
  return editor.extensionManager.plugins.some(plugin => plugin.props.handleKeyDown?.call(plugin, editor.view, event) === true)
}
const tasks = (editor: Editor) => {
  const result: Array<[string, boolean]> = []
  editor.state.doc.descendants(node => { if (node.type.name === 'taskItem') result.push([node.firstChild!.textContent, node.attrs.checked as boolean]) })
  return result
}
const items = (editor: Editor) => {
  const result: string[] = []
  editor.state.doc.descendants(node => { if (node.type.name === 'listItem' || node.type.name === 'taskItem') result.push(node.firstChild!.textContent) })
  return result
}

test('to-do checkbox labels name the item in the interface language', t => {
  assert.equal(taskCheckboxLabel(' 买牛奶 ', 'zh'), '待办：买牛奶')
  assert.equal(taskCheckboxLabel('', 'zh'), '空白待办')
  assert.equal(taskCheckboxLabel('Buy milk', 'en'), 'To-do: Buy milk')
  assert.equal(taskCheckboxLabel('  ', 'en'), 'Empty to-do')
  let locale: 'zh' | 'en' = 'zh'
  const editor = new Editor({ element: null, extensions: createJotExtensions({ locale: () => locale }),
    content: { type: 'doc', content: [{ type: 'taskList', content: [task('整理目标')] }] } })
  t.after(() => editor.destroy())
  const option = editor.extensionManager.extensions.find(extension => extension.name === 'taskItem')!.options as {
    a11y: { checkboxLabel: (node: unknown, checked: boolean) => string }
  }
  const node = editor.state.doc.firstChild!.firstChild!
  assert.equal(option.a11y.checkboxLabel(node, false), '待办：整理目标')
  locale = 'en'
  assert.equal(option.a11y.checkboxLabel(node, true), 'To-do: 整理目标')
})

test('retained checkbox NodeViews refresh their locale without changing content, selection or history', t => {
  const editor = create([{ type: 'taskList', content: [
    task('Review', true, { type: 'taskList', content: [task('Nested'), task('')] }),
    task(''),
  ] }])
  t.after(() => editor.destroy())
  caret(editor, 'Nested')
  const original = editor.getJSON()
  const selection = editor.state.selection.toJSON()
  const state = editor.state
  let transactions = 0
  editor.on('transaction', () => { transactions++ })
  // The actual schema supplies positions/text; this tiny DOM fixture retains
  // the same NodeViews and exposes only their own checkbox and hidden label.
  const views = new Map<number, {
    nodeType: number
    input: { attributes: Map<string, string>; setAttribute(name: string, value: string): void }
    hidden: { textContent: string; ariaHidden: string }
    querySelector(selector: string): unknown
  }>()
  const texts: string[] = []
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'taskItem') return
    texts.push(node.textContent)
    const attributes = new Map<string, string>()
    const input = { attributes, setAttribute: (name: string, value: string) => { attributes.set(name, value) } }
    const hidden = { textContent: '', ariaHidden: 'true' }
    views.set(position, { nodeType: 1, input, hidden, querySelector: selector => {
      if (selector === ':scope > label > input[type="checkbox"]') return input
      if (selector === ':scope > label > span') return hidden
      assert.fail(`unexpected selector: ${selector}`)
    } })
  })
  const retained = [...views.values()]
  const surface = { state: editor.state, view: { nodeDOM: (position: number) => views.get(position) ?? null } } as unknown as Pick<Editor, 'state' | 'view'>
  refreshTaskCheckboxLabels(surface, 'zh')
  assert.deepEqual(retained.map(view => view.input.attributes.get('aria-label')), texts.map(text => taskCheckboxLabel(text, 'zh')))
  refreshTaskCheckboxLabels(surface, 'en')
  const expected = texts.map(text => taskCheckboxLabel(text, 'en'))
  assert.deepEqual(retained.map(view => view.input.attributes.get('aria-label')), expected)
  assert.deepEqual(retained.map(view => view.hidden.textContent), expected)
  assert.ok(retained.every(view => view.hidden.ariaHidden === 'true'))
  assert.deepEqual([...views.values()], retained, 'the original NodeViews remain mounted')
  assert.equal(editor.state, state, 'no transaction or history entry is created')
  assert.deepEqual(editor.getJSON(), original)
  assert.deepEqual(editor.state.selection.toJSON(), selection)
  assert.equal(transactions, 0)
})

test('heading keys stop at level 3 while stored H4–H6 still render and persist', t => {
  const editor = create([paragraph('标题候选'), { type: 'heading', attrs: { level: 5 }, content: [text('旧的五级标题')] }])
  t.after(() => editor.destroy())
  caret(editor, '标题候选')
  assert.equal(press(editor, '4', { mod: true, alt: true, keyCode: 52 }), true, 'the key is consumed rather than inserting text')
  assert.equal(editor.state.doc.firstChild!.type.name, 'paragraph')
  assert.equal(press(editor, '2', { mod: true, alt: true, keyCode: 50 }), true)
  assert.equal(editor.state.doc.firstChild!.attrs.level, 2)
  assert.deepEqual(validateRichDoc(editor.getJSON()).content[1]!.attrs, { level: 5 })
})

test('Mod+Enter toggles only the to-do holding the caret, including nested to-dos', t => {
  const editor = create([{ type: 'taskList', content: [task('外层', false, { type: 'taskList', content: [task('内层')] }), task('第二项', true)] },
    paragraph('普通段落')])
  t.after(() => editor.destroy())
  caret(editor, '内层')
  assert.equal(press(editor, 'Enter', { mod: true, keyCode: 13 }), true)
  assert.deepEqual(tasks(editor), [['外层', false], ['内层', true], ['第二项', true]])
  caret(editor, '第二项')
  assert.equal(toggleTaskAtSelection(editor.state, editor.view.dispatch), true)
  assert.deepEqual(tasks(editor), [['外层', false], ['内层', true], ['第二项', false]])
  caret(editor, '普通段落')
  assert.equal(toggleTaskAtSelection(editor.state), false, 'outside a to-do the key keeps its default meaning')
  validateRichDoc(editor.getJSON())
})

test('Alt+Shift+Up/Down reorders list items and to-dos, keeping the caret and checked state', t => {
  const editor = create([{ type: 'taskList', content: [task('一', true), task('二'), task('三')] },
    { type: 'bulletList', content: [bullet('甲'), bullet('乙')] }])
  t.after(() => editor.destroy())
  caret(editor, '三', 1)
  assert.equal(press(editor, 'ArrowUp', { alt: true, shift: true, keyCode: 38 }), true)
  assert.deepEqual(tasks(editor), [['一', true], ['三', false], ['二', false]])
  assert.equal(editor.state.selection.$from.parent.textContent, '三', 'the caret moves with the item')
  assert.equal(moveListItem('up')(editor.state, editor.view.dispatch), true)
  assert.deepEqual(tasks(editor), [['三', false], ['一', true], ['二', false]])
  assert.equal(moveListItem('up')(editor.state, editor.view.dispatch), false, 'the first item stays put')
  caret(editor, '甲')
  assert.equal(press(editor, 'ArrowDown', { alt: true, shift: true, keyCode: 40 }), true)
  assert.deepEqual(items(editor).slice(3), ['乙', '甲'])
  assert.equal(moveListItem('down')(editor.state), false, 'the last item stays put')
  validateRichDoc(editor.getJSON())
})

test('moving a nested item stays inside its own list, and a selection across items moves nothing', t => {
  const editor = create([{ type: 'bulletList', content: [
    { type: 'listItem', content: [paragraph('父一'), { type: 'bulletList', content: [bullet('子一'), bullet('子二')] }] },
    bullet('父二'),
  ] }])
  t.after(() => editor.destroy())
  caret(editor, '子二')
  assert.equal(moveListItem('up')(editor.state, editor.view.dispatch), true)
  assert.deepEqual(items(editor), ['父一', '子二', '子一', '父二'])
  assert.equal(moveListItem('up')(editor.state), false, 'a nested first item does not jump to the parent level')
  let from = -1, to = -1
  editor.state.doc.descendants((node, position) => {
    if (node.isText && node.text === '父一') from = position + 1
    if (node.isText && node.text === '父二') to = position + 1
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)))
  assert.equal(moveListItem('down')(editor.state), false)
})

test('tidy moves completed to-dos to the bottom of the current list, keeps relative order, and undoes', t => {
  const nested = { type: 'taskList', content: [task('子项', true)] }
  const editor = create([{ type: 'taskList', content: [
    task('已完成甲', true),
    task('未完成甲'),
    task('已完成乙', true, nested),
    task('未完成乙'),
  ] }, { type: 'taskList', content: [task('另一张清单', true), task('留在原处')] }])
  t.after(() => editor.destroy())
  caret(editor, '未完成甲')
  assert.equal(tidyCompletedTasks(editor.state), true)
  assert.equal(tidyCompletedTasks(editor.state, editor.view.dispatch), true)
  assert.deepEqual(tasks(editor).slice(0, 5), [
    ['未完成甲', false], ['未完成乙', false], ['已完成甲', true], ['已完成乙', true], ['子项', true],
  ])
  assert.equal(editor.state.selection.$from.parent.textContent, '未完成甲')
  assert.deepEqual(tasks(editor).slice(5), [['另一张清单', true], ['留在原处', false]], 'a different checklist is left alone')
  const saved = validateRichDoc(editor.getJSON())
  assert.equal(editor.commands.undo(), true)
  assert.equal(editor.state.doc.firstChild!.firstChild!.textContent, '已完成甲')
  assert.notDeepEqual(editor.getJSON(), saved)
})

test('Alt+Shift+Left/Right resizes the current column and is consumed at the limits', t => {
  const editor = create([{ type: 'table', content: [{ type: 'tableRow', content: [
    { type: 'tableCell', attrs: { colwidth: [120] }, content: [paragraph('左')] },
    { type: 'tableCell', attrs: { colwidth: [140] }, content: [paragraph('右')] },
  ] }] }, paragraph('正文')])
  t.after(() => editor.destroy())
  const width = () => editor.state.doc.firstChild!.firstChild!.firstChild!.attrs.colwidth as number[]
  caret(editor, '左')
  assert.equal(press(editor, 'ArrowRight', { alt: true, keyCode: 39 }), false, 'Alt+Right stays available for word movement and browser Back')
  assert.equal(press(editor, 'ArrowRight', { alt: true, shift: true, keyCode: 39 }), true)
  assert.deepEqual(width(), [136])
  assert.equal(press(editor, 'ArrowLeft', { alt: true, shift: true, keyCode: 37 }), true)
  assert.deepEqual(width(), [120])
  assert.equal(editor.commands.undo(), true)
  assert.deepEqual(width(), [136])
  const setWidth = (value: number) => {
    let pos = -1
    editor.state.doc.descendants((node, position) => { if (pos < 0 && node.type.name === 'tableCell') pos = position })
    const cell = editor.state.doc.nodeAt(pos)!
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, { ...cell.attrs, colwidth: [value] }))
  }
  setWidth(88)
  caret(editor, '左')
  assert.equal(press(editor, 'ArrowLeft', { alt: true, shift: true, keyCode: 37 }), true)
  assert.deepEqual(width(), [88])
  setWidth(5000)
  caret(editor, '左')
  assert.equal(press(editor, 'ArrowRight', { alt: true, shift: true, keyCode: 39 }), true)
  assert.deepEqual(width(), [5000])
  editor.setEditable(false)
  assert.equal(press(editor, 'ArrowRight', { alt: true, shift: true, keyCode: 39 }), false)
  editor.setEditable(true)
  caret(editor, '正文')
  assert.equal(press(editor, 'ArrowRight', { alt: true, shift: true, keyCode: 39 }), false)
  validateRichDoc(editor.getJSON())
})

test('tidy is a separate undo step from typing just before and just after it', t => {
  const editor = create([{ type: 'taskList', content: [task('已完成', true), task('未完成')] }])
  t.after(() => editor.destroy())
  caret(editor, '未完成', 1)
  editor.view.dispatch(editor.state.tr.insertText('甲'))
  assert.equal(tidyCompletedTasks(editor.state, editor.view.dispatch), true)
  assert.equal(editor.state.doc.firstChild!.firstChild!.textContent, '未甲完成')
  editor.view.dispatch(editor.state.tr.insertText('乙'))
  assert.equal(editor.state.doc.textContent.includes('乙'), true)
  assert.equal(editor.commands.undo(), true)
  assert.equal(editor.state.doc.textContent.includes('乙'), false)
  assert.equal(editor.state.doc.firstChild!.firstChild!.textContent, '未甲完成')
  assert.equal(editor.commands.undo(), true)
  assert.equal(editor.state.doc.firstChild!.firstChild!.textContent, '已完成')
  assert.equal(editor.state.doc.textContent.includes('甲'), true)
  assert.equal(editor.commands.undo(), true)
  assert.equal(editor.state.doc.textContent.includes('甲'), false)
})

test('tidy does nothing when completed items are already last, so it adds no undo step', t => {
  const editor = create([{ type: 'taskList', content: [task('未完成'), task('已完成', true), task('也完成', true)] }])
  t.after(() => editor.destroy())
  caret(editor, '未完成')
  const before = editor.getJSON()
  assert.equal(tidyCompletedTasks(editor.state, editor.view.dispatch), false)
  caret(editor, '已完成')
  assert.equal(tidyCompletedTasks(editor.state), false, 'a list of only trailing completed items is already tidy')
  const done = create([{ type: 'taskList', content: [task('一', true), task('二', true)] }, paragraph('普通段落')])
  t.after(() => done.destroy())
  caret(done, '一')
  assert.equal(tidyCompletedTasks(done.state), false)
  caret(done, '普通段落')
  assert.equal(tidyCompletedTasks(done.state), false, 'outside a checklist there is nothing to tidy')
  assert.deepEqual(editor.getJSON(), before)
})
