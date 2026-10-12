import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { JotLocale } from './types.js'

export interface LinkPopoverProps {
  locale: JotLocale
  readOnly: boolean
  text: string
  href: string
  existing: boolean
  canOpen: boolean
  error: string
  onText: (value: string) => void
  onHref: (value: string) => void
  onSubmit: () => void
  onOpen: () => void
  onRemove: () => void
  onClose: () => void
}

/** 只读时输入框是 disabled，焦点要落到还能用的按钮，或对话框本身。 */
export function linkPopoverInitialFocus(input: { readOnly: boolean; text: string; canOpen: boolean }): 'href' | 'text' | 'open' | 'dialog' {
  if (!input.readOnly) return input.text ? 'href' : 'text'
  return input.canOpen ? 'open' : 'dialog'
}

/**
 * 浮层该在什么时候重新聚焦。只看这一次打开的编号、只读和是否已经定位。
 * 文字或网址变了不能放进依赖，否则新链接打第一个字就会从文字跳到网址并全选。
 */
export function linkPopoverFocusKey(input: { id: number; readOnly: boolean; placed: boolean }): string | null {
  if (!input.placed) return null
  return `${input.id}:${input.readOnly ? 1 : 0}`
}

/** 工具栏风格的链接浮层：打开后焦点进入输入框，Escape 关闭。 */
export function LinkPopover({ locale, readOnly, text, href, existing, canOpen, error, onText, onHref, onSubmit, onOpen, onRemove, onClose }: LinkPopoverProps) {
  const en = locale === 'en'
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!readOnly) onSubmit()
  }
  return <div role="dialog" aria-label={en ? 'Link' : '链接'} className="jot-link-popover" tabIndex={-1} onKeyDown={onKeyDown}
    onMouseDown={event => { if (!(event.target as HTMLElement).closest('input,textarea')) event.preventDefault() }}>
    <form onSubmit={submit}>
      <label>{en ? 'Text' : '文字'}
        <input className="jot-link-text" value={text} disabled={readOnly} aria-label={en ? 'Link text' : '链接文字'}
          onChange={event => onText(event.target.value)} />
      </label>
      <label>{en ? 'Address' : '网址'}
        <input className="jot-link-href" value={href} disabled={readOnly} aria-label={en ? 'Link address' : '链接网址'}
          aria-invalid={error ? true : undefined} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={event => onHref(event.target.value)} />
      </label>
      {error && <p className="jot-link-error" role="alert">{error}</p>}
      <div className="jot-link-actions">
        {!readOnly && <button type="submit" className="jot-btn jot-primary">{existing ? en ? 'Save' : '保存' : en ? 'Insert' : '插入'}</button>}
        {canOpen && <button type="button" className="jot-btn jot-link-open" onClick={onOpen}>{en ? 'Open' : '打开'}</button>}
        {!readOnly && existing && <button type="button" className="jot-text-btn" onClick={onRemove}>{en ? 'Remove' : '移除'}</button>}
      </div>
    </form>
  </div>
}
