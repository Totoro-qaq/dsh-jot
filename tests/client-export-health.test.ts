import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ExportDialog } from '../src/client/ExportDialog.js'
import { createJotApi } from '../src/client/api.js'
import { describeError } from '../src/client/errors.js'
import { exportBlocked, exportFormatLabel, exportFormatNotice, exportHealthNotice, initialExportHealth, watchExportHealth } from '../src/client/export-health.js'
import type { ExportCapabilities, ExportHealth } from '../src/client/types.js'

const capabilities = {
  txt: { status: 'ready' }, md: { status: 'ready' },
  pdf: { status: 'unavailable', code: 'PDF_ENGINE_UNAVAILABLE' },
  docx: { status: 'checking' },
} as const

function render(locale: 'zh' | 'en', initialFormat: 'pdf' | 'docx' | 'md') {
  return renderToString(createElement(ExportDialog, {
    locale, scope: 'all 1 note', count: 1, initialFormat, busy: false, error: '',
    capabilities, onSubmit() {}, onClose() {},
  } as Parameters<typeof ExportDialog>[0]))
}

test('library dialog announces unavailable PDF and checking Word before export, without blocking Markdown', () => {
  const html = render('zh', 'pdf')
  assert.match(html, /PDF[^<]*导出不可用/u)
  assert.match(html, /PDF_ENGINE_UNAVAILABLE/u)
  assert.match(html, /正在检查/u)
  assert.match(html, /<input[^>]*disabled=""[^>]*value="pdf"/u)
  assert.match(html, /<input[^>]*disabled=""[^>]*value="docx"/u)
  assert.doesNotMatch(html, /<input[^>]*disabled=""[^>]*value="md"/u)
  assert.match(html, /<button type="submit"[^>]*disabled=""/u)
  assert.doesNotMatch(render('zh', 'md'), /<button type="submit"[^>]*disabled=""/u)
})

test('library dialog localizes capability diagnostics and marks old hosts unverified, not healthy', () => {
  assert.match(render('en', 'pdf'), /PDF export is unavailable/u)
  const html = renderToString(createElement(ExportDialog, {
    locale: 'en', scope: 'all 1 note', count: 1, initialFormat: 'pdf', busy: false,
    error: '', onSubmit() {}, onClose() {},
  }))
  assert.match(html, /Export readiness has not been checked/u)
  assert.doesNotMatch(html, /<button type="submit"[^>]*disabled=""/u)
})

test('client API asks the authenticated host for export capabilities', async t => {
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/synthetic/export-capabilities')
    assert.equal(options?.credentials, 'same-origin')
    return Response.json({ data: capabilities })
  }
  const api = createJotApi('/synthetic')
  assert.equal(typeof api.getExportCapabilities, 'function')
  assert.deepEqual(await api.getExportCapabilities!(), capabilities)
})

function clock() {
  let next = 0
  const tasks = new Map<number, { callback: () => void; delay: number }>()
  const schedule = ((callback: () => void, delay: number) => {
    tasks.set(++next, { callback, delay }); return next
  }) as unknown as typeof setTimeout
  const cancel = ((id: number) => { tasks.delete(id) }) as unknown as typeof clearTimeout
  return { tasks, schedule, cancel, async tick(delay: number) {
    const [id, task] = [...tasks].find(([, task]) => task.delay === delay) ?? []
    assert.ok(id && task, `no scheduled task for ${delay}ms`)
    tasks.delete(id); task.callback(); await settled()
  } }
}

async function settled() { for (let index = 0; index < 8; index++) await Promise.resolve() }
const ready = { txt: { status: 'ready' }, md: { status: 'ready' }, pdf: { status: 'ready' }, docx: { status: 'ready' } } as const

test('export health probes on mount, hides healthy status and never polls a settled engine', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let requests = 0
  const stop = watchExportHealth(async () => { requests++; return ready }, { ...timer, onChange: value => updates.push(value) })
  assert.equal(requests, 1, 'the check is not deferred to an export click')
  assert.equal(updates[0].pdf.status, 'checking')
  await settled()
  assert.deepEqual(updates.at(-1), ready)
  assert.equal(exportHealthNotice(updates.at(-1)!, 'zh'), '')
  assert.equal(timer.tasks.size, 0)
  stop()
})

test('checking engines poll once per second and stop at a finite bound without claiming readiness', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let requests = 0
  const stop = watchExportHealth(async () => { requests++; return capabilities },
    { ...timer, maxAttempts: 2, onChange: value => updates.push(value) })
  await settled()
  assert.equal(requests, 1)
  assert.equal(updates.at(-1)?.docx.status, 'checking')
  await timer.tick(1000)
  assert.equal(requests, 2)
  assert.equal(updates.at(-1)?.docx.status, 'unknown')
  assert.equal(updates.at(-1)?.pdf.status, 'unavailable')
  assert.equal(timer.tasks.size, 0)
  assert.equal(exportBlocked(updates.at(-1), 'pdf'), true)
  assert.equal(exportBlocked(updates.at(-1), 'docx'), false, 'unknown old hosts remain usable without a false ready claim')
  stop()
})

test('a checking engine becoming ready removes its warning without hiding an independent failed format', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let requests = 0
  watchExportHealth(async () => ++requests === 1 ? capabilities : { ...capabilities, docx: { status: 'ready' } },
    { ...timer, onChange: value => updates.push(value) })
  await settled(); await timer.tick(1000)
  const health = updates.at(-1)!
  assert.equal(health.docx.status, 'ready')
  assert.equal(health.pdf.status, 'unavailable')
  assert.match(exportHealthNotice(health, 'en'), /PDF export is unavailable/u)
  assert.doesNotMatch(exportHealthNotice(health, 'en'), /Word/u)
  assert.equal(timer.tasks.size, 0)
})

test('old APIs, failed requests and invalid snapshots are unknown rather than ready', async () => {
  for (const get of [undefined, async () => { throw new Error('HTTP 404') }, async () => undefined as unknown as ExportCapabilities]) {
    const timer = clock(), updates: ExportHealth[] = []
    const stop = watchExportHealth(get, { ...timer, onChange: value => updates.push(value) })
    await settled()
    assert.equal(updates.at(-1)?.pdf.status, 'unknown')
    assert.equal(updates.at(-1)?.docx.status, 'unknown')
    assert.equal(updates.at(-1)?.md.status, 'ready')
    assert.match(exportHealthNotice(updates.at(-1)!, 'zh'), /未检测/u)
    assert.equal(timer.tasks.size, 0)
    stop()
  }
})

test('a network failure during checking does not re-enable an already unavailable engine', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let requests = 0
  watchExportHealth(async () => { if (++requests === 1) return capabilities; throw new Error('offline') },
    { ...timer, onChange: value => updates.push(value) })
  await settled(); await timer.tick(1000)
  assert.equal(updates.at(-1)?.pdf.status, 'unavailable')
  assert.equal(updates.at(-1)?.docx.status, 'unknown')
  assert.equal(exportBlocked(updates.at(-1), 'pdf'), true)
})

test('starting a fresh status refresh cannot forget a known failed engine on network failure', async () => {
  const timer = clock(), first: ExportHealth[] = [], refreshed: ExportHealth[] = []
  const stop = watchExportHealth(async () => ({ ...ready, pdf: capabilities.pdf }),
    { ...timer, onChange: value => first.push(value) })
  await settled(); stop()
  watchExportHealth(async () => { throw new Error('offline') },
    { ...timer, initialHealth: first.at(-1), onChange: value => refreshed.push(value) })
  await settled()
  assert.equal(refreshed[0]?.pdf.status, 'unavailable')
  assert.equal(refreshed.at(-1)?.pdf.status, 'unavailable')
  assert.equal(exportBlocked(refreshed.at(-1), 'pdf'), true)
})

test('only a verified ready refresh can clear a known failed format, not a pending or malformed response', async () => {
  for (const response of [undefined, { ...ready, pdf: { status: 'checking' } }, ready] as const) {
    const timer = clock(), updates: ExportHealth[] = []
    const stop = watchExportHealth(async () => response as ExportCapabilities,
      { ...timer, maxAttempts: 1, initialHealth: { ...initialExportHealth(false), pdf: capabilities.pdf },
        onChange: value => updates.push(value) })
    await settled()
    assert.equal(updates.at(-1)?.pdf.status, response === ready ? 'ready' : 'unavailable')
    stop()
  }
})

test('request timeout aborts its request, reports unknown and leaves no timer running', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let signal: AbortSignal | undefined
  const stop = watchExportHealth(options => { signal = options?.signal; return new Promise(() => {}) },
    { ...timer, onChange: value => updates.push(value) })
  await timer.tick(5000)
  assert.equal(signal?.aborted, true)
  assert.equal(updates.at(-1)?.pdf.status, 'unknown')
  assert.equal(timer.tasks.size, 0)
  stop()
})

test('unmount cancels queued checks and ignores a late in-flight result', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  let answer!: (value: ExportCapabilities) => void
  let signal: AbortSignal | undefined
  const stop = watchExportHealth(options => { signal = options?.signal; return new Promise(resolve => { answer = resolve }) },
    { ...timer, onChange: value => updates.push(value) })
  stop(); answer(ready); await settled()
  assert.equal(signal?.aborted, true)
  assert.equal(updates.length, 1)
  assert.equal(timer.tasks.size, 0)
  const polling = watchExportHealth(async () => capabilities, { ...timer, onChange: value => updates.push(value) })
  await settled(); assert.equal(timer.tasks.size, 1)
  polling(); assert.equal(timer.tasks.size, 0)
})

test('health diagnostics never expose server paths and healthy text formats are independent', async () => {
  const timer = clock(), updates: ExportHealth[] = []
  watchExportHealth(async () => ({ ...capabilities, txt: { status: 'unavailable' },
    pdf: { status: 'unavailable', code: '/private/note/path/secret' } }),
  { ...timer, maxAttempts: 1, onChange: value => updates.push(value) })
  await settled()
  const health = updates.at(-1)!
  assert.equal(health.txt.status, 'ready')
  assert.equal(exportBlocked(health, 'txt'), false)
  assert.equal(exportBlocked(undefined, 'pdf'), false)
  assert.equal(exportFormatNotice(health, 'md', 'en'), '')
  assert.equal(exportFormatNotice(ready, 'docx', 'zh'), '')
  assert.doesNotMatch(exportHealthNotice(health, 'en'), /private|secret/u)
  for (const code of ['PDF_ENGINE_UNAVAILABLE', 'DOCX_ENGINE_UNAVAILABLE']) {
    assert.match(describeError({ code, message: '/private/path' }, 'zh'), /导出模块不可用/u)
    assert.match(describeError({ code, message: '/private/path' }, 'en'), /export engine is unavailable/u)
  }
  assert.equal(initialExportHealth(false).docx.status, 'unknown')
})

test('format menus identify checking, failed and unknown formats in both locales without changing healthy labels', () => {
  const health = { ...initialExportHealth(false), pdf: capabilities.pdf, docx: capabilities.docx }
  assert.equal(exportFormatLabel('pdf', health, 'zh'), 'PDF · 不可用')
  assert.equal(exportFormatLabel('pdf', health, 'en'), 'PDF · Unavailable')
  assert.equal(exportFormatLabel('docx', health, 'zh'), 'Word（DOCX） · 检查中')
  assert.equal(exportFormatLabel('docx', health, 'en'), 'Word (DOCX) · Checking')
  assert.equal(exportFormatLabel('docx', initialExportHealth(false), 'en'), 'Word (DOCX) · Unchecked')
  assert.equal(exportFormatLabel('pdf', initialExportHealth(false), 'zh'), 'PDF · 未检测')
  assert.equal(exportFormatLabel('docx', ready, 'en'), 'Word (DOCX)')
  assert.equal(exportFormatLabel('md', ready, 'zh'), 'Markdown')
  assert.equal(exportFormatLabel('txt', ready, 'zh'), '纯文本（TXT）')
  assert.equal(exportFormatLabel('txt', ready, 'en'), 'Plain text (TXT)')
  assert.match(exportHealthNotice(initialExportHealth(), 'zh'), /后台进行/u)
  assert.match(exportHealthNotice(initialExportHealth(), 'en'), /background/u)
  assert.match(exportHealthNotice(initialExportHealth(false), 'en'), /may still be tried/u)
})
