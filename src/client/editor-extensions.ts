import { Node, type Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { HIGHLIGHT_COLORS, TEXT_COLORS, normalizePaletteColor } from '../model.js'
import { JotTable, JotTableView, PersistableTableWidths } from './table-view.js'
import { TABLE_CELL_MIN_WIDTH } from './table-actions.js'

export const managedAttachmentUrl = (id: string) => `/jot/api/attachments/${encodeURIComponent(id)}/content`
const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/u.test(value)

export interface JotExtensionOptions { resolveAttachmentUrl?: (id: string) => string }

/** Clipboard formatting can only introduce colors that persistence also accepts. */
const PaletteColor = Color.extend({
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { color: {
      default: null,
      parseHTML: element => normalizePaletteColor(element.style.color, TEXT_COLORS),
      renderHTML: attributes => {
        const color = normalizePaletteColor(attributes.color, TEXT_COLORS)
        return color ? { style: `color:${color}` } : {}
      },
    } } }]
  },
  addCommands() {
    return {
      setColor: color => ({ chain }) => {
        const normalized = normalizePaletteColor(color, TEXT_COLORS)
        return normalized ? chain().setMark('textStyle', { color: normalized }).run() : false
      },
      unsetColor: () => ({ chain }) => chain().setMark('textStyle', { color: null }).removeEmptyTextStyle().run(),
    }
  },
})

const PaletteHighlight = Highlight.extend({
  addAttributes() {
    return { color: {
      default: null,
      parseHTML: element => normalizePaletteColor(element.getAttribute('data-color') || element.style.backgroundColor, HIGHLIGHT_COLORS),
      renderHTML: attributes => {
        const color = normalizePaletteColor(attributes.color, HIGHLIGHT_COLORS)
        return color ? { 'data-color': color, style: `background-color:${color};color:inherit` } : {}
      },
    } }
  },
  addCommands() {
    return {
      setHighlight: attributes => ({ commands }) => {
        const color = normalizePaletteColor(attributes?.color ?? HIGHLIGHT_COLORS[0], HIGHLIGHT_COLORS)
        return color ? commands.setMark(this.name, { color }) : false
      },
      toggleHighlight: attributes => ({ commands }) => {
        const color = normalizePaletteColor(attributes?.color ?? HIGHLIGHT_COLORS[0], HIGHLIGHT_COLORS)
        return color ? commands.toggleMark(this.name, { color }) : false
      },
      unsetHighlight: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})

function managedNode(name: 'image' | 'attachment', resolve: (id: string) => string) {
  const description = name === 'image' ? 'alt' : 'caption'
  return Node.create({
    name, group: 'block', atom: true, draggable: true,
    addAttributes() { return { attachmentId: { default: null }, [description]: { default: '' } } },
    parseHTML() {
      return [{ tag: name === 'image' ? 'img[data-jot-attachment-id]' : 'a[data-type="jot-attachment"]', priority: 100,
        getAttrs: element => {
          const id = element.getAttribute('data-jot-attachment-id')
          if (!validId(id)) return false
          return { attachmentId: id, [description]: name === 'image' ? element.getAttribute('alt') ?? '' : element.textContent ?? '' }
        } }]
    },
    renderHTML({ node }) {
      const id: unknown = node.attrs.attachmentId
      if (!validId(id)) return ['span', { class: 'jot-attachment-unavailable' }, 'Attachment unavailable']
      const label = String(node.attrs[description] ?? '')
      const url = resolve(id)
      if (name === 'image') return ['img', { 'data-jot-attachment-id': id, src: url, alt: label,
        class: 'jot-managed-image', loading: 'lazy', decoding: 'async' }]
      return ['a', { 'data-type': 'jot-attachment', 'data-jot-attachment-id': id,
        href: `${url}${url.includes('?') ? '&' : '?'}download=1`, class: 'jot-attachment-card', download: '', rel: 'noopener' }, label || 'Attachment']
    },
  })
}

/** Shared by the actual editor and headless schema/command regression tests. */
export function createJotExtensions(options: JotExtensionOptions = {}): Extensions {
  const resolve = options.resolveAttachmentUrl ?? managedAttachmentUrl
  return [StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
    TaskList, TaskItem.configure({ nested: true }),
    JotTable.configure({ resizable: true, renderWrapper: true, cellMinWidth: TABLE_CELL_MIN_WIDTH,
      handleWidth: 6, View: JotTableView }), TableRow, TableHeader, TableCell, PersistableTableWidths,
    TextStyle, PaletteColor, PaletteHighlight.configure({ multicolor: true }),
    managedNode('image', resolve), managedNode('attachment', resolve)]
}
