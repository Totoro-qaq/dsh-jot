import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createExportHealth } from '../src/export-health.js'

test('background checks are single-flight, independent and do not expose private exception text', async () => {
  let pdfCalls = 0, wordCalls = 0
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const health = createExportHealth({
    pdf: async () => { pdfCalls++; await pending; throw new Error('/private/profile/broken-font') },
    docx: async () => { wordCalls++ },
  })
  assert.equal(health.snapshot().pdf.status, 'checking')
  health.start(); health.start()
  await health.require('docx')
  assert.equal(health.snapshot().docx.status, 'ready')
  assert.equal(health.snapshot().pdf.status, 'checking')
  release()
  await assert.rejects(health.require('pdf'), { code: 'PDF_ENGINE_UNAVAILABLE', status: 409 })
  assert.equal(pdfCalls, 1)
  assert.equal(wordCalls, 1)
  assert.deepEqual(health.snapshot().pdf, { status: 'unavailable', code: 'PDF_ENGINE_UNAVAILABLE' })
  assert.doesNotMatch(JSON.stringify(health.snapshot()), /private|broken-font/u)
  const copy = health.snapshot(); copy.docx.status = 'unavailable'
  assert.equal(health.snapshot().docx.status, 'ready')
  await health.require('txt'); await health.require('md')
})

test('a hanging or synchronous throwing exporter is bounded and does not disable the other formats', async () => {
  const health = createExportHealth({
    pdf: () => new Promise<void>(() => {}),
    docx: () => { throw new Error('private exception') },
  }, 20)
  health.start()
  await assert.rejects(health.require('docx'), { code: 'DOCX_ENGINE_UNAVAILABLE' })
  await assert.rejects(health.require('pdf'), { code: 'PDF_ENGINE_UNAVAILABLE' })
  assert.equal(health.snapshot().txt.status, 'ready')
  assert.equal(health.snapshot().md.status, 'ready')
})
