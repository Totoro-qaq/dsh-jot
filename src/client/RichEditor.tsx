import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Editor } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { closeHistory } from '@tiptap/pm/history'
import { columnResizingPluginKey } from '@tiptap/pm/tables'
import { findMatches, replaceAllMatches, replaceMatch } from './document-find.js'
import { highlightWindow } from './find-highlights.js'
import { editorShortcut, editorShortcutLabel, type EditorShortcut } from './editor-shortcuts.js'
import { createJotExtensions, managedAttachmentUrl } from './editor-extensions.js'
import { syncEditorContent } from './editor-content.js'
import { JotActionIcon, type JotActionIconName } from './icons.js'
import { TableControls } from './TableControls.js'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../model.js'
import type { JotLocale, RichDoc } from './types.js'

export interface RichEditorProps {
  value: RichDoc
  onChange: (content: RichDoc) => void
  onBlur?: () => void
  readOnly?: boolean
  locale?: JotLocale
  onReady?: (actions: RichEditorActions | null) => void
  resolveAttachmentUrl?: (attachmentId: string) => string
}

export interface RichEditorActions {
  /** Native bridges must pass the focused target; input fields never format or undo the body. */
  handleShortcut: (action: EditorShortcut, target?: EventTarget | null) => boolean
  insertImage: (attachmentId: string, alt?: string) => boolean
  insertAttachment: (attachmentId: string, caption?: string) => boolean
  /** Move the caret into the body, for example after Enter in the title. */
  focus: () => void
}

function EditorControlIcon({ name }: { name: 'format' | 'chevron' | 'todo' | 'find' | 'previous' | 'next' | 'close' | 'table' }) {
  const names: Record<typeof name, JotActionIconName> = {
    format: 'format', chevron: 'chevron-down', todo: 'checklist', find: 'search',
    // Matches move up and down through the document, not back and forward.
    previous: 'chevron-up', next: 'chevron-down', close: 'close', table: 'table',
  }
  return <JotActionIcon name={names[name]} size={16} className={`jot-editor-control-icon jot-editor-control-icon--${name}`} />
}

export function RichEditor({ value, onChange, onBlur, readOnly = false, locale = 'zh', onReady, resolveAttachmentUrl }: RichEditorProps) {
  const root = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const instance = useRef<Editor | null>(null)
  const callbacks = useRef({ onChange, onBlur, onReady, resolveAttachmentUrl, readOnly })
  callbacks.current = { onChange, onBlur, onReady, resolveAttachmentUrl, readOnly }
  const shortcutHandler = useRef<RichEditorActions['handleShortcut']>(() => false)
  const composing = useRef(false)
  const lastInput = useRef(JSON.stringify(value))
  const initial = useRef(value)
  const [, render] = useState(0)
  const [formatOpen, setFormatOpen] = useState(false)
  const formatTrigger = useRef<HTMLButtonElement>(null)
  const formatPopover = useRef<HTMLDivElement>(null)
  const [paletteOpen, setPaletteOpen] = useState<'text' | 'highlight' | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replacement, setReplacement] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const findInput = useRef<HTMLInputElement>(null)
  const findState = useRef({ query: '', active: 0 })
  findState.current = { query: findOpen ? query : '', active: activeMatch }
  const findKey = useRef(new PluginKey<DecorationSet>('jot-document-find'))
  const en = locale === 'en'

  useEffect(() => {
    if (!mount.current) return
    const editor = new Editor({
      element: mount.current,
      content: initial.current,
      editable: !readOnly,
      extensions: createJotExtensions({ resolveAttachmentUrl: id => callbacks.current.resolveAttachmentUrl?.(id) ?? managedAttachmentUrl(id) }),
      editorProps: {
        handleKeyDown: (_view, event) => {
          const action = editorShortcut(event)
          if (!action || !shortcutHandler.current(action, event.target)) return false
          event.preventDefault(); event.stopPropagation()
          return true
        },
        attributes: {
          role: 'textbox', 'aria-multiline': 'true',
          'aria-label': en ? 'Note content' : '笔记正文',
          'data-placeholder': en ? 'Start writing…' : '从这里开始记…',
        },
      },
      onUpdate: ({ editor: current, transaction }) => {
        // Plugin normalization appended to a selection or meta transaction, such as
        // Tiptap's trailing paragraph after a final list or table, is not an edit.
        // Emitting it would save and re-date a note merely because it was opened.
        if (!transaction.docChanged) return
        const content = current.getJSON() as RichDoc
        lastInput.current = JSON.stringify(content)
        current.view.dom.setAttribute('data-empty', current.getText().trim() ? 'false' : 'true')
        callbacks.current.onChange(content)
      },
      onTransaction: () => render(version => version + 1),
      onBlur: () => callbacks.current.onBlur?.(),
    })
    editor.registerPlugin(new Plugin<DecorationSet>({
      key: findKey.current,
      state: {
        init: () => DecorationSet.empty,
        apply: (transaction, previous) => {
          if (!transaction.docChanged && !transaction.getMeta(findKey.current)) return previous.map(transaction.mapping, transaction.doc)
          const matches = findMatches(transaction.doc, findState.current.query)
          const window = highlightWindow(matches, findState.current.active)
          return DecorationSet.create(transaction.doc, window.matches.map((match, index) => Decoration.inline(match.from, match.to, {
            class: `jot-document-find-hit${index + window.start === findState.current.active ? ' is-current' : ''}`,
            style: `background:${index + window.start === findState.current.active ? 'var(--jot-find-active,#f0bd55)' : 'var(--jot-find-highlight,#f6e5af)'};color:var(--jot-fg,inherit);border-radius:2px`,
          })))
        },
      },
      props: { decorations: state => findKey.current.getState(state) },
    }))
    instance.current = editor
    const insertAttachment = (type: 'image' | 'attachment', id: string, description = '') => {
      const current = instance.current
      if (!current || callbacks.current.readOnly || !/^[0-9a-f]{32}$/u.test(id) || description.length > 1_000) return false
      // An upload may finish while the user types in a modal; keep that focus.
      return current.commands.insertContent({ type, attrs: { attachmentId: id, [type === 'image' ? 'alt' : 'caption']: description } })
    }
    callbacks.current.onReady?.({ handleShortcut: (action, target) => shortcutHandler.current(action, target),
      insertImage: (id, alt) => insertAttachment('image', id, alt),
      insertAttachment: (id, caption) => insertAttachment('attachment', id, caption),
      focus: () => { instance.current?.commands.focus('start') } })
    editor.view.dom.setAttribute('data-empty', editor.getText().trim() ? 'false' : 'true')
    render(version => version + 1)
    return () => { callbacks.current.onReady?.(null); instance.current = null; editor.destroy() }
  }, [])

  useEffect(() => {
    const editor = instance.current
    const serialized = JSON.stringify(value)
    if (editor && serialized !== lastInput.current) {
      lastInput.current = serialized
      syncEditorContent(editor, value)
      editor.view.dom.setAttribute('data-empty', editor.getText().trim() ? 'false' : 'true')
    }
  }, [value])

  useEffect(() => {
    const editor = instance.current
    if (!editor) return
    // Switching read-only state changes permissions, not the document.
    editor.setEditable(!readOnly, false)
    if (readOnly) editor.view.dispatch(editor.state.tr.setMeta(columnResizingPluginKey, { setHandle: -1, setDragging: null }))
    editor.view.dom.setAttribute('aria-label', en ? 'Note content' : '笔记正文')
    editor.view.dom.setAttribute('data-placeholder', en ? 'Start writing…' : '从这里开始记…')
  }, [readOnly, en])

  const editor = instance.current
  const document = editor?.state.doc
  const matches = useMemo(() => document && findOpen ? findMatches(document, query) : [], [document, findOpen, query])
  const index = matches.length ? Math.min(activeMatch, matches.length - 1) : 0
  useEffect(() => {
    if (activeMatch !== index) setActiveMatch(index)
    instance.current?.view.dispatch(instance.current.state.tr.setMeta(findKey.current, true))
  }, [findOpen, query, activeMatch, matches.length])
  useEffect(() => { if (findOpen) { findInput.current?.focus(); findInput.current?.select() } }, [findOpen])
  // The style popover floats over the document and closes on an outside press.
  useEffect(() => {
    if (!formatOpen) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (formatPopover.current?.contains(target) || formatTrigger.current?.contains(target)) return
      setFormatOpen(false); setPaletteOpen(null)
    }
    const page = root.current?.ownerDocument ?? globalThis.document
    page.addEventListener('pointerdown', outside, true)
    return () => page.removeEventListener('pointerdown', outside, true)
  }, [formatOpen])

  const selectMatch = (next: number) => {
    if (!editor || !matches.length) return
    const active = (next + matches.length) % matches.length
    const match = matches[active]!
    findState.current.active = active
    setActiveMatch(active)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
      .setMeta(findKey.current, true).scrollIntoView())
  }
  const openFind = () => {
    setFindOpen(true)
    setFormatOpen(false)
    if (findOpen) { findInput.current?.focus(); findInput.current?.select() }
  }
  shortcutHandler.current = (action, target = globalThis.document?.activeElement) => {
    const current = instance.current
    if (!current || composing.current || current.view.composing || !target || typeof Node === 'undefined' || !(target instanceof Node)) return false
    if (action === 'find') {
      if (!root.current?.contains(target)) return false
      openFind()
      return true
    }
    if (readOnly || !mount.current?.contains(target)
      || target instanceof Element && target.closest('input,textarea,select,[data-jot-table-chrome]')) return false
    switch (action) {
      case 'bold': current.commands.toggleBold(); break
      case 'italic': current.commands.toggleItalic(); break
      case 'underline': current.commands.toggleUnderline(); break
      case 'undo': current.commands.undo(); break
      case 'redo': current.commands.redo(); break
    }
    return true
  }
  const closeFind = () => {
    setFindOpen(false)
    editor?.commands.focus()
  }
  const replace = (all: boolean) => {
    if (!editor || readOnly) return
    const current = findMatches(editor.state.doc, query)
    if (!current.length) return
    const match = current[Math.min(index, current.length - 1)]!
    const transaction = all ? replaceAllMatches(editor.state, current, replacement) : replaceMatch(editor.state, match, replacement)
    editor.view.dispatch(transaction)
    // Keep later typing out of the replacement's single undo group.
    editor.view.dispatch(closeHistory(editor.state.tr))
    const remaining = findMatches(editor.state.doc, query)
    const next = all ? 0 : Math.max(0, remaining.findIndex(item => item.from >= match.from + replacement.length))
    setActiveMatch(next)
    findState.current.active = next
    if (remaining.length) {
      const selected = remaining[next]!
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, selected.from, selected.to))
        .setMeta(findKey.current, true).scrollIntoView())
    }
  }
  const marks = [
    { id: 'bold', label: en ? 'Bold' : '粗体', text: 'B', active: editor?.isActive('bold'), run: () => editor?.chain().focus().toggleBold().run() },
    { id: 'italic', label: en ? 'Italic' : '斜体', text: 'I', active: editor?.isActive('italic'), run: () => editor?.chain().focus().toggleItalic().run() },
    { id: 'underline', label: en ? 'Underline' : '下划线', text: 'U', active: editor?.isActive('underline'), run: () => editor?.chain().focus().toggleUnderline().run() },
  ] as const
  const blocks = [
    { id: 'paragraph', label: en ? 'Body text' : '正文', text: '¶', active: editor?.isActive('paragraph') && !editor?.isActive('blockquote'), run: () => editor?.chain().focus().setParagraph().run() },
    { id: 'heading1', label: en ? 'Heading 1' : '标题 1', text: 'H1', active: editor?.isActive('heading', { level: 1 }), run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 'heading2', label: en ? 'Heading 2' : '标题 2', text: 'H2', active: editor?.isActive('heading', { level: 2 }), run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 'heading3', label: en ? 'Heading 3' : '标题 3', text: 'H3', active: editor?.isActive('heading', { level: 3 }), run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: 'bulletList', label: en ? 'Bullet list' : '无序列表', text: '•', active: editor?.isActive('bulletList'), run: () => editor?.chain().focus().toggleBulletList().run() },
    { id: 'orderedList', label: en ? 'Numbered list' : '有序列表', text: '1.', active: editor?.isActive('orderedList'), run: () => editor?.chain().focus().toggleOrderedList().run() },
    { id: 'blockquote', label: en ? 'Quote' : '引用', text: '❝', active: editor?.isActive('blockquote'), run: () => editor?.chain().focus().toggleBlockquote().run() },
    { id: 'codeBlock', label: en ? 'Code block' : '代码块', text: '{ }', active: editor?.isActive('codeBlock'), run: () => editor?.chain().focus().toggleCodeBlock().run() },
  ]
  const inline = [
    { id: 'strike', label: en ? 'Strikethrough' : '删除线', text: 'S', active: editor?.isActive('strike'), run: () => editor?.chain().focus().toggleStrike().run() },
    { id: 'code', label: en ? 'Inline code' : '行内代码', text: '`', active: editor?.isActive('code'), run: () => editor?.chain().focus().toggleCode().run() },
    { id: 'horizontalRule', label: en ? 'Divider' : '分割线', text: '—', active: false, run: () => editor?.chain().focus().setHorizontalRule().run() },
    { id: 'clear', label: en ? 'Clear formatting' : '清除格式', text: '⌫', active: false, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
  ]
  const shortcutTitle = (label: string, id: string) => ['bold', 'italic', 'underline'].includes(id)
    ? `${label} (${editorShortcutLabel(id as 'bold' | 'italic' | 'underline')})` : label
  const colorNames = en ? ['Gray', 'Red', 'Orange', 'Green', 'Blue', 'Purple', 'Pink'] : ['灰色', '红色', '橙色', '绿色', '蓝色', '紫色', '粉色']
  const highlightNames = en ? ['Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Pink'] : ['黄色', '橙色', '绿色', '蓝色', '紫色', '粉色']
  const formatButton = (tool: { id: string; label: string; text: string; active?: boolean; run: () => unknown }, close = true) =>
    <button key={tool.id} type="button" className={`jot-format jot-format-${tool.id}`}
      title={shortcutTitle(tool.label, tool.id)} aria-label={tool.label} aria-pressed={Boolean(tool.active)} disabled={readOnly || !editor}
      onMouseDown={event => event.preventDefault()} onClick={() => { tool.run(); if (close) setFormatOpen(false) }}>
      <span className="jot-format-glyph" aria-hidden="true">{tool.text}</span><span>{tool.label}</span></button>
  return (
    <div ref={root} className="jot-rich-editor" onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={() => { composing.current = false }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
      const action = editorShortcut(event.nativeEvent)
      if (action && shortcutHandler.current(action, event.target)) {
        event.preventDefault(); event.stopPropagation()
      } else if (event.key === 'Escape' && (findOpen || formatOpen)) {
        event.preventDefault(); event.stopPropagation()
        if (formatOpen) { setFormatOpen(false); editor?.commands.focus() } else closeFind()
      }
    }}>
      <div className="jot-format-bar" role="toolbar" aria-label={en ? 'Text formatting' : '文字格式'}>
        <button ref={formatTrigger} type="button" className="jot-format jot-editor-control jot-format-menu" aria-expanded={formatOpen} aria-haspopup="true" disabled={readOnly || !editor}
          aria-label={en ? 'Text styles' : '文字样式'} title={en ? 'Headings, lists, quotes, colors' : '标题、列表、引用和颜色'}
          onMouseDown={event => event.preventDefault()} onClick={() => { setFormatOpen(open => !open); setPaletteOpen(null) }}>
          <EditorControlIcon name="format" /><span className="jot-editor-control-label">{en ? 'Style' : '样式'}</span><EditorControlIcon name="chevron" />
        </button>
        {marks.map(tool => <button key={tool.id} type="button" className={`jot-format jot-editor-control jot-editor-control-icon-only jot-format-${tool.id}`}
          aria-label={tool.label} title={shortcutTitle(tool.label, tool.id)} aria-pressed={Boolean(tool.active)} disabled={readOnly || !editor}
          onMouseDown={event => event.preventDefault()} onClick={() => tool.run()}>{tool.text}</button>)}
        <button type="button" className="jot-format jot-editor-control jot-editor-control-icon-only jot-format-taskList" aria-label={en ? 'To-do list' : '待办清单'}
          title={en ? 'To-do list' : '待办清单'} aria-pressed={Boolean(editor?.isActive('taskList'))} disabled={readOnly || !editor}
          onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
          <EditorControlIcon name="todo" />
        </button>
        <span className="jot-format-divider" aria-hidden="true" />
        <button type="button" className="jot-format jot-editor-control jot-find-open" aria-expanded={findOpen} disabled={!editor}
          aria-label={en ? 'Find in this note' : '在当前笔记中查找'} title={`${en ? 'Find in this note' : '在当前笔记中查找'} (${editorShortcutLabel('find')})`}
          onClick={openFind}><EditorControlIcon name="find" /><span className="jot-editor-control-label">{en ? 'Find' : '查找'}</span></button>
        <button type="button" className="jot-format jot-editor-control jot-table-insert" disabled={readOnly || !editor || editor.isActive('table')}
          aria-label={en ? 'Insert table' : '插入表格'} title={en ? 'Insert table' : '插入表格'} onMouseDown={event => event.preventDefault()}
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <EditorControlIcon name="table" /><span className="jot-editor-control-label">{en ? 'Table' : '表格'}</span>
        </button>
        {formatOpen && <div ref={formatPopover} className="jot-format-popover" role="group" aria-label={en ? 'Text styles' : '文字样式'}>
          <div className="jot-format-section" role="group" aria-label={en ? 'Paragraph style' : '段落样式'}>{blocks.map(tool => formatButton(tool))}</div>
          <div className="jot-format-section" role="group" aria-label={en ? 'More formatting' : '更多格式'}>{inline.map(tool => formatButton(tool))}</div>
          <div className="jot-format-section" role="group" aria-label={en ? 'Color' : '颜色'}>
            <button type="button" className="jot-format" disabled={readOnly || !editor} aria-expanded={paletteOpen === 'text'}
              onMouseDown={event => event.preventDefault()} onClick={() => setPaletteOpen(value => value === 'text' ? null : 'text')}>
              <span className="jot-format-glyph jot-format-color-glyph" aria-hidden="true">A</span><span>{en ? 'Text color' : '文字颜色'}</span></button>
            <button type="button" className="jot-format" disabled={readOnly || !editor} aria-expanded={paletteOpen === 'highlight'}
              onMouseDown={event => event.preventDefault()} onClick={() => setPaletteOpen(value => value === 'highlight' ? null : 'highlight')}>
              <span className="jot-format-glyph jot-format-highlight-glyph" aria-hidden="true">A</span><span>{en ? 'Highlight' : '高亮'}</span></button>
          </div>
          {paletteOpen && <div className="jot-color-palette" role="group" aria-label={paletteOpen === 'text' ? en ? 'Text color' : '文字颜色' : en ? 'Highlight' : '高亮'}>
            {(paletteOpen === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((color, index) => {
              const label = (paletteOpen === 'text' ? colorNames : highlightNames)[index]!
              const text = paletteOpen === 'text'
              return <button type="button" key={color} className={`jot-color-swatch${text ? '' : ' jot-highlight-swatch'}`} data-color={color}
                aria-label={label} title={label} aria-pressed={editor?.getAttributes(text ? 'textStyle' : 'highlight').color === color}
                disabled={readOnly || !editor} style={(text ? { '--jot-swatch-color': color } : { background: color, color: '#23262b' }) as CSSProperties}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  if (text) editor?.chain().focus().setColor(color).run()
                  else editor?.chain().focus().setHighlight({ color }).run()
                  setPaletteOpen(null); setFormatOpen(false)
                }}><span aria-hidden="true">A</span></button>
            })}
            <button type="button" className="jot-text-btn" disabled={readOnly || !editor} onMouseDown={event => event.preventDefault()} onClick={() => {
              if (paletteOpen === 'text') editor?.chain().focus().unsetColor().run()
              else editor?.chain().focus().unsetHighlight().run()
              setPaletteOpen(null); setFormatOpen(false)
            }}>{en ? 'Remove color' : '去掉颜色'}</button>
          </div>}
        </div>}
      </div>
      {findOpen && <div className="jot-document-find" role="search" aria-label={en ? 'Find in this note' : '在当前笔记中查找'}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--jot-line)',
          position: 'sticky', top: 0, zIndex: 2, background: 'var(--jot-bg)' }}>
        <div className="jot-document-find-row" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <input ref={findInput} className="jot-find-query" aria-label={en ? 'Find text' : '查找文本'} value={query}
            placeholder={en ? 'Find in this note' : '在当前笔记中查找'} style={{ flex: '1 1 130px', minWidth: 0 }}
            onChange={event => {
              const nextQuery = event.target.value
              setQuery(nextQuery); setActiveMatch(0)
              findState.current = { query: nextQuery, active: 0 }
              if (!editor) return
              const first = findMatches(editor.state.doc, nextQuery)[0]
              let transaction = editor.state.tr.setMeta(findKey.current, true)
              if (first) transaction = transaction.setSelection(TextSelection.create(editor.state.doc, first.from, first.to)).scrollIntoView()
              editor.view.dispatch(transaction)
            }}
            onKeyDown={event => { if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && event.key === 'Enter') { event.preventDefault(); selectMatch(index + (event.shiftKey ? -1 : 1)) } }} />
          <span className="jot-find-count" role="status" aria-live="polite">{matches.length ? index + 1 : 0} / {matches.length}</span>
          <button type="button" className="jot-text-btn jot-editor-control jot-editor-control-icon-only" disabled={!matches.length} aria-label={en ? 'Previous match' : '上一个匹配'} onClick={() => selectMatch(index - 1)}><EditorControlIcon name="previous" /></button>
          <button type="button" className="jot-text-btn jot-editor-control jot-editor-control-icon-only" disabled={!matches.length} aria-label={en ? 'Next match' : '下一个匹配'} onClick={() => selectMatch(index + 1)}><EditorControlIcon name="next" /></button>
          <button type="button" className="jot-text-btn jot-editor-control" aria-expanded={replaceOpen} disabled={readOnly} onClick={() => setReplaceOpen(open => !open)}><span className="jot-editor-control-label">{en ? 'Replace' : '替换'}</span><EditorControlIcon name="chevron" /></button>
          <button type="button" className="jot-text-btn jot-editor-control jot-editor-control-icon-only" aria-label={en ? 'Close find' : '关闭查找'} onClick={closeFind}><EditorControlIcon name="close" /></button>
        </div>
        {replaceOpen && <div className="jot-document-replace-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input className="jot-find-replacement" aria-label={en ? 'Replacement text' : '替换为'} value={replacement} disabled={readOnly}
            placeholder={en ? 'Replace with (empty deletes)' : '替换为（留空即删除）'} style={{ flex: '1 1 130px', minWidth: 0 }}
            onChange={event => setReplacement(event.target.value)} onKeyDown={event => { if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && event.key === 'Enter') { event.preventDefault(); replace(false) } }} />
          <button type="button" className="jot-text-btn jot-editor-control" disabled={readOnly || !matches.length} onClick={() => replace(false)}><span className="jot-editor-control-label">{en ? 'Replace' : '替换此处'}</span></button>
          <button type="button" className="jot-text-btn jot-editor-control" disabled={readOnly || !matches.length} onClick={() => replace(true)}><span className="jot-editor-control-label">{en ? 'Replace all' : '全部替换'}</span></button>
        </div>}
      </div>}
      <div className="jot-editor-mount" ref={mount} />
      {editor && <TableControls editor={editor} readOnly={readOnly} en={en} />}
    </div>
  )
}
