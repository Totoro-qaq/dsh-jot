import assert from 'node:assert/strict'
import { createServer, request as nodeRequest, type IncomingMessage } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { createJotHandler, MAX_REQUEST_BYTES } from '../src/http.js'
import { JotStore } from '../src/store.js'
import { MAX_DOC_BYTES, docFromText } from '../src/model.js'

async function fixture(t: TestContext, unauthenticated = false) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-jot-http-'))
  const store = new JotStore({ directory })
  let authority = ''
  // Test the adapter independently; production uses Connection's real signed cookie verifier.
  const authorize = (request: IncomingMessage) => request.headers.host !== authority ? 403
    : request.headers.cookie === 'test-session=valid' ? undefined : 401
  const server = createServer(createJotHandler(store, unauthenticated ? {} : { authorize }))
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  authority = `127.0.0.1:${address.port}`
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()) })
    await rm(directory, { recursive: true, force: true })
  })
  async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
    return fetch(base + '/jot/api' + path, {
      method,
      headers: { cookie: 'test-session=valid', origin: base, ...body === undefined ? {} : { 'content-type': 'application/json' }, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
  return { store, base, request }
}

test('HTTP requires shared application authentication for reads and writes and refuses bad origins', async t => {
  const { store, request, base } = await fixture(t)
  await store.createNote({ title: 'Private', content: docFromText('private body') })
  for (const [path, method, body] of [['/state', 'GET', undefined], ['/notes', 'POST', { title: 'New' }]] as const) {
    const unauthorized = await request(path, method, body, { cookie: '' })
    assert.equal(unauthorized.status, 401)
    assert.ok(!(await unauthorized.text()).includes('private body'))
    const foreign = await request(path, method, body, { origin: 'https://attacker.invalid' })
    assert.equal(foreign.status, 403)
  }
  const nullOrigin = await request('/state', 'GET', undefined, { origin: 'null' })
  assert.equal(nullOrigin.status, 403)
  const crossSite = await request('/state', 'GET', undefined, { 'sec-fetch-site': 'cross-site' })
  assert.equal(crossSite.status, 403)
  const rebound = await request('/state', 'GET', undefined, { host: 'attacker.invalid', origin: 'http://attacker.invalid' })
  assert.equal(rebound.status, 403)
  // Desktop's owned forwarding strips Origin and attaches the shared authentication cookie.
  const desktop = await fetch(base + '/jot/api/notes', { method: 'POST', headers: { cookie: 'test-session=valid', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Desktop' }) })
  assert.equal(desktop.status, 201)
})

test('HTTP is fail-closed without the DSH authorizer', async t => {
  const { request } = await fixture(t, true)
  assert.equal((await request('/state')).status, 401)
  assert.equal((await request('/notes', 'POST', {})).status, 401)
})

test('HTTP validates and persists rich notes, rejects stale revisions, and restores trash', async t => {
  const { request } = await fixture(t)
  const createdResponse = await request('/notes', 'POST', { title: 'Discussion', content: docFromText('Keep this point') })
  assert.equal(createdResponse.status, 201)
  const { data: original } = await createdResponse.json()
  const first = await request(`/notes/${original.id}`, 'PATCH', { revision: original.revision, title: 'Agreed plan' })
  assert.equal(first.status, 200)
  const { data: updated } = await first.json()
  const stale = await request(`/notes/${original.id}`, 'PATCH', { revision: original.revision, title: 'Overwrite' })
  assert.equal(stale.status, 409)
  assert.equal((await stale.json()).error.code, 'REVISION_CONFLICT')
  const read = await request(`/notes/${original.id}`)
  assert.equal((await read.json()).data.title, 'Agreed plan')
  const removed = await request(`/notes/${original.id}`, 'DELETE', { revision: updated.revision })
  assert.equal(removed.status, 200)
  const { data: trash } = await removed.json()
  assert.deepEqual((await (await request('/notes')).json()).data, [])
  assert.equal((await (await request('/notes?trash=1&q=point')).json()).data[0].id, original.id)
  const restore = await request(`/notes/${original.id}/restore`, 'POST', { revision: trash.revision })
  assert.equal(restore.status, 200)
  assert.equal((await restore.json()).data.text, 'Keep this point')
})

test('HTTP saves valid multibyte rich documents larger than 256 KiB', async t => {
  const { request, store } = await fixture(t)
  const text = '记'.repeat(100_000)
  const content = docFromText(text)
  const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8')
  assert.ok(bytes > 256 * 1024)
  assert.ok(bytes < MAX_DOC_BYTES)
  const response = await request('/notes', 'POST', { title: '长文档', content })
  assert.equal(response.status, 201)
  const { data: note } = await response.json()
  assert.equal(note.text, text)
  assert.deepEqual((await store.getNote(note.id)).content, content)
})

test('human HTTP preference toggles agent access without locking out the human UI', async t => {
  const { request, store } = await fixture(t)
  assert.equal((await request('/settings', 'PATCH', { agentEnabled: true })).status, 200)
  assert.equal((await store.readState()).agentEnabled, true)
  const disabled = await request('/settings', 'PATCH', { agentEnabled: false })
  assert.deepEqual((await disabled.json()).data, { agentEnabled: false })
  assert.equal((await request('/state')).status, 200)
  assert.equal((await request('/settings', 'PATCH', { agentEnabled: 'false' })).status, 400)
})

test('HTTP folder management and the empty folder query preserve unfiled notes', async t => {
  const { request, store } = await fixture(t)
  const folder = (await (await request('/folders', 'POST', { name: 'Work' })).json()).data
  const filed = await store.createNote({ title: 'Filed', folderId: folder.id })
  const loose = await store.createNote({ title: 'Loose' })
  assert.equal((await (await request('/notes?folderId=')).json()).data[0].id, loose.id)
  assert.equal((await request(`/folders/${folder.id}`, 'PATCH', { name: 'Plans' })).status, 200)
  assert.equal((await request(`/folders/${folder.id}`, 'DELETE')).status, 200)
  assert.equal((await store.getNote(filed.id)).folderId, null)
})

test('HTTP refuses oversized requests, unsupported content types, invalid JSON and missing revisions', async t => {
  const { request, base } = await fixture(t)
  const tooLarge = await request('/notes', 'POST', { title: 'x'.repeat(MAX_REQUEST_BYTES) })
  assert.equal(tooLarge.status, 413)
  const plain = await request('/notes', 'POST', {}, { 'content-type': 'text/plain' })
  assert.equal(plain.status, 415)
  const broken = await fetch(base + '/jot/api/notes', { method: 'POST', headers: { origin: base, cookie: 'test-session=valid', 'content-type': 'application/json' }, body: '{' })
  assert.equal(broken.status, 400)
  assert.equal((await request('/notes/missing', 'DELETE', {})).status, 400)
  assert.equal((await request('/notes/%E0%A4%A')).status, 400)
  // An omitted Content-Length cannot evade the streamed-byte limit.
  const chunked = await new Promise<number>((resolve, reject) => {
    const outgoing = nodeRequest(base + '/jot/api/notes', {
      method: 'POST', headers: { origin: base, cookie: 'test-session=valid', 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
    }, incoming => {
      incoming.resume()
      incoming.on('end', () => resolve(incoming.statusCode!))
    })
    outgoing.on('error', reject)
    outgoing.write('{"title":"')
    outgoing.end('x'.repeat(MAX_REQUEST_BYTES) + '"}')
  })
  assert.equal(chunked, 413)
})
