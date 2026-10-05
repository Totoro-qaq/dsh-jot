import assert from 'node:assert/strict'
import { test } from 'node:test'
import { releaseVersion, validatePackage, releaseDecision, readRegistry, publishArchive, provenanceEnvironment } from '../scripts/npm-release.mjs'

const pkg = { name: 'dsh-jot', version: '0.2.7', repository: { url: 'git+https://github.com/Totoro-qaq/dsh-jot.git' },
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' } }
const registry = (latest = '0.2.6', extra = {}) => ({ name: 'dsh-jot', 'dist-tags': { latest }, versions: {
  [latest]: { name: 'dsh-jot', version: latest }, ...extra,
} })

test('publisher accepts only exact stable tags and the intended package/destination', () => {
  assert.equal(validatePackage('v0.2.7', pkg), '0.2.7')
  assert.equal(validatePackage('v0.2.7', { ...pkg, publishConfig: { ...pkg.publishConfig, registry: pkg.publishConfig.registry + '/' } }), '0.2.7')
  for (const tag of ['0.2.7', 'v0.2.7-dev.0', 'v01.2.7', 'v0.2.7\n', 'v0.2.7;echo bad', 'main']) {
    assert.throws(() => releaseVersion(tag))
  }
  for (const patch of [{ version: '0.2.6' }, { name: 'other' }, { repository: 'https://example.com' },
    { publishConfig: { access: 'public', registry: 'https://example.com' } }]) {
    assert.throws(() => validatePackage('v0.2.7', { ...pkg, ...patch }))
  }
})

test('existing releases are no-ops and missing older releases cannot rewind latest', () => {
  assert.equal(releaseDecision('0.2.7', registry()).publish, true)
  assert.equal(releaseDecision('0.2.6', registry()).publish, false)
  assert.equal(releaseDecision('0.2.6', registry('0.3.0', { '0.2.6': { name: 'dsh-jot', version: '0.2.6' } })).publish, false)
  assert.throws(() => releaseDecision('0.2.5', registry()), /backwards/u)
  assert.equal(releaseDecision('0.10.0', registry('0.9.9')).publish, true)
})

test('invalid or unavailable registry data never authorizes a publication', async () => {
  for (const status of [401, 403, 404, 429, 500, 503]) {
    await assert.rejects(readRegistry(async () => ({ ok: false, status })), /metadata request failed/u)
  }
  await assert.rejects(readRegistry(async () => { throw new Error('offline') }), /offline/u)
  await assert.rejects(readRegistry(async () => ({ ok: true, json: async () => { throw new Error('bad JSON') } })), /bad JSON/u)
  for (const data of [null, {}, { ...registry(), name: 'wrong' }, { ...registry(), versions: [] },
    { ...registry(), 'dist-tags': {} }, { ...registry(), 'dist-tags': { latest: '0.3.0' } }]) {
    assert.throws(() => releaseDecision('0.2.7', data))
  }
})

test('publication rechecks registry after building and propagates npm failures', async () => {
  let calls = 0
  const run = () => { calls++; return { status: 0 } }
  const options = { version: '0.2.7', tag: 'v0.2.7', commit: 'a'.repeat(40), archive: 'release.tgz', directory: '.', run }
  assert.equal((await publishArchive({ ...options, load: async () => registry('0.2.7') })).publish, false)
  await assert.rejects(publishArchive({ ...options, load: async () => registry('0.3.0') }), /backwards/u)
  assert.equal(calls, 0)
  await assert.rejects(publishArchive({ ...options, load: async () => registry(), run: () => ({ status: 1 }) }), /npm publish failed/u)
  await assert.rejects(publishArchive({ ...options, load: async () => registry(), run: () => ({ status: null, signal: 'SIGTERM' }) }), /SIGTERM/u)
  let invocation
  const result = await publishArchive({ ...options, load: async () => registry(), run: (...args) => { invocation = args; return { status: 0 } } })
  assert.equal(result.publish, true)
  assert.equal(invocation[0], 'npm')
  assert.ok(invocation[1].includes('--provenance'))
  assert.ok(invocation[1].includes('--ignore-scripts'))
  assert.equal(invocation[2].shell, false)
  assert.equal(invocation[2].env.GITHUB_SHA, options.commit)
})

test('manual retry provenance names candidate source while preserving workflow and OIDC identity', () => {
  const controller = { GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'b'.repeat(40),
    GITHUB_WORKFLOW_REF: 'Totoro-qaq/dsh-jot/.github/workflows/publish.yml@refs/heads/main',
    GITHUB_WORKFLOW_SHA: 'b'.repeat(40), ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-only' }
  const candidate = provenanceEnvironment('v0.2.7', 'a'.repeat(40), controller)
  assert.equal(candidate.GITHUB_REF, 'refs/tags/v0.2.7')
  assert.equal(candidate.GITHUB_SHA, 'a'.repeat(40))
  for (const key of ['GITHUB_WORKFLOW_REF', 'GITHUB_WORKFLOW_SHA', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN']) {
    assert.equal(candidate[key], controller[key])
  }
  assert.equal(controller.GITHUB_REF, 'refs/heads/main', 'the parent environment is unchanged')
  assert.throws(() => provenanceEnvironment('v0.2.7', 'not-a-commit'))
})
