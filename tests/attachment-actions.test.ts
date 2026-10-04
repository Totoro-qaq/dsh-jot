import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { AttachmentError, AttachmentStore } from '../src/attachments.js'
import { AttachmentActionError, createAttachmentActions, type AttachmentNativeAdapter } from '../src/attachment-actions.js'

const id = 'a'.repeat(32)
const signal = () => new AbortController().signal

async function storeFor(t: TestContext): Promise<AttachmentStore> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-jot-attachment-actions-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return new AttachmentStore({ directory: root })
}

function nativeFor(available = true) {
  const calls: { path: string; signal: AbortSignal }[] = []
  const adapter: AttachmentNativeAdapter = {
    canOpenNativePath: () => available,
    openNativeAssociatedPath: async (path, lifetime) => { calls.push({ path, signal: lifetime }) },
  }
  return { calls, adapter }
}

function actionError(code: string, status: number) {
  return (error: unknown) => error instanceof AttachmentActionError && error.code === code && error.status === status
}

test('desktop capability reads and unsupported opening do not prepare attachment copies', async () => {
  const native = nativeFor(false)
  const actions = createAttachmentActions({ previewFile: async () => { assert.fail('An unavailable desktop must not prepare files') } }, native.adapter)
  assert.deepEqual(actions.capabilities(), { nativeOpen: false })
  await assert.rejects(actions.open(id, signal()), actionError('ATTACHMENT_OPEN_UNAVAILABLE', 409))
  assert.equal(native.calls.length, 0)
})

test('preview preparation returns only the verified managed projection path', async t => {
  const attachments = await storeFor(t)
  const attachment = await attachments.upload({ name: '会议记录.docx', bytes: Buffer.from('document bytes') })
  const native = nativeFor()
  const prepared = await createAttachmentActions(attachments, native.adapter).preparePreview(attachment.id)
  assert.deepEqual(Object.keys(prepared), ['path'])
  assert.equal(basename(prepared.path), attachment.name)
  assert.deepEqual(await readFile(prepared.path), Buffer.from('document bytes'))
  assert.equal(native.calls.length, 0)
})

test('default-application opening passes one managed file path and cancellation signal to the official adapter', async t => {
  const attachments = await storeFor(t)
  const bytes = Buffer.from('document with punctuation')
  const attachment = await attachments.upload({ name: '方案 $(anything); 引号.docx', bytes })
  const native = nativeFor()
  const actions = createAttachmentActions(attachments, native.adapter)
  assert.deepEqual(actions.capabilities(), { nativeOpen: true })
  await actions.open(attachment.id, signal())
  assert.equal(native.calls.length, 1)
  const invocation = native.calls[0]!
  assert.equal(basename(invocation.path), attachment.name)
  assert.deepEqual(await readFile(invocation.path), bytes)
  assert.equal(invocation.signal.aborted, false)
  assert.deepEqual((await attachments.content(attachment.id)).bytes, bytes)
})

test('client paths cannot become attachment IDs or reach projection/native operations', async () => {
  const native = nativeFor()
  const actions = createAttachmentActions({ previewFile: async () => { assert.fail('Invalid IDs must not reach attachment storage') } }, native.adapter)
  for (const invalid of ['../secret.docx', '/private/path.docx', 'C:\\private\\path.docx', 'https://example.test/file', 'A'.repeat(32)]) {
    await assert.rejects(actions.preparePreview(invalid), (error: unknown) => error instanceof AttachmentError && error.status === 400)
    await assert.rejects(actions.open(invalid, signal()), (error: unknown) => error instanceof AttachmentError && error.status === 400)
  }
  assert.equal(native.calls.length, 0)
})

test('missing and altered managed attachments cannot launch an application', async t => {
  const attachments = await storeFor(t)
  const native = nativeFor()
  const actions = createAttachmentActions(attachments, native.adapter)
  await assert.rejects(actions.open('f'.repeat(32), signal()), (error: unknown) => error instanceof AttachmentError && error.status === 404)
  const attachment = await attachments.upload({ name: 'report.docx', bytes: Buffer.from('original') })
  await writeFile(join(attachments.directory, `${attachment.id}.blob`), 'modified')
  await assert.rejects(actions.open(attachment.id, signal()), (error: unknown) => error instanceof AttachmentError && error.code === 'CORRUPT_ATTACHMENTS')
  assert.equal(native.calls.length, 0)
})

test('native failures use safe typed errors without leaking commands, paths or process output', async t => {
  const attachments = await storeFor(t)
  const attachment = await attachments.upload({ name: 'private.docx', bytes: Buffer.from('private') })
  let invokedPath = ''
  const actions = createAttachmentActions(attachments, {
    canOpenNativePath: () => true,
    openNativeAssociatedPath: async path => { invokedPath = path; throw new Error(`open command failed for ${path}; sensitive stderr`) },
  })
  await assert.rejects(actions.open(attachment.id, signal()), (error: unknown) => {
    assert.ok(error instanceof AttachmentActionError)
    assert.equal(error.code, 'ATTACHMENT_OPEN_FAILED')
    assert.equal(error.status, 502)
    assert.ok(!error.message.includes(invokedPath))
    assert.ok(!error.message.includes('sensitive stderr'))
    assert.equal(error.cause, undefined)
    return true
  })
})

test('a request cancelled before opening creates no projection and launches nothing', async () => {
  const native = nativeFor()
  const actions = createAttachmentActions({ previewFile: async () => { assert.fail('A cancelled request must not prepare files') } }, native.adapter)
  const controller = new AbortController()
  controller.abort(new Error('Caller-specific private reason'))
  await assert.rejects(actions.open(id, controller.signal), actionError('ATTACHMENT_OPEN_CANCELLED', 409))
  assert.equal(native.calls.length, 0)
})

test('cancellation during projection prevents a later native launch', async t => {
  const attachments = await storeFor(t)
  const attachment = await attachments.upload({ name: 'draft.docx', bytes: Buffer.from('draft') })
  const prepared = await attachments.previewFile(attachment.id)
  let finish!: (value: typeof prepared) => void
  let started!: () => void
  const preparing = new Promise<void>(resolve => { started = resolve })
  const projection = new Promise<typeof prepared>(resolve => { finish = resolve })
  const native = nativeFor()
  const actions = createAttachmentActions({ previewFile: async () => { started(); return projection } }, native.adapter)
  const controller = new AbortController()
  const opening = actions.open(attachment.id, controller.signal)
  await preparing
  controller.abort()
  await assert.rejects(opening, actionError('ATTACHMENT_OPEN_CANCELLED', 409))
  finish(prepared)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(native.calls.length, 0)
})

test('cancellation reaches the native adapter and does not expose the caller reason', async t => {
  const attachments = await storeFor(t)
  const attachment = await attachments.upload({ name: 'draft.docx', bytes: Buffer.from('draft') })
  let started!: () => void
  let nativeSignal!: AbortSignal
  const launching = new Promise<void>(resolve => { started = resolve })
  const actions = createAttachmentActions(attachments, {
    canOpenNativePath: () => true,
    openNativeAssociatedPath: async (_path, lifetime) => {
      nativeSignal = lifetime
      started()
      return new Promise<void>((_resolve, reject) => lifetime.addEventListener('abort', () => reject(lifetime.reason), { once: true }))
    },
  })
  const controller = new AbortController()
  const opening = actions.open(attachment.id, controller.signal)
  await launching
  controller.abort(new Error('Private caller reason'))
  await assert.rejects(opening, actionError('ATTACHMENT_OPEN_CANCELLED', 409))
  assert.equal(nativeSignal.aborted, true)
})

test('the launch deadline bounds an unresponsive native adapter and aborts its signal', async t => {
  const attachments = await storeFor(t)
  const attachment = await attachments.upload({ name: 'draft.docx', bytes: Buffer.from('draft') })
  const prepared = await attachments.previewFile(attachment.id)
  let nativeSignal: AbortSignal | undefined
  const actions = createAttachmentActions({ previewFile: async () => prepared }, {
    canOpenNativePath: () => true,
    openNativeAssociatedPath: async (_path, lifetime) => { nativeSignal = lifetime; return new Promise<void>(() => {}) },
  }, { timeoutMs: 30 })
  await assert.rejects(actions.open(attachment.id, signal()), actionError('ATTACHMENT_OPEN_TIMEOUT', 504))
  assert.ok(nativeSignal?.aborted)
})

test('unexpected projection failures are safe and never invoke the native adapter', async () => {
  const native = nativeFor()
  const actions = createAttachmentActions({ previewFile: async () => { throw new Error('EACCES /private/data/secret.docx') } }, native.adapter)
  await assert.rejects(actions.preparePreview(id), actionError('ATTACHMENT_PREVIEW_FAILED', 500))
  await assert.rejects(actions.open(id, signal()), actionError('ATTACHMENT_PREVIEW_FAILED', 500))
  assert.equal(native.calls.length, 0)
})
