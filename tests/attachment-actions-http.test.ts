import assert from 'node:assert/strict'
import { createServer, request as nodeRequest, type IncomingMessage } from 'node:http'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { AttachmentStore } from '../src/attachments.js'
import { createAttachmentActions, type AttachmentActions } from '../src/attachment-actions.js'
import { createJotHandler } from '../src/http.js'
import { JotStore } from '../src/store.js'

async function fixture(t: TestContext, options: {
  enabled?: boolean
  available?: boolean
  onOpen?: (path: string, signal: AbortSignal) => Promise<void>
  makeActions?: (attachments: AttachmentStore) => AttachmentActions
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-jot-attachment-http-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new JotStore({ directory: root })
  const attachments = new AttachmentStore({ directory: root })
  const opened: { path: string; signal: AbortSignal }[] = []
  const actions = options.enabled === false ? undefined : options.makeActions?.(attachments) ?? createAttachmentActions(attachments, {
    canOpenNativePath: () => options.available !== false,
    openNativeAssociatedPath: async (path, signal) => { opened.push({ path, signal }); await options.onOpen?.(path, signal) },
  })
  let authority = ''
  const authorize = (request: IncomingMessage) => request.headers.host !== authority ? 403
    : request.headers.cookie === 'jot-test-session=valid' ? undefined : 401
  const server = createServer(createJotHandler(store, { authorize, attachments, actions }))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  authority = `127.0.0.1:${address.port}`
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })
  const headers = { origin: base, cookie: 'jot-test-session=valid', 'content-type': 'application/json' }
  const post = (id: string, action: 'preview' | 'open', body: unknown = {}, extra: Record<string, string> = {}) => fetch(`${base}/jot/api/attachments/${id}/${action}`, {
    method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body),
  })
  return { root, base, headers, post, attachments, opened }
}

test('standalone HTTP servers explicitly disable native attachment actions', async t => {
  const { base, headers, attachments, post, opened } = await fixture(t, { enabled: false })
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('report') })
  const capabilities = await fetch(`${base}/jot/api/attachment-capabilities`, { headers })
  assert.equal(capabilities.status, 200)
  assert.deepEqual(await capabilities.json(), { data: { nativeOpen: false } })
  for (const action of ['preview', 'open'] as const) {
    const response = await post(attachment.id, action)
    assert.equal(response.status, 409)
    assert.equal((await response.json()).error.code, 'ATTACHMENT_ACTIONS_UNAVAILABLE')
  }
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  assert.equal(opened.length, 0)
})

test('attachment capabilities and every action require authentication and same-origin requests', async t => {
  const { base, headers, attachments, post, opened } = await fixture(t)
  const attachment = await attachments.upload({ name: 'private.docx', bytes: Buffer.from('private') })
  const capabilityUrl = `${base}/jot/api/attachment-capabilities`
  for (const extra of [{ cookie: '' }, { origin: 'https://foreign.invalid' }, { 'sec-fetch-site': 'cross-site' }] as Record<string, string>[]) {
    const expected = extra.cookie === '' ? 401 : 403
    const capabilities = await fetch(capabilityUrl, { headers: { ...headers, ...extra } })
    assert.equal(capabilities.status, expected)
    await capabilities.arrayBuffer()
    for (const action of ['preview', 'open'] as const) {
      const response = await post(attachment.id, action, {}, extra)
      assert.equal(response.status, expected)
      await response.arrayBuffer()
    }
  }
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  assert.equal(opened.length, 0)
})

test('attachment action endpoints are POST-only and capabilities are GET-only', async t => {
  const { base, headers, attachments, opened } = await fixture(t)
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('report') })
  for (const action of ['preview', 'open']) {
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) {
      const response = await fetch(`${base}/jot/api/attachments/${attachment.id}/${action}`, { headers, method })
      assert.equal(response.status, 405)
      assert.equal(response.headers.get('allow'), 'POST')
      await response.arrayBuffer()
    }
  }
  const capabilities = await fetch(`${base}/jot/api/attachment-capabilities`, { headers, method: 'POST', body: '{}' })
  assert.equal(capabilities.status, 405)
  assert.equal(capabilities.headers.get('allow'), 'GET')
  await capabilities.arrayBuffer()
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  assert.equal(opened.length, 0)
})

test('only an empty JSON object is accepted; clients cannot select paths, applications or URLs', async t => {
  const { attachments, post, opened } = await fixture(t)
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('report') })
  for (const action of ['preview', 'open'] as const) {
    for (const body of [{ path: '/private/secret.docx' }, { application: '/Applications/Editor.app' }, { url: 'file:///private/secret.docx' }, { id: attachment.id }, [], null, 'text']) {
      const response = await post(attachment.id, action, body)
      assert.equal(response.status, 400)
      await response.arrayBuffer()
    }
    const wrongType = await post(attachment.id, action, {}, { 'content-type': 'text/plain' })
    assert.equal(wrongType.status, 415)
    await wrongType.arrayBuffer()
  }
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  assert.equal(opened.length, 0)
})

test('invalid, missing and corrupted IDs cannot reach native opening through HTTP', async t => {
  const { attachments, post, opened } = await fixture(t)
  for (const action of ['preview', 'open'] as const) {
    for (const id of ['not-an-id', 'A'.repeat(32), '%2Fprivate%2Fsecret.docx', '%E0%A4%A']) {
      const response = await post(id, action)
      assert.equal(response.status, 400)
      await response.arrayBuffer()
    }
    const missing = await post('f'.repeat(32), action)
    assert.equal(missing.status, 404)
    assert.equal((await missing.json()).error.code, 'ATTACHMENT_NOT_FOUND')
  }
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('original') })
  await writeFile(join(attachments.directory, `${attachment.id}.blob`), 'modified')
  for (const action of ['preview', 'open'] as const) {
    const response = await post(attachment.id, action)
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error.code, 'CORRUPT_ATTACHMENTS')
  }
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  assert.equal(opened.length, 0)
})

test('authorized preview returns one verified projection and native opening uses that file', async t => {
  const { base, headers, attachments, post, opened } = await fixture(t)
  const bytes = Buffer.from('document bytes')
  const attachment = await attachments.upload({ name: '会议.docx', bytes })
  const capabilities = await fetch(`${base}/jot/api/attachment-capabilities`, { headers })
  assert.deepEqual(await capabilities.json(), { data: { nativeOpen: true } })
  const preview = await post(attachment.id, 'preview')
  assert.equal(preview.status, 200)
  assert.equal(preview.headers.get('cache-control'), 'no-store')
  const { data } = await preview.json()
  assert.deepEqual(Object.keys(data), ['path'])
  assert.equal(basename(data.path), attachment.name)
  assert.deepEqual(await readFile(data.path), bytes)
  const opening = await post(attachment.id, 'open')
  assert.equal(opening.status, 200)
  assert.deepEqual(await opening.json(), { data: null })
  assert.equal(opened.length, 1)
  assert.equal(opened[0]!.path, data.path)
  assert.equal(opened[0]!.signal.aborted, false)
})

test('a Host without a desktop still permits preview but refuses native opening without creating another cache', async t => {
  const { base, headers, attachments, post, opened } = await fixture(t, { available: false })
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('report') })
  const capabilities = await fetch(`${base}/jot/api/attachment-capabilities`, { headers })
  assert.deepEqual(await capabilities.json(), { data: { nativeOpen: false } })
  const opening = await post(attachment.id, 'open')
  assert.equal(opening.status, 409)
  assert.equal((await opening.json()).error.code, 'ATTACHMENT_OPEN_UNAVAILABLE')
  assert.ok(!(await readdir(attachments.directory)).includes('.preview'))
  const preview = await post(attachment.id, 'preview')
  assert.equal(preview.status, 200)
  await preview.arrayBuffer()
  assert.equal(opened.length, 0)
})

test('native failures expose only the safe error code and never private paths or process output', async t => {
  const { root, attachments, post } = await fixture(t, { onOpen: async path => { throw new Error(`Cannot execute open for ${path}; secret subprocess output`) } })
  const attachment = await attachments.upload({ name: 'private.docx', bytes: Buffer.from('private') })
  const response = await post(attachment.id, 'open')
  assert.equal(response.status, 502)
  const text = await response.text()
  assert.equal(JSON.parse(text).error.code, 'ATTACHMENT_OPEN_FAILED')
  assert.ok(!text.includes(root))
  assert.ok(!text.includes('private.docx'))
  assert.ok(!text.includes('secret subprocess output'))
})

test('disconnecting while a projection is pending cancels the gesture before any native application starts', async t => {
  let preparing!: () => void
  let finish!: (value: Awaited<ReturnType<AttachmentStore['previewFile']>>) => void
  let requestSignal!: AbortSignal
  let opened = 0
  const ready = new Promise<void>(resolve => { preparing = resolve })
  const pending = new Promise<Awaited<ReturnType<AttachmentStore['previewFile']>>>(resolve => { finish = resolve })
  const { base, headers, attachments } = await fixture(t, {
    makeActions: () => {
      const actions = createAttachmentActions({ previewFile: async () => { preparing(); return pending } }, {
        canOpenNativePath: () => true,
        openNativeAssociatedPath: async () => { opened++ },
      })
      return { ...actions, open: async (id, signal) => { requestSignal = signal; await actions.open(id, signal) } }
    },
  })
  const attachment = await attachments.upload({ name: 'draft.docx', bytes: Buffer.from('draft') })
  const prepared = await attachments.previewFile(attachment.id)
  const outgoing = nodeRequest(`${base}/jot/api/attachments/${attachment.id}/open`, { method: 'POST', headers }, response => response.resume())
  outgoing.on('error', () => {})
  outgoing.end('{}')
  await ready
  const aborted = new Promise<void>(resolve => requestSignal.addEventListener('abort', () => resolve(), { once: true }))
  outgoing.destroy()
  await aborted
  finish(prepared)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(requestSignal.aborted, true)
  assert.equal(opened, 0)
})
