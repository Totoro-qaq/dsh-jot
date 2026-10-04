import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultJotApi, JotApiError } from './api.js'
import { draftFromNote, draftFingerprint, editDraft, emptyDocument, persistDraft, readDraft, receiveLatestDraft, reconcileDraft, recoveryDrafts, sameDraftGeneration, savedDraft, sharedDraftStorage } from './drafts.js'
import type { NoteDraft } from './drafts.js'
import { RichEditor, type RichEditorActions } from './RichEditor.js'
import { appShortcut } from './app-shortcuts.js'
import { ActionMenu, type ActionMenuItem } from './ActionMenu.js'
import { JotActionIcon } from './icons.js'
import { JotIcon } from './JotIcon.js'
import { Modal } from './Modal.js'
import { AttachmentPreview } from './AttachmentPreview.js'
import { CaptureDialog, type CaptureSubmission } from './CaptureDialog.js'
import { appendExcerpt, duplicateNoteInput, sortNotes, type NoteSortMode } from './note-actions.js'
import { downloadNote } from './downloads.js'
import { jotStyles } from './styles.js'
import { NoteList } from './NoteList.js'
import { NoteOpenConsumer, readHandoffDraft, type NoteOpenRequest } from './note-handoff.js'
import type { AttachmentInfo, ExportFormat, JotApi, JotLocale, JotState, Note, RichNode } from './types.js'
import type { AttachmentDialogRequest } from './attachment-dialog.js'

export interface JotAppProps {
  mode: 'compact' | 'wide'
  onExpand?: (noteId?: string, draftId?: string, noteRevision?: number) => void
  openNoteRequest?: NoteOpenRequest
  onNoteRequestHandled?: (revision: number) => void
  api?: JotApi
  locale?: JotLocale
  chromeInset?: boolean
  onEditorFocus?: (owner: object) => () => void
  /** false requests the local dialog; undefined retires a superseded gesture. */
  onAttachmentPreview?: (attachmentId: string, options?: { signal?: AbortSignal }) => Promise<boolean | undefined>
  attachmentDialogRequest?: AttachmentDialogRequest
  onAttachmentDialogHandled?: (revision: number) => void
}

type SavePhase = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'
interface SaveStatus { phase: SavePhase; message?: string }
type ListView = 'recent' | 'all' | 'trash'

function Icon({ name }: { name: 'search' | 'new' | 'expand' | 'back' | 'pin' | 'trash' | 'folder' | 'save' | 'attach' | 'capture' }) {
  const names = { search: 'search', new: 'new-note', expand: 'expand', back: 'back', pin: 'pin', trash: 'trash',
    folder: 'new-folder', save: 'save', attach: 'attachment', capture: 'capture' } as const
  return <JotActionIcon name={names[name]} />
}

export function JotApp({ mode, onExpand, openNoteRequest, onNoteRequestHandled, api = defaultJotApi, locale = 'zh', chromeInset = false, onEditorFocus, onAttachmentPreview, attachmentDialogRequest, onAttachmentDialogHandled }: JotAppProps) {
  const en = locale === 'en'
  const copy = (zh: string, english: string) => en ? english : zh
  const [snapshot, setSnapshot] = useState<JotState | null>(null)
  const snapshotRef = useRef<JotState | null>(null)
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const draftRef = useRef<NoteDraft | null>(null)
  const editorActions = useRef<RichEditorActions | null>(null)
  const editorFocusLease = useRef<(() => void) | null>(null)
  const releaseEditorFocus = useCallback(() => {
    editorFocusLease.current?.()
    editorFocusLease.current = null
  }, [])
  useEffect(() => releaseEditorFocus, [releaseEditorFocus])
  const drafts = useRef(new Map<string, NoteDraft>())
  const selectionGeneration = useRef(0)
  const uploadTarget = useRef<{ draft: NoteDraft; generation: number } | null>(null)
  const noteRequests = useRef(new NoteOpenConsumer())
  const requestedRefresh = useRef(0)
  const freshRequest = useRef(0)
  const currentOpenRequest = useRef(openNoteRequest)
  currentOpenRequest.current = openNoteRequest
  const inFlight = useRef(new Map<string, Promise<boolean>>())
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({})
  const statusesRef = useRef<Record<string, SaveStatus>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<ListView>('recent')
  const [folderFilter, setFolderFilter] = useState('__all__')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [compactEditor, setCompactEditor] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [folderForm, setFolderForm] = useState<'create' | 'rename' | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState(false)
  const [sortMode, setSortMode] = useState<NoteSortMode>(() => {
    try { const value = localStorage.getItem('dsh-jot:sort:v1'); if (value === 'created' || value === 'title') return value } catch { /* unavailable storage */ }
    return 'modified'
  })
  useEffect(() => { try { localStorage.setItem('dsh-jot:sort:v1', sortMode) } catch { /* keep the session preference */ } }, [sortMode])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set<string>())
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureSource, setCaptureSource] = useState('')
  const [captureError, setCaptureError] = useState('')
  const pendingCapture = useRef<{ key: string; noteId: string } | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveFolder, setMoveFolder] = useState('')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentInfo | null>(null)
  const attachmentRequest = useRef<AbortController | null>(null)
  useEffect(() => () => { if (mode === 'compact') attachmentRequest.current?.abort() }, [mode])
  useEffect(() => {
    if (!attachmentDialogRequest) return
    let active = true
    const { attachmentId, revision } = attachmentDialogRequest
    void api.getAttachment(attachmentId).then(attachment => {
      if (active) { setAttachmentPreview(attachment); onAttachmentDialogHandled?.(revision) }
    }, cause => {
      if (active) { setError(cause instanceof Error ? cause.message : String(cause)); onAttachmentDialogHandled?.(revision) }
    })
    return () => { active = false }
  }, [attachmentDialogRequest, onAttachmentDialogHandled, api])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const apiRef = useRef(api)
  apiRef.current = api

  const setStatus = useCallback((id: string, status: SaveStatus) => {
    const next = { ...statusesRef.current, [id]: status }
    statusesRef.current = next
    if (mounted.current) setStatuses(next)
  }, [])

  const installDraft = useCallback((next: NoteDraft) => {
    const stored = persistDraft(next)
    if (uploadTarget.current?.generation === selectionGeneration.current && uploadTarget.current.draft.noteId === stored.noteId) uploadTarget.current.draft = stored
    drafts.current.set(stored.noteId, stored)
    draftRef.current = stored
    if (mounted.current) setDraft(stored)
  }, [])

  const refresh = useCallback(async () => {
    const next = await apiRef.current.getState()
    if (!mounted.current) return
    snapshotRef.current = next
    setSnapshot(next)
    const current = draftRef.current
    if (!current) return
    const remote = next.notes.find(note => note.id === current.noteId)
    if (!remote) {
      if (current.dirty) setStatus(current.noteId, { phase: 'conflict' })
      return
    }
    const result = reconcileDraft(current, remote)
    if (result.remoteChanged && !inFlight.current.has(current.noteId)) setStatus(current.noteId, { phase: 'conflict' })
    if (result.draft !== current && !inFlight.current.has(current.noteId)) installDraft(result.draft)
  }, [installDraft, setStatus])

  const saveDraft = useCallback((id: string): Promise<boolean> => {
    const existing = inFlight.current.get(id)
    if (existing) return existing
    const submitted = drafts.current.get(id)
    if (!submitted?.dirty) return Promise.resolve(true)
    setStatus(id, { phase: 'saving' })
    const operation = (async () => {
      try {
        const saved = await apiRef.current.updateNote(id, {
          revision: submitted.baseRevision, title: submitted.title, content: submitted.content,
          folderId: submitted.folderId, pinned: submitted.pinned,
        })
        const current = drafts.current.get(id) ?? submitted
        const next = savedDraft(current, submitted, saved)
        drafts.current.set(id, next)
        persistDraft(next)
        if (draftRef.current?.noteId === id) installDraft(next)
        setStatus(id, { phase: current.draftId !== submitted.draftId && next.dirty ? 'conflict' : next.dirty ? 'dirty' : 'saved' })
        // Keep a mutation response visible even if the following refresh fails.
        if (mounted.current) {
          setSnapshot(previous => {
            if (!previous) return previous
            const updated = { ...previous, notes: previous.notes.map(note => note.id === saved.id && note.revision <= saved.revision ? saved : note) }
            snapshotRef.current = updated
            return updated
          })
        }
        return true
      } catch (cause) {
        const conflict = cause instanceof JotApiError && cause.status === 409
          || typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 409
        setStatus(id, { phase: conflict ? 'conflict' : 'error', message: cause instanceof Error ? cause.message : String(cause) })
        return false
      } finally {
        inFlight.current.delete(id)
        if (mounted.current) void refresh().catch(() => {})
      }
    })()
    inFlight.current.set(id, operation)
    return operation
  }, [installDraft, refresh, setStatus])

  useEffect(() => {
    mounted.current = true
    void refresh().catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
    const timer = setInterval(() => {
      void refresh().catch(cause => {
        if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause))
      })
    }, 3000)
    return () => {
      mounted.current = false
      clearInterval(timer)
      for (const item of drafts.current.values()) persistDraft(item)
    }
  }, [refresh, api])

  useEffect(() => {
    if (!draft?.dirty || statuses[draft.noteId]?.phase === 'conflict' || statuses[draft.noteId]?.phase === 'error') return
    const timer = setTimeout(() => { void saveDraft(draft.noteId) }, 750)
    return () => clearTimeout(timer)
  }, [draft, saveDraft, statuses])

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen, compactEditor])

  useEffect(() => {
    if (snapshot && !folderFilter.startsWith('__') && !snapshot.folders.some(folder => folder.id === folderFilter)) {
      setFolderFilter('__all__')
    }
  }, [snapshot, folderFilter])

  const patchDraft = (patch: Partial<Pick<NoteDraft, 'title' | 'content' | 'folderId' | 'pinned'>>) => {
    const current = draftRef.current
    if (!current) return
    const next = editDraft(current, patch)
    installDraft(next)
    if (statusesRef.current[current.noteId]?.phase !== 'conflict') setStatus(current.noteId, { phase: 'dirty' })
  }

  const selectNote = useCallback((note: Note, handoff?: NoteOpenRequest) => {
    selectionGeneration.current++
    const pending = currentOpenRequest.current
    if (!handoff && pending?.noteId) onNoteRequestHandled?.(pending.revision)
    const previous = draftRef.current
    if (previous?.dirty && previous.noteId !== note.id && statusesRef.current[previous.noteId]?.phase !== 'conflict') void saveDraft(previous.noteId)
    const stored = handoff ? readHandoffDraft(note, handoff.draftId) : readDraft(note, drafts.current.get(note.id))
    const result = reconcileDraft(stored, note)
    installDraft(result.draft)
    setStatus(note.id, { phase: result.remoteChanged ? 'conflict' : result.draft.dirty ? 'dirty' : 'saved' })
    setCompactEditor(true)
    setDeleteConfirm(false)
    setSearchOpen(false)
    setError('')
  }, [installDraft, saveDraft, setStatus, onNoteRequestHandled])

  useEffect(() => {
    const note = noteRequests.current.consume(openNoteRequest, snapshot?.notes ?? null,
      { fresh: freshRequest.current === openNoteRequest?.revision })
    if (note) {
      setView(note.deletedAt ? 'trash' : 'all')
      setFolderFilter('__all__')
      setQuery('')
      selectNote(note, openNoteRequest)
      if (openNoteRequest) onNoteRequestHandled?.(openNoteRequest.revision)
    } else if (snapshot && openNoteRequest?.noteId && noteRequests.current.isPending(openNoteRequest)
      && requestedRefresh.current !== openNoteRequest.revision) {
      const request = openNoteRequest
      requestedRefresh.current = request.revision
      void apiRef.current.getNote(request.noteId!).then(received => {
        if (!mounted.current || currentOpenRequest.current?.revision !== request.revision
          || currentOpenRequest.current.noteId !== request.noteId) return
        freshRequest.current = request.revision
        setSnapshot(previous => {
          if (!previous) return previous
          const known = previous.notes.find(item => item.id === received.id)
          const next = { ...previous, notes: known
            ? previous.notes.map(item => item.id === received.id && item.revision <= received.revision ? received : item)
            : [...previous.notes, received] }
          snapshotRef.current = next
          return next
        })
      }).catch(cause => {
        if (mounted.current && currentOpenRequest.current?.revision === request.revision) {
          requestedRefresh.current = 0
          setError(String(cause))
        }
      })
    }
  }, [openNoteRequest, onNoteRequestHandled, snapshot, selectNote])

  const perform = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (mounted.current) setBusy(false) }
  }

  const newNote = () => void perform(async () => {
    const current = draftRef.current
    if (current?.dirty && statusesRef.current[current.noteId]?.phase !== 'conflict') void saveDraft(current.noteId)
    const note = await api.createNote({ folderId: folderFilter.startsWith('__') ? null : folderFilter })
    await refresh()
    setView('all')
    setQuery('')
    selectNote(note)
  })

  const openSearch = () => {
    if (draftRef.current?.dirty && statusesRef.current[draftRef.current.noteId]?.phase !== 'conflict') void saveDraft(draftRef.current.noteId)
    setCompactEditor(false)
    setSearchOpen(true)
  }

  const goToList = () => {
    if (draftRef.current?.dirty && statusesRef.current[draftRef.current.noteId]?.phase !== 'conflict') void saveDraft(draftRef.current.noteId)
    setCompactEditor(false)
  }

  const loadLatest = () => void perform(async () => {
    const requested = draftRef.current
    if (!requested) return
    selectionGeneration.current++
    const received = await api.getNote(requested.noteId)
    const known = snapshotRef.current?.notes.find(item => item.id === requested.noteId)
    const note = known && known.revision > received.revision ? known : received
    const result = receiveLatestDraft(requested, draftRef.current, note, sharedDraftStorage)
    const cached = drafts.current.get(requested.noteId)
    if (sameDraftGeneration(cached, requested)) {
      drafts.current.set(requested.noteId, draftFromNote(note))
      setStatus(requested.noteId, { phase: 'saved' })
    }
    if (result.replaced && result.draft) installDraft(result.draft)
    else if (draftRef.current?.noteId === requested.noteId && draftRef.current.dirty) {
      setStatus(requested.noteId, { phase: draftRef.current.baseRevision === note.revision && !note.deletedAt ? 'dirty' : 'conflict' })
    }
    if (mounted.current) setSnapshot(previous => {
      if (!previous) return previous
      const updated = { ...previous, notes: previous.notes.map(existing => existing.id === note.id && existing.revision <= note.revision ? note : existing) }
      snapshotRef.current = updated
      return updated
    })
    await refresh()
  })

  const saveAsNew = () => void perform(async () => {
    const current = draftRef.current
    if (!current) return
    const note = await api.createNote({ title: current.title, content: current.content, folderId: current.folderId })
    // The original draft remains recoverable; copying is not permission to discard it.
    await refresh()
    setView('all')
    selectNote(note)
  })

  const removeNote = () => void perform(async () => {
    const current = draftRef.current
    if (!current) return
    if (current.dirty && !await saveDraft(current.noteId)) return
    const latest = drafts.current.get(current.noteId) ?? current
    // Typing during the pending save belongs to the draft, not to this delete.
    if (latest.dirty) return
    if (sharedDraftStorage.all(current.noteId).length) throw new Error(copy('这条笔记还有保留的草稿，请先打开并处理。', 'Resolve this note’s kept drafts before deleting.'))
    await api.deleteNote(current.noteId, latest.baseRevision)
    if (sameDraftGeneration(draftRef.current, latest)) {
      setDeleteConfirm(false)
      setCompactEditor(false)
      draftRef.current = null
      setDraft(null)
    }
    await refresh()
  })

  const openCapture = () => {
    pendingCapture.current = null
    setCaptureText(window.getSelection()?.toString() ?? '')
    setCaptureSource(/^https?:/.test(location.protocol) ? location.href : '')
    setCaptureError('')
    setCaptureOpen(true)
  }

  const capture = async (submission: CaptureSubmission) => {
    if (busy) return
    setBusy(true); setCaptureError('')
    try {
      if (submission.targetNoteId === null) {
        const content = appendExcerpt(emptyDocument(), submission.text, submission.source)
        const note = await api.createNote({ title: submission.title ?? submission.text.trim().split('\n')[0].slice(0, 120), content })
        await refresh(); setView('all'); setQuery(''); selectNote(note)
      } else {
        const current = draftRef.current
        if (current?.noteId === submission.targetNoteId) {
          if (statusesRef.current[current.noteId]?.phase === 'conflict') throw new Error(copy('这篇笔记有版本冲突，请先处理保留的草稿。', 'Resolve the kept draft conflict before appending.'))
          const key = JSON.stringify(submission)
          if (pendingCapture.current && (pendingCapture.current.key !== key || pendingCapture.current.noteId !== current.noteId)) {
            throw new Error(copy('上一段摘录仍保留在草稿中，请先保存该草稿，再添加新的摘录。', 'Save the previously kept excerpt before adding another.'))
          }
          if (!pendingCapture.current) {
            patchDraft({ content: appendExcerpt(current.content, submission.text, submission.source) })
            pendingCapture.current = { key, noteId: current.noteId }
          }
          // An older autosave can still be in flight when the excerpt is added.
          // Its acknowledgement does not include this new content.
          let saved = await saveDraft(current.noteId)
          if (saved && drafts.current.get(current.noteId)?.dirty) saved = await saveDraft(current.noteId)
          if (!saved || drafts.current.get(current.noteId)?.dirty) throw new Error(copy('摘录已保留在笔记草稿中，尚未保存成功；重试不会重复追加。', 'The excerpt is kept in the note draft; retrying will not append it again.'))
        } else {
          const latest = await api.getNote(submission.targetNoteId)
          if (latest.deletedAt) throw new Error(copy('目标笔记已移到回收站。', 'The target note is in Trash.'))
          if (drafts.current.get(latest.id)?.dirty || sharedDraftStorage.all(latest.id).length) throw new Error(copy('目标笔记有未保存草稿，请先打开并处理，再追加摘录。', 'Open and resolve the target note draft before appending.'))
          await api.updateNote(latest.id, { revision: latest.revision, content: appendExcerpt(latest.content, submission.text, submission.source) })
          await refresh()
        }
      }
      pendingCapture.current = null
      setCaptureOpen(false)
    } catch (cause) { setCaptureError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (mounted.current) setBusy(false) }
  }

  const duplicateNote = () => void perform(async () => {
    const current = draftRef.current
    if (!current) return
    const note = await api.createNote(duplicateNoteInput(current, locale))
    await refresh(); setView('all'); setQuery(''); selectNote(note)
  })

  const exportCurrent = (format: ExportFormat) => void perform(async () => {
    const current = draftRef.current
    if (!current) return
    const result = await api.exportNote({ title: current.title, content: current.content }, format)
    downloadNote(result)
    setNotice(copy(`已导出 ${result.filename}`, `Exported ${result.filename}`))
  })

  const toggleSelection = (note: Note) => setSelectedIds(previous => {
    const next = new Set(previous)
    if (next.has(note.id)) next.delete(note.id); else next.add(note.id)
    return next
  })

  const moveSelected = () => void perform(async () => {
    const ids = selectMode ? [...selectedIds] : draftRef.current ? [draftRef.current.noteId] : []
    let completed = 0
    try {
      for (const id of ids) {
        const current = draftRef.current
        if (current?.noteId !== id && (drafts.current.get(id)?.dirty || sharedDraftStorage.all(id).length)) throw new Error(copy('目标笔记有未保存草稿，请先打开并处理。', 'Resolve the target note draft before moving.'))
        if (current?.noteId === id && current.dirty) {
          if (statusesRef.current[id]?.phase === 'conflict' || !await saveDraft(id)) throw new Error(copy('草稿已保留，请先处理版本冲突。', 'Resolve the kept draft first.'))
          if (draftRef.current?.dirty) throw new Error(copy('笔记仍在编辑，请保存后再移动。', 'Finish editing before moving.'))
        }
        if (sharedDraftStorage.all(id).length) throw new Error(copy('这条笔记还有保留的草稿，请先打开并处理。', 'Resolve this note’s kept drafts before moving.'))
        const before = await api.getNote(id)
        if (before.deletedAt) continue
        if (before.folderId === (moveFolder || null)) { completed++; continue }
        const saved = await api.updateNote(id, { revision: before.revision, folderId: moveFolder || null })
        const active = draftRef.current
        if (active?.noteId === id && active.baseRevision === before.revision) {
          installDraft({ ...active, baseRevision: saved.revision,
            folderId: active.folderId === before.folderId ? saved.folderId : active.folderId })
        }
        completed++
      }
      setMoveOpen(false); setSelectedIds(new Set()); await refresh()
      setNotice(copy(`已移动 ${completed} 条笔记`, `Moved ${completed} notes`))
    } catch (cause) {
      await refresh()
      throw new Error(`${copy(`已移动 ${completed} 条。`, `Moved ${completed}.`)} ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  })

  const deleteSelected = () => void perform(async () => {
    let completed = 0
    try {
      for (const id of [...selectedIds]) {
        const current = draftRef.current
        if (current?.noteId !== id && (drafts.current.get(id)?.dirty || sharedDraftStorage.all(id).length)) throw new Error(copy('目标笔记有未保存草稿，请先打开并处理。', 'Resolve the target note draft before deleting.'))
        if (current?.noteId === id && current.dirty) {
          if (statusesRef.current[id]?.phase === 'conflict' || !await saveDraft(id) || draftRef.current?.dirty) {
            throw new Error(copy('请先处理正在编辑的草稿。', 'Resolve the active draft before deleting.'))
          }
        }
        if (sharedDraftStorage.all(id).length) throw new Error(copy('这条笔记还有保留的草稿，请先打开并处理。', 'Resolve this note’s kept drafts before deleting.'))
        const before = await api.getNote(id)
        if (before.deletedAt) continue
        await api.deleteNote(id, before.revision)
        completed++
      }
      setBulkDeleteOpen(false); setSelectedIds(new Set()); setSelectMode(false)
      await refresh(); setNotice(copy(`已将 ${completed} 条笔记移到回收站`, `Moved ${completed} notes to Trash`))
    } catch (cause) {
      await refresh()
      throw new Error(`${copy(`已处理 ${completed} 条。`, `Processed ${completed}.`)} ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  })

  const uploadFiles = async (files: File[]) => {
    if (uploadBusy || files.length === 0) return
    if (files.length > 20) { setError(copy('一次最多添加 20 个文件。', 'Add at most 20 files at once.')); return }
    setUploadBusy(true); setError(''); setNotice('')
    try {
      let target = draftRef.current
      if (!target) {
        const note = await api.createNote({ title: '' })
        await refresh(); selectNote(note); target = drafts.current.get(note.id) ?? draftFromNote(note)
      }
      if (snapshotRef.current?.notes.find(note => note.id === target!.noteId)?.deletedAt) throw new Error(copy('恢复笔记后才能添加附件。', 'Restore the note before adding files.'))
      const targetId = target.noteId
      const intended = { draft: target, generation: selectionGeneration.current }
      uploadTarget.current = intended
      for (const file of files) {
        const attachment = await api.uploadAttachment(file)
        const active = draftRef.current
        if (active?.noteId === targetId && selectionGeneration.current === intended.generation && editorActions.current) {
          const inserted = attachment.kind === 'image' ? editorActions.current.insertImage(attachment.id, attachment.name)
            : editorActions.current.insertAttachment(attachment.id, attachment.name)
          if (inserted) continue
        }
        let original = intended.draft.draftId ? sharedDraftStorage.all(targetId).find(item => item.draftId === intended.draft.draftId) ?? intended.draft : intended.draft
        const latest = await api.getNote(targetId)
        if (!original.dirty) original = draftFromNote(latest)
        else if (draftFingerprint(original) === draftFingerprint(draftFromNote(latest))) original = { ...original, baseRevision: latest.revision }
        const node: RichNode = attachment.kind === 'image' ? { type: 'image', attrs: { attachmentId: attachment.id, alt: attachment.name } }
          : { type: 'attachment', attrs: { attachmentId: attachment.id, caption: attachment.name } }
        const next = editDraft(original, { content: { ...original.content, content: [...(original.content.content ?? []), node] } })
        const stored = persistDraft(next)
        intended.draft = stored
        if (draftRef.current?.noteId === targetId && selectionGeneration.current === intended.generation) installDraft(stored)
        else {
          if (draftRef.current?.noteId !== targetId) drafts.current.set(targetId, stored)
          setNotice(copy('附件已保留在原笔记的恢复草稿中。', 'Files were kept in a recovery draft of the original note.'))
        }
        setStatus(targetId, { phase: 'dirty' })
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { uploadTarget.current = null; if (mounted.current) setUploadBusy(false) }
  }

  const previewAttachment = (id: string) => void perform(async () => {
    attachmentRequest.current?.abort()
    const controller = new AbortController()
    attachmentRequest.current = controller
    // The Host owns navigation after this handoff, including a wide panel's
    // intentional unmount when returning to the Conversation.
    const opened = onAttachmentPreview ? await onAttachmentPreview(id, { signal: controller.signal }) : false
    if (opened !== false || !mounted.current || controller.signal.aborted) return
    const attachment = await api.getAttachment(id)
    if (mounted.current && !controller.signal.aborted) setAttachmentPreview(attachment)
  })

  const selectedNote = snapshot?.notes.find(note => note.id === draft?.noteId)
  const recoveries = draft ? recoveryDrafts(draft.noteId) : []
  const selectedStatus = draft ? statuses[draft.noteId] : undefined
  const selectedDeleted = selectedNote?.deletedAt !== null && selectedNote?.deletedAt !== undefined
  useEffect(() => { if (selectedDeleted) releaseEditorFocus() }, [selectedDeleted, releaseEditorFocus])
  const actualFolder = snapshot?.folders.find(folder => folder.id === folderFilter)
  const effectiveSort: NoteSortMode = view === 'recent' && !query.trim() ? 'modified' : sortMode
  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    const notes = (snapshot?.notes ?? []).filter(note => {
      if ((note.deletedAt !== null) !== (view === 'trash')) return false
      if (folderFilter === '__unfiled__' && note.folderId !== null) return false
      if (!folderFilter.startsWith('__') && note.folderId !== folderFilter) return false
      return !normalized || note.title.toLocaleLowerCase().includes(normalized) || note.text.toLocaleLowerCase().includes(normalized)
    })
    const sorted = sortNotes(notes, effectiveSort, query)
    if (view !== 'recent' || normalized) return sorted
    return [...sorted.filter(note => note.pinned), ...sorted.filter(note => !note.pinned).slice(0, 5)]
  }, [snapshot, view, folderFilter, query, effectiveSort])

  useEffect(() => { setSelectedIds(new Set()); setSelectMode(false); setContextPosition(null) }, [view, folderFilter, query])

  const folderMenuItems: ActionMenuItem[] = [
    { label: copy('新建文件夹', 'New folder'), icon: 'new-folder', disabled: busy,
      onSelect: () => { setFolderForm('create'); setFolderName(''); setFolderDeleteConfirm(false) } },
    ...(actualFolder ? [
      { label: copy('重命名文件夹', 'Rename folder'), icon: 'format' as const, disabled: busy,
        onSelect: () => { setFolderForm('rename'); setFolderName(actualFolder.name); setFolderDeleteConfirm(false) } },
      { label: copy('删除文件夹', 'Delete folder'), icon: 'trash' as const, danger: true, disabled: busy,
        onSelect: () => { setFolderForm(null); setFolderDeleteConfirm(true) } },
    ] : []),
  ]
  const listMenuItems: ActionMenuItem[] = [
    ...(['modified', 'created', 'title'] as NoteSortMode[]).map(item => ({
      label: item === 'modified' ? copy('按修改时间', 'Last modified') : item === 'created' ? copy('按创建时间', 'Date created') : copy('按标题', 'Title'),
      checked: effectiveSort === item, disabled: view === 'recent' && !query.trim(), onSelect: () => setSortMode(item),
    })),
    { label: selectMode ? copy('结束多选', 'Finish selection') : copy('选择笔记', 'Select notes'), icon: 'checklist', disabled: view === 'trash',
      onSelect: () => { setSelectMode(value => !value); setSelectedIds(new Set()) } },
  ]

  const menuItems: ActionMenuItem[] = draft ? [
    { label: draft.pinned ? copy('取消置顶', 'Unpin') : copy('置顶', 'Pin'), icon: 'pin', onSelect: () => patchDraft({ pinned: !draftRef.current?.pinned }), disabled: busy || selectedDeleted },
    { label: copy('移动到文件夹…', 'Move to folder…'), icon: 'folder', onSelect: () => { setMoveFolder(draftRef.current?.folderId ?? ''); setMoveOpen(true) }, disabled: busy || selectedDeleted },
    { label: copy('复制笔记', 'Duplicate note'), icon: 'duplicate', onSelect: duplicateNote, disabled: busy },
    { label: copy('移到回收站', 'Move to Trash'), icon: 'trash', onSelect: () => setDeleteConfirm(true), disabled: busy || selectedDeleted, danger: true },
    { label: copy('摘录到随记…', 'Capture text…'), icon: 'capture', onSelect: openCapture, disabled: busy },
    ...(['md', 'txt', 'pdf', 'docx'] as ExportFormat[]).map(format => ({ label: copy(`导出 ${format === 'docx' ? 'Word（DOCX）' : format === 'md' ? 'Markdown' : format.toUpperCase()}`, `Export ${format === 'md' ? 'Markdown' : format.toUpperCase()}`), icon: 'export' as const, onSelect: () => exportCurrent(format), disabled: busy || uploadBusy })),
  ] : []

  const saveLabel = selectedStatus?.phase === 'saving' ? copy('保存中…', 'Saving…')
    : selectedStatus?.phase === 'error' ? copy('保存失败', 'Save failed')
      : selectedStatus?.phase === 'conflict' ? copy('草稿已保留', 'Draft kept')
        : draft?.dirty ? copy('未保存', 'Unsaved') : copy('已保存', 'Saved')

  const listPanel = (
    <aside className="jot-list-panel" aria-label={copy('笔记列表', 'Notes')}>
      <div className="jot-list-controls">
        {(mode === 'wide' || searchOpen) && (
          <div className="jot-search">
            <Icon name="search" />
            <input ref={searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder={copy('搜索笔记', 'Search notes')} aria-label={copy('搜索笔记', 'Search notes')} />
          </div>
        )}
        <div className="jot-folder-line">
          {Boolean(snapshot?.folders.length) && <select className="jot-select" aria-label={copy('筛选文件夹', 'Filter folders')} value={folderFilter}
            onChange={event => { setFolderFilter(event.target.value); setFolderForm(null); setFolderDeleteConfirm(false) }}>
            <option value="__all__">{copy('全部文件夹', 'All folders')}</option>
            <option value="__unfiled__">{copy('未分类', 'Unfiled')}</option>
            {snapshot?.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>}
          {!snapshot?.folders.length && <span className="jot-folder-placeholder">{copy('文件夹（可选）', 'Folders (optional)')}</span>}
          <ActionMenu triggerLabel={copy('文件夹操作', 'Folder actions')} triggerIcon="folder" items={folderMenuItems} />
        </div>
        {folderForm && <form className="jot-folder-form" onSubmit={event => {
          event.preventDefault()
          if (!folderName.trim()) return
          void perform(async () => {
            if (folderForm === 'rename' && actualFolder) await api.updateFolder(actualFolder.id, folderName.trim())
            else {
              const created = await api.createFolder(folderName.trim())
              await refresh()
              setFolderFilter(created.id)
            }
            if (folderForm === 'rename' && actualFolder) await refresh()
            setFolderForm(null)
          })
        }}>
          <input autoFocus value={folderName} onChange={event => setFolderName(event.target.value)} maxLength={80}
            placeholder={copy('文件夹名称', 'Folder name')} aria-label={copy('文件夹名称', 'Folder name')}
            onKeyDown={event => { if (event.key === 'Escape') setFolderForm(null) }} />
          <button className="jot-btn" type="submit" disabled={busy || !folderName.trim()}>{copy('保存', 'Save')}</button>
          <button className="jot-text-btn" type="button" onClick={() => setFolderForm(null)}>{copy('取消', 'Cancel')}</button>
        </form>}
        {folderDeleteConfirm && actualFolder && <div className="jot-notice" style={{ margin: 0 }}>
          <p>{copy('删除文件夹，保留里面的笔记？', 'Delete this folder and keep its notes?')}</p>
          <div className="jot-notice-actions">
            <button className="jot-text-btn jot-danger" type="button" disabled={busy} onClick={() => void perform(async () => {
              await api.deleteFolder(actualFolder.id); setFolderFilter('__all__'); setFolderDeleteConfirm(false); await refresh()
            })}>{copy('删除', 'Delete')}</button>
            <button className="jot-text-btn" type="button" onClick={() => setFolderDeleteConfirm(false)}>{copy('取消', 'Cancel')}</button>
          </div>
        </div>}
        <div className="jot-browse-line"><div className="jot-view-line">
          {(['recent', 'all', 'trash'] as const).map(item => <button type="button" key={item} aria-pressed={view === item}
            onClick={() => { setView(item); setQuery('') }}>
            {item === 'recent' ? copy('最近', 'Recent') : item === 'all' ? copy('全部', 'All') : copy('回收站', 'Trash')}
          </button>)}
        </div><ActionMenu triggerLabel={copy('列表选项', 'List options')} items={listMenuItems} /></div>
      </div>
      {selectMode && <div className="jot-selection-bar">
        <span>{copy(`已选择 ${selectedIds.size} 条`, `${selectedIds.size} selected`)}</span>
        <button className="jot-text-btn" type="button" onClick={() => setSelectedIds(new Set(visibleNotes.map(note => note.id)))}>{copy('全选', 'Select all')}</button>
        <button className="jot-text-btn" type="button" disabled={busy || !selectedIds.size} onClick={() => { setMoveFolder(''); setMoveOpen(true) }}>{copy('移动', 'Move')}</button>
        <button className="jot-text-btn jot-danger" type="button" disabled={busy || !selectedIds.size} onClick={() => setBulkDeleteOpen(true)}>{copy('移到回收站', 'Trash')}</button>
      </div>}
      <div className="jot-list-label jot-list-count"><span>{query ? copy('搜索结果', 'Search results') : view === 'recent' ? copy('最近修改', 'Recently edited') : view === 'trash' ? copy('已删除', 'Deleted notes') : copy('所有笔记', 'All notes')}</span><span>{visibleNotes.length}</span></div>
      {visibleNotes.length > 0 ? <NoteList key={`${folderFilter}:${effectiveSort}`} notes={visibleNotes} selectedId={draft?.noteId} onSelect={selectNote}
        selectMode={selectMode} selectedNoteIds={selectedIds} onToggleSelection={toggleSelection}
        hideFolderName={folderFilter !== '__all__'}
        onContextMenu={(note, event) => { event.preventDefault(); if (!selectMode) { selectNote(note); setContextPosition({ x: event.clientX, y: event.clientY }) } }}
        dateBasis={effectiveSort === 'title' ? 'none' : effectiveSort} query={query} folders={snapshot?.folders} locale={locale} view={view} /> : <div className="jot-note-list">
        {visibleNotes.length === 0 && <div className="jot-empty">
          <div className="jot-empty-title">{query ? copy('没有找到笔记', 'No notes found') : view === 'trash' ? copy('回收站是空的', 'Trash is empty') : copy('留一点想法在这里', 'Leave a thought here')}</div>
          <p>{query ? copy('试试其他关键词', 'Try another search') : view === 'trash' ? '' : copy('一句提醒，一张清单，或者还没想完的事。', 'A reminder, a list, or something still taking shape.')}</p>
          {!query && view !== 'trash' && <button className="jot-btn" type="button" onClick={newNote} disabled={busy}>{copy('新建笔记', 'New note')}</button>}
        </div>}
      </div>}
      <div className="jot-agent-line">
        <span title={copy('开启后，AI 可以读取和修改笔记。', 'When enabled, AI can read and edit notes.')}>{copy('允许 AI 协作', 'Allow AI collaboration')}</span>
        <button type="button" className="jot-switch" role="switch" aria-checked={snapshot?.agentEnabled ?? false} disabled={busy}
          aria-label={copy('允许 AI 协作', 'Allow AI collaboration')} onClick={() => void perform(async () => {
            await api.setAgentEnabled(!snapshot?.agentEnabled); await refresh()
          })} />
      </div>
    </aside>
  )

  const editorPanel = (
    <section className="jot-editor-panel" aria-label={copy('笔记', 'Note')}>
      {draft ? <>
        <div className="jot-editor-toolbar jot-context-toolbar">
          {Boolean(snapshot?.folders.length) && <select className="jot-select" value={draft.folderId ?? ''} disabled={selectedDeleted} aria-label={copy('笔记文件夹', 'Note folder')}
            onChange={event => patchDraft({ folderId: event.target.value || null })}>
            <option value="">{copy('未分类', 'Unfiled')}</option>
            {snapshot?.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>}
          <span className={`jot-save-label${selectedStatus?.phase === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite" title={saveLabel}>{saveLabel}</span>
        <div className="jot-document-actions">
          {!selectedDeleted && <>
            <button className="jot-icon-btn" type="button" aria-label={copy('添加图片或附件', 'Add image or attachment')} title={copy('添加图片或附件', 'Add image or attachment')}
              disabled={uploadBusy} onClick={() => fileInput.current?.click()}><Icon name="attach" /></button>
            <ActionMenu triggerLabel={copy('更多笔记操作', 'More note actions')} items={menuItems} />
            <button className="jot-icon-btn jot-save-button" type="button" aria-label={copy('保存', 'Save')} title={copy('保存', 'Save')}
              disabled={!draft.dirty || selectedStatus?.phase === 'saving'} onClick={() => void saveDraft(draft.noteId)}><Icon name="save" /></button>
          </>}
          {selectedDeleted && <ActionMenu triggerLabel={copy('更多笔记操作', 'More note actions')} items={menuItems} />}
          {selectedDeleted && <button className="jot-btn" type="button" disabled={busy} onClick={() => void perform(async () => {
            if (!selectedNote) return
            await api.restoreNote(selectedNote.id, selectedNote.revision); await refresh(); setView('all')
          })}>{copy('恢复笔记', 'Restore note')}</button>}
        </div>
        </div>
        {deleteConfirm && <div className="jot-notice">
          <p>{copy('把这条笔记移到回收站？', 'Move this note to trash?')}</p>
          <div className="jot-notice-actions">
            <button className="jot-text-btn jot-danger" type="button" disabled={busy} onClick={removeNote}>{copy('移到回收站', 'Move to trash')}</button>
            <button className="jot-text-btn" type="button" onClick={() => setDeleteConfirm(false)}>{copy('取消', 'Cancel')}</button>
          </div>
        </div>}
        {selectedStatus?.phase === 'conflict' && <div className="jot-notice" role="status">
          <p>{copy('这条笔记有新版本，你的草稿已保留。', 'This note has a newer version. Your draft is still here.')}</p>
          <div className="jot-notice-actions">
            <button className="jot-text-btn" type="button" disabled={busy} onClick={loadLatest}>{copy('载入最新版本', 'Load latest version')}</button>
            <button className="jot-text-btn" type="button" disabled={busy} onClick={saveAsNew}>{copy('将草稿另存为新笔记', 'Save draft as a new note')}</button>
          </div>
        </div>}
        {(recoveries.length > 1 || recoveries.some(item => item.draftId !== draft.draftId)) && <div className="jot-notice">
          <label>{copy('保留的草稿', 'Kept drafts')}
            <select className="jot-select" aria-label={copy('切换保留的草稿', 'Choose a kept draft')} value={draft.draftId ?? ''}
              onChange={event => {
                const selected = recoveries.find(item => item.draftId === event.target.value)
                if (!selected) return
                selectionGeneration.current++
                installDraft(selected)
                setStatus(selected.noteId, { phase: selectedNote && selected.baseRevision === selectedNote.revision && !selectedNote.deletedAt ? 'dirty' : 'conflict' })
              }}>
              {!draft.draftId && <option value="">{copy('当前版本', 'Current version')}</option>}
              {recoveries.map((item, index) => <option key={item.draftId} value={item.draftId}>{`${copy('草稿', 'Draft')} ${index + 1} · ${item.title || copy('无标题', 'Untitled')}`}</option>)}
            </select>
          </label>
        </div>}
        {selectedStatus?.phase === 'error' && <div className="jot-notice" role="alert">
          <p>{copy('暂时没能保存，内容仍保留在这里。', 'Could not save right now. Your changes are still here.')}</p>
          <button className="jot-text-btn" type="button" onClick={() => void saveDraft(draft.noteId)}>{copy('重试保存', 'Try saving again')}</button>
        </div>}
        {selectedDeleted && <div className="jot-notice">{copy('这条笔记在回收站中，恢复后可以继续编辑。', 'This note is in Trash. Restore it to edit again.')}</div>}
        <div className="jot-editor-body">
          <input className="jot-title-input" value={draft.title} readOnly={selectedDeleted} maxLength={240}
            placeholder={copy('无标题', 'Untitled')} aria-label={copy('笔记标题', 'Note title')} onChange={event => patchDraft({ title: event.target.value })} />
          <RichEditor key={draft.noteId} value={draft.content} locale={locale} readOnly={selectedDeleted}
            onReady={actions => { releaseEditorFocus(); editorActions.current = actions }}
            onChange={content => patchDraft({ content })} />
        </div>
      </> : <div className="jot-empty" style={{ margin: 'auto' }}>
        <div className="jot-empty-title">{copy('随时记，慢慢想', 'A place to keep your thoughts')}</div>
        <p>{copy('选一条笔记继续，或者记下新的想法。', 'Open a note, or start with a new thought.')}</p>
        <button className="jot-btn" type="button" onClick={newNote} disabled={busy}>{copy('新建笔记', 'New note')}</button>
      </div>}
    </section>
  )

  return <div className={`jot-app jot-${mode}${chromeInset ? ' jot-host-chrome' : ''}`} lang={en ? 'en' : 'zh-CN'}
    onFocusCapture={event => {
      releaseEditorFocus()
      if (!selectedDeleted && editorActions.current && (event.target as HTMLElement).closest('.ProseMirror')) {
        try { editorFocusLease.current = onEditorFocus?.(editorActions.current) ?? null }
        catch { setError(copy('快捷键暂时不可用，请使用格式按钮。', 'Shortcuts are unavailable; use the formatting buttons.')) }
      }
    }} onBlurCapture={releaseEditorFocus}
    onKeyDownCapture={event => {
      if ((event.target as HTMLElement).closest('[role="dialog"],[role="menu"]')) return
      const action = appShortcut(event.nativeEvent)
      if (!action || !draft) return
      if (action === 'save' && !selectedDeleted) { event.preventDefault(); event.stopPropagation(); void saveDraft(draft.noteId) }
      else if (action === 'find') {
        const target = event.currentTarget.querySelector('.jot-rich-editor')
        if (target && editorActions.current?.handleShortcut('find', target)) { event.preventDefault(); event.stopPropagation() }
      }
    }} onPasteCapture={event => {
      if ((event.target as HTMLElement).closest('[role="dialog"]') || !(event.target as HTMLElement).closest('.ProseMirror') || selectedDeleted) return
      const files = [...event.clipboardData.files]
      if (files.length) { event.preventDefault(); event.stopPropagation(); void uploadFiles(files) }
    }} onDragOver={event => {
      if (!(event.target as HTMLElement).closest('[role="dialog"]') && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) }
    }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
    onDrop={event => {
      if ((event.target as HTMLElement).closest('[role="dialog"]') || !event.dataTransfer.files.length) return
      event.preventDefault(); event.stopPropagation(); setDragging(false)
      const id = (event.target as Element).closest('[data-note-id]')?.getAttribute('data-note-id')
      const target = id ? snapshotRef.current?.notes.find(note => note.id === id) : null
      if (target) selectNote(target)
      else if (mode === 'compact' && !compactEditor) {
        setError(copy('请先打开目标笔记，再拖入文件。', 'Open the target note before dropping files.')); return
      }
      void uploadFiles([...event.dataTransfer.files])
    }} onClickCapture={event => {
      const element = (event.target as Element).closest('[data-jot-attachment-id]')
      const id = element?.getAttribute('data-jot-attachment-id')
      if (id && /^[a-f0-9]{32}$/.test(id)) { event.preventDefault(); event.stopPropagation(); previewAttachment(id) }
    }}>
    <style>{jotStyles}</style>
    <input ref={fileInput} type="file" multiple hidden aria-label={copy('选择附件', 'Choose attachments')}
      onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void uploadFiles(files) }} />
    {mode === 'wide' && <header className="jot-workbench-header" data-window-drag={chromeInset ? '' : undefined} aria-label={copy('随记工具栏', 'Jot toolbar')}>
      <JotIcon size={20} />
      <span className="jot-brand">{copy('随记', 'Jot')}</span>
      <button className="jot-icon-btn" type="button" onClick={newNote} disabled={busy} aria-label={copy('新建笔记', 'New note')} title={copy('新建笔记', 'New note')}><Icon name="new" /></button>
      <button className="jot-icon-btn" type="button" onMouseDown={event => event.preventDefault()} onClick={openCapture} aria-label={copy('摘录到随记', 'Capture text')} title={copy('摘录到随记', 'Capture text')}><Icon name="capture" /></button>
    </header>}
    {mode === 'compact' && <header className="jot-topbar" aria-label={copy('笔记工具栏', 'Notes toolbar')}>
      {compactEditor && draft ? <button className="jot-back" type="button" onClick={goToList}><Icon name="back" />{copy('笔记', 'Notes')}</button>
        : <><span className="jot-toolbar-label">{copy('笔记', 'Notes')}</span><button className="jot-icon-btn" type="button" onMouseDown={event => event.preventDefault()} onClick={openCapture} aria-label={copy('摘录到随记', 'Capture text')} title={copy('摘录到随记', 'Capture text')}><Icon name="capture" /></button></>}
      <div className="jot-toolbar-end">
      <button className="jot-icon-btn" type="button" onClick={newNote} disabled={busy} aria-label={copy('新建笔记', 'New note')} title={copy('新建笔记', 'New note')}><Icon name="new" /></button>
      <button className="jot-icon-btn" type="button" onClick={openSearch} aria-label={copy('搜索', 'Search')} title={copy('搜索', 'Search')}><Icon name="search" /></button>
      {onExpand && <button className="jot-icon-btn" type="button" onClick={() => {
        const current = compactEditor ? draftRef.current : null
        if (current) installDraft(current)
        const source = current ? draftRef.current : null
        onExpand(source?.noteId, source?.draftId, source?.baseRevision)
      }} aria-label={copy('打开完整笔记页', 'Open full notes')} title={copy('打开完整笔记页', 'Open full notes')}><Icon name="expand" /></button>}
      </div>
    </header>}
    {error && <div className="jot-global-error" role="alert">{copy('操作未完成：', 'Operation did not complete: ')}{error} <button className="jot-text-btn" type="button" onClick={() => { setError(''); void refresh().catch(cause => setError(String(cause))) }}>{copy('刷新', 'Refresh')}</button></div>}
    {notice && <div className="jot-notice" role="status">{notice}<button className="jot-text-btn" type="button" onClick={() => setNotice('')}>{copy('关闭', 'Close')}</button></div>}
    {uploadBusy && <div className="jot-upload-line" role="status">{copy('正在添加附件…', 'Adding files…')}</div>}
    {dragging && <div className="jot-drop-hint">{copy('松开以添加到笔记', 'Drop files into the note')}</div>}
    {!snapshot ? <div className="jot-loading" role="status">{copy('正在打开随记…', 'Opening Jot…')}</div>
      : <main className="jot-layout">{mode === 'wide' ? <>{listPanel}{editorPanel}</> : compactEditor ? editorPanel : listPanel}</main>}
    {contextPosition && draft && <ActionMenu triggerLabel={copy('笔记菜单', 'Note menu')} items={menuItems} position={contextPosition} onClose={() => setContextPosition(null)} />}
    {captureOpen && <Modal title={copy('摘录到随记', 'Capture text')} closeLabel={copy('关闭', 'Close')} onClose={() => { if (!busy) setCaptureOpen(false) }}>
      <CaptureDialog notes={snapshot?.notes ?? []} capturedText={captureText} source={captureSource} locale={locale} busy={busy} error={captureError}
        onSubmit={capture} onClose={() => setCaptureOpen(false)} />
    </Modal>}
    {moveOpen && <Modal title={copy(selectMode ? '移动所选笔记' : '移动笔记', selectMode ? 'Move selected notes' : 'Move note')} closeLabel={copy('关闭', 'Close')} onClose={() => { if (!busy) setMoveOpen(false) }}>
      <label>{copy('目标文件夹', 'Destination folder')}<select className="jot-select" value={moveFolder} onChange={event => setMoveFolder(event.target.value)} aria-label={copy('目标文件夹', 'Destination folder')}>
        <option value="">{copy('未分类', 'Unfiled')}</option>{snapshot?.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select></label>
      <div className="jot-modal-footer"><button type="button" className="jot-btn" disabled={busy} onClick={moveSelected}>{copy('移动', 'Move')}</button></div>
    </Modal>}
    {bulkDeleteOpen && <Modal title={copy('移到回收站', 'Move to Trash')} closeLabel={copy('关闭', 'Close')} onClose={() => { if (!busy) setBulkDeleteOpen(false) }}>
      <p>{copy(`把所选 ${selectedIds.size} 条笔记移到回收站？之后可以恢复。`, `Move ${selectedIds.size} notes to Trash? They can be restored.`)}</p>
      <div className="jot-modal-footer"><button type="button" className="jot-btn" disabled={busy} onClick={deleteSelected}>{copy('移到回收站', 'Move to Trash')}</button></div>
    </Modal>}
    {attachmentPreview && <AttachmentPreview attachment={attachmentPreview} onClose={() => setAttachmentPreview(null)} locale={locale}
      getCapabilities={api.getAttachmentCapabilities} onOpenNative={api.openAttachment ? signal => api.openAttachment!(attachmentPreview.id, { signal }) : undefined} />}
  </div>
}

export default JotApp
