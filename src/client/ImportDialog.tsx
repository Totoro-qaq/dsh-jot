import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { JotLocale } from './types.js'

export interface ImportDialogProps {
  locale: JotLocale
  busy: boolean
  error: string
  onImport: (files: File[]) => void
  onClose: () => void
}

/** Markdown and text files, a whole folder such as a notes vault, or a ZIP exported from Jot. */
export function ImportDialog({ locale, busy, error, onImport, onClose }: ImportDialogProps) {
  const en = locale === 'en'
  const filesInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  // React has no typed property for choosing a folder.
  useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', '') }, [])
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])]
    event.target.value = ''
    if (picked.length) setFiles(picked)
  }
  const notes = files.filter(file => /\.(?:md|markdown|txt)$/iu.test(file.name)).length
  const archive = files.length === 1 && /\.zip$/iu.test(files[0]!.name)
  const folder = files[0]?.webkitRelativePath.split('/')[0]
  const summary = archive ? en ? `ZIP archive “${files[0]!.name}”` : `ZIP 压缩包「${files[0]!.name}」`
    : folder ? en ? `Folder “${folder}”: ${notes} Markdown or text files` : `文件夹「${folder}」：${notes} 个 Markdown 或文本文件`
      : en ? `${notes} Markdown or text files` : `${notes} 个 Markdown 或文本文件`
  return <form className="jot-export-form" onSubmit={event => { event.preventDefault(); if (!busy && (archive || notes)) onImport(files) }}>
    <p className="jot-dialog-text">{en
      ? 'Import Markdown (.md) and text (.txt) files, or a whole folder such as an Obsidian vault. A ZIP exported from Jot, in any format, restores its notes exactly.'
      : '可以导入 Markdown（.md）和纯文本（.txt）文件，或整个文件夹，比如 Obsidian 的笔记库。随记导出的 ZIP（任何格式）能原样恢复里面的笔记。'}</p>
    <div className="jot-import-pick">
      <button type="button" className="jot-btn" disabled={busy} data-autofocus="" onClick={() => filesInput.current?.click()}>
        {en ? 'Choose files…' : '选择文件…'}</button>
      <button type="button" className="jot-btn" disabled={busy} onClick={() => folderInput.current?.click()}>
        {en ? 'Choose a folder…' : '选择文件夹…'}</button>
    </div>
    <input ref={filesInput} type="file" multiple hidden accept=".md,.markdown,.txt,.zip" onChange={pick}
      aria-label={en ? 'Choose files to import' : '选择要导入的文件'} />
    <input ref={folderInput} type="file" hidden onChange={pick} aria-label={en ? 'Choose a folder to import' : '选择要导入的文件夹'} />
    {files.length > 0 && <p className="jot-import-summary" role="status">{summary}</p>}
    <p className="jot-export-note">{en
      ? 'Subfolders become folders in Jot, and the images and files the notes use come along. Notes identical to ones already in Jot are skipped.'
      : '子文件夹会成为随记里的文件夹，笔记用到的图片和附件会一起导入；和已有笔记完全相同的会跳过。'}</p>
    {error && <p className="jot-dialog-error" role="alert">{error}</p>}
    <div className="jot-dialog-actions">
      <button type="button" className="jot-btn" disabled={busy} onClick={onClose}>{en ? 'Cancel' : '取消'}</button>
      <button type="submit" className="jot-btn jot-primary" disabled={busy || !(archive || notes)}>
        {busy ? en ? 'Importing…' : '正在导入…' : en ? 'Import' : '导入'}</button>
    </div>
  </form>
}

export default ImportDialog
