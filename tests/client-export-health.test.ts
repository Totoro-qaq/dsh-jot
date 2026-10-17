import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ExportDialog } from '../src/client/ExportDialog.js'
import { createJotApi } from '../src/client/api.js'

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
