import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { createJotApi, JotApiError } from '../src/client/api.js'
import type { JotState, Note } from '../src/client/types.js'

function state(revision: number): JotState {
  const at = '2026-10-04T00:00:00.000Z'
  const note: Note = { id: 'test-note', title: `Revision ${revision}`, revision, text: `Body ${revision}`,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Body ${revision}` }] }] },
    folderId: null, pinned: false, createdAt: at, updatedAt: at, deletedAt: null }
  return { version: 1, notes: [note], folders: [], agentEnabled: false }
}

function fixture(t: TestContext) {
  const original = globalThis.fetch
  const requests: Array<{ url: string; init?: RequestInit; resolve(response: Response): void; reject(error: Error): void }> = []
  const waiters: Array<{ index: number; resolve(): void }> = []
  globalThis.fetch = (input, init) => new Promise<Response>((resolve, reject) => {
    requests.push({ url: String(input), init, resolve, reject })
    for (const waiter of waiters) if (requests.length > waiter.index) waiter.resolve()
  })
  t.after(() => { globalThis.fetch = original })
  const respond = (index: number, data: unknown, tag: string | null = null, status = 200) => {
    const headers = new Headers()
    if (tag !== null) headers.set('etag', tag)
    requests[index]!.resolve(new Response(status === 304 ? null : JSON.stringify({ data }), { status, headers }))
  }
  return { api: createJotApi('/synthetic'), requests, respond,
    unchanged: (index: number, tag: string) => respond(index, undefined, tag, 304),
    waitFor(index: number) {
      return requests.length > index ? Promise.resolve() : new Promise<void>(resolve => { waiters.push({ index, resolve }) })
    },
    tag: (index: number) => new Headers(requests[index]!.init?.headers).get('if-none-match'),
  }
}

test('a late older state cannot replace a newer successful snapshot or its conditional tag', async t => {
  const { api, respond, unchanged, tag } = fixture(t)
  const older = api.getState(), newer = api.getState()
  respond(1, state(2), '"new"')
  const accepted = await newer
  respond(0, state(1), '"old"')
  assert.equal(await older, accepted)
  const next = api.getState()
  assert.equal(tag(2), '"new"')
  unchanged(2, '"new"')
  assert.equal(await next, accepted)
})

test('a late older 304 keeps the newer snapshot accepted while it waited', async t => {
  const { api, respond, unchanged } = fixture(t)
  const initial = api.getState()
  respond(0, state(1), '"old"'); await initial
  const older = api.getState(), newer = api.getState()
  respond(2, state(2), '"new"')
  const accepted = await newer
  unchanged(1, '"old"')
  assert.equal(await older, accepted)
})

test('a newer 304 cannot undo an intervening successful 200 for a different snapshot', async t => {
  const { api, respond, unchanged, tag } = fixture(t)
  const initial = api.getState()
  respond(0, state(1), '"old"'); await initial
  const older = api.getState(), newer = api.getState()
  assert.equal(tag(1), '"old"'); assert.equal(tag(2), '"old"')
  respond(1, state(2), '"new"')
  const accepted = await older
  unchanged(2, '"old"')
  assert.equal(await newer, accepted)
  const next = api.getState()
  assert.equal(tag(3), '"new"')
  unchanged(3, '"new"'); assert.equal(await next, accepted)
})

test('an older success can initialize the library when the newer request fails', async t => {
  const { api, requests, respond, unchanged, tag } = fixture(t)
  const older = api.getState(), newer = api.getState()
  const failed = assert.rejects(newer, /offline/u)
  requests[1]!.reject(new Error('offline')); await failed
  respond(0, state(1), '"old"')
  const accepted = await older
  assert.equal(accepted.notes[0]!.revision, 1)
  const next = api.getState()
  assert.equal(tag(2), '"old"')
  unchanged(2, '"old"'); assert.equal(await next, accepted)
})

test('a missing snapshot is a failure and does not prevent an older successful initialization', async t => {
  const { api, respond } = fixture(t)
  const older = api.getState(), newer = api.getState()
  const failed = assert.rejects(newer, error => error instanceof JotApiError && error.code === 'REQUEST_FAILED')
  respond(1, null); await failed
  respond(0, state(1), '"old"')
  assert.equal((await older).notes[0]!.revision, 1)
})

test('response ordering remains safe even when the Host omits ETag', async t => {
  const { api, respond, tag } = fixture(t)
  const older = api.getState(), newer = api.getState()
  respond(1, state(2))
  const accepted = await newer
  respond(0, state(1), '"old"'); assert.equal(await older, accepted)
  const next = api.getState()
  assert.equal(tag(2), null)
  respond(2, state(3)); assert.equal((await next).notes[0]!.revision, 3)
})

for (const status of [200, 304]) {
  test(`a pending ${status} crossing a successful note write must revalidate the library`, async t => {
    const { api, respond, unchanged, waitFor, requests, tag } = fixture(t)
    const initial = api.getState()
    respond(0, state(1), '"old"'); await initial
    const stale = api.getState()
    const mutation = api.updateNote('test-note', { revision: 1, title: 'Saved revision 2' })
    assert.equal(requests[2]!.init?.method, 'PATCH')
    respond(2, state(2).notes[0]); await mutation
    if (status === 304) unchanged(1, '"old"')
    else respond(1, state(1), '"old"')
    await waitFor(3)
    assert.equal(requests[3]!.url, '/synthetic/state')
    assert.equal(tag(3), '"old"')
    respond(3, state(2), '"new"')
    assert.equal((await stale).notes[0]!.revision, 2)
  })
}

test('a failed mutation leaves the pending successful state eligible for acceptance', async t => {
  const { api, requests, respond } = fixture(t)
  const pending = api.getState()
  const mutation = api.updateNote('test-note', { revision: 1, title: 'Rejected' })
  const failed = assert.rejects(mutation, error => error instanceof JotApiError && error.status === 409)
  requests[1]!.resolve(new Response(JSON.stringify({ error: { code: 'REVISION_CONFLICT', message: 'changed' } }), { status: 409 }))
  await failed
  respond(0, state(1), '"old"')
  assert.equal((await pending).notes[0]!.revision, 1)
  assert.equal(requests.length, 2, 'a rejected write does not trigger an extra state request')
})

test('an attachment gesture does not invalidate the notes state', async t => {
  const { api, respond, requests } = fixture(t)
  const pending = api.getState()
  const opening = api.openAttachment!('a'.repeat(32))
  respond(1, null); await opening
  respond(0, state(1), '"old"')
  assert.equal((await pending).notes[0]!.revision, 1)
  assert.equal(requests.length, 2)
})

test('304 without a conditional snapshot fails explicitly instead of returning null or decoding an empty body', async t => {
  const { api, unchanged } = fixture(t)
  const pending = api.getState()
  const failed = assert.rejects(pending, error => error instanceof JotApiError && error.code === 'REQUEST_FAILED')
  unchanged(0, '"unexpected"'); await failed
})
