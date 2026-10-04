import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { test } from 'node:test'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { createHostAttachmentPreview, type HostAttachmentSessionId } from '../src/client/host-attachments.js'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

const firstSession = 'first-session' as HostAttachmentSessionId
const otherSession = 'other-session' as HostAttachmentSessionId
const jotPanel = 'dsh-jot' as MainPanelId
const path = '/notes/想法与方案/文件 #1? 100%.docx'

function fixture(options: { session?: HostAttachmentSessionId; panel?: MainPanelId | null; viewer?: boolean; timeout?: number } = {}) {
  let session: HostAttachmentSessionId | undefined = options.session ?? firstSession
  let panel = options.panel ?? null
  let mounted: HostAttachmentSessionId | undefined = panel === null ? session : undefined
  let preparations = 0
  let selections = 0
  const listeners = new Set<() => void>()
  const opened: { sessionId: HostAttachmentSessionId; address: string }[] = []
  let prepare = async (_id: string, _options: { signal?: AbortSignal }) => ({ path })
  const deps = {
    preparePreview: (id: string, options: { signal?: AbortSignal }) => { preparations++; return prepare(id, options) },
    getSessionId: () => session,
    getPanelId: () => panel,
    selectConversation: () => { selections++; panel = null },
    mounted: {
      getSnapshot: () => mounted,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    openResourceIn: (sessionId: HostAttachmentSessionId, address: string) => { opened.push({ sessionId, address }) },
    canPreview: () => options.viewer ?? true,
    waitTimeoutMs: options.timeout ?? 100,
  }
  return {
    preview: createHostAttachmentPreview(deps), deps, opened, listeners,
    get preparations() { return preparations }, get selections() { return selections },
    setSession(value: HostAttachmentSessionId | undefined) { session = value },
    setPanel(value: MainPanelId | null) { panel = value },
    setPrepare(value: typeof prepare) { prepare = value },
    publish(value: HostAttachmentSessionId | undefined) { mounted = value; for (const listener of listeners) listener() },
  }
}

const nextTurn = () => new Promise<void>(resolve => { setImmediate(resolve) })

test('without a Session, attachment preview falls back without preparing files or creating a conversation', async () => {
  const state = fixture()
  state.setSession(undefined)
  assert.equal(await state.preview.open('attachment'), false)
  assert.equal(state.preparations, 0)
  assert.equal(state.selections, 0)
  assert.deepEqual(state.opened, [])
})

test('an unavailable Host viewer falls back before changing the full-page layout', async () => {
  const state = fixture({ panel: jotPanel, viewer: false })
  assert.equal(await state.preview.open('attachment', { revealConversation: true }), false)
  assert.equal(state.preparations, 1)
  assert.equal(state.selections, 0)
  assert.deepEqual(state.opened, [])
})

test('compact preview uses the captured Session and the official escaped file address', async () => {
  for (const filePath of [path, 'C:\\Notes\\随记\\文件 #1? 100%.docx']) {
    const state = fixture()
    state.setPrepare(async () => ({ path: filePath }))
    assert.equal(await state.preview.open('attachment'), true)
    assert.equal(state.selections, 0)
    assert.equal(state.opened[0]?.sessionId, firstSession)
    assert.deepEqual(parseFileAddress(state.opened[0]!.address), {
      scope: 'session', sessionId: firstSession, path: filePath.replace(/\\/gu, '/'),
    })
    assert.ok(!state.opened[0]!.address.includes('#'), 'A filename fragment must not become a URL fragment')
    assert.ok(!state.opened[0]!.address.includes('?'), 'A filename question mark must not become a URL query')
  }
})

test('switching Session while preparing an attachment never opens it in either Session', async () => {
  const state = fixture()
  let prepared!: (value: { path: string }) => void
  state.setPrepare(() => new Promise(resolve => { prepared = resolve }))
  const opened = state.preview.open('attachment')
  state.setSession(otherSession)
  prepared({ path })
  assert.equal(await opened, false)
  assert.deepEqual(state.opened, [])
})

test('switching the main panel during preparation does not pull the user back into the Conversation', async () => {
  for (const nextPanel of [null, 'another-plugin' as MainPanelId]) {
    const state = fixture({ panel: jotPanel })
    let reveals = 0
    let prepared!: (value: { path: string }) => void
    state.setPrepare(() => new Promise(resolve => { prepared = resolve }))
    const opened = state.preview.open('attachment', { revealConversation: true, onReveal: () => { reveals++ } })
    state.setPanel(nextPanel)
    prepared({ path })
    assert.equal(await opened, false)
    assert.equal(state.selections, 0)
    assert.equal(reveals, 0)
    assert.equal(state.listeners.size, 0)
    assert.deepEqual(state.opened, [])
  }
})

test('full-page navigation waits for its originating Conversation and releases the subscription', async () => {
  const state = fixture({ panel: jotPanel })
  const controller = new AbortController()
  let reveals = 0
  const opened = state.preview.open('attachment', { signal: controller.signal, revealConversation: true,
    onReveal: () => { assert.equal(state.deps.getPanelId(), jotPanel); reveals++ } })
  await nextTurn()
  assert.equal(state.selections, 1)
  assert.equal(reveals, 1)
  assert.equal(state.listeners.size, 1)
  assert.equal(state.opened.length, 0)
  state.publish(firstSession)
  assert.equal(await opened, true)
  assert.equal(state.opened[0]?.sessionId, firstSession)
  assert.equal(state.listeners.size, 0)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  assert.equal(reveals, 1)
})

test('full-page preview does not navigate without an explicit reveal option', async () => {
  const state = fixture({ panel: jotPanel })
  assert.equal(await state.preview.open('attachment'), false)
  assert.equal(state.preparations, 0)
  assert.equal(state.selections, 0)
})

test('a different selected Conversation cancels the wait rather than opening under that Session', async () => {
  const state = fixture({ panel: jotPanel })
  const opened = state.preview.open('attachment', { revealConversation: true })
  await nextTurn()
  state.setSession(otherSession)
  state.publish(otherSession)
  assert.equal(await opened, false)
  assert.equal(state.listeners.size, 0)
  assert.deepEqual(state.opened, [])
})

test('a pre-aborted request does not prepare a preview', async () => {
  const state = fixture()
  const controller = new AbortController()
  controller.abort()
  assert.equal(await state.preview.open('attachment', { signal: controller.signal }), false)
  assert.equal(state.preparations, 0)
})

test('aborting during preparation returns fallback and preserves the supplied cancellation signal', async () => {
  const state = fixture()
  const controller = new AbortController()
  state.setPrepare((_id, options) => new Promise((_resolve, reject) => {
    assert.equal(options.signal, controller.signal)
    options.signal!.addEventListener('abort', () => { reject(options.signal!.reason) }, { once: true })
  }))
  const opened = state.preview.open('attachment', { signal: controller.signal })
  controller.abort()
  assert.equal(await opened, false)
  assert.deepEqual(state.opened, [])
})

test('aborting a mounted Conversation wait removes its subscription and cannot later open the file', async () => {
  const state = fixture({ panel: jotPanel })
  const controller = new AbortController()
  const opened = state.preview.open('attachment', { signal: controller.signal, revealConversation: true })
  await nextTurn()
  assert.equal(state.listeners.size, 1)
  controller.abort()
  assert.equal(await opened, false)
  assert.equal(state.listeners.size, 0)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  state.publish(firstSession)
  assert.deepEqual(state.opened, [])
})

test('a Conversation that never mounts times out and releases its subscription', async () => {
  const state = fixture({ panel: jotPanel, timeout: 10 })
  const controller = new AbortController()
  let reveals = 0
  assert.equal(await state.preview.open('attachment', { signal: controller.signal, revealConversation: true,
    onReveal: () => { reveals++ } }), false)
  assert.equal(reveals, 1)
  assert.equal(state.selections, 1)
  assert.equal(state.listeners.size, 0)
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  state.publish(firstSession)
  assert.deepEqual(state.opened, [])
})

test('a genuine preparation failure reaches the caller without opening or changing layouts', async () => {
  const state = fixture({ panel: jotPanel })
  state.setPrepare(async () => { throw new Error('Managed attachment unavailable') })
  await assert.rejects(state.preview.open('attachment', { revealConversation: true }), /Managed attachment unavailable/)
  assert.equal(state.selections, 0)
  assert.deepEqual(state.opened, [])
})
