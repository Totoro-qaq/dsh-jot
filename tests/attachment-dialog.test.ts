import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAttachmentDialogHandoff } from '../src/client/attachment-dialog.js'

test('an unavailable wide preview survives its originating component unmount until the fallback answers', () => {
  let reveals = 0
  const handoff = createAttachmentDialogHandoff(() => { reveals++ })
  handoff.open('first')
  const request = handoff.getSnapshot()!
  let deliveries = 0
  const release = handoff.subscribe(() => { deliveries++ })
  assert.equal(request.attachmentId, 'first')
  assert.equal(reveals, 1)
  handoff.acknowledge(request.revision)
  assert.equal(handoff.getSnapshot(), undefined)
  assert.equal(deliveries, 1)
  release()
})

test('a late fallback answer cannot consume a newer attachment request', () => {
  const handoff = createAttachmentDialogHandoff(() => {})
  handoff.open('first')
  const first = handoff.getSnapshot()!
  handoff.open('second')
  const second = handoff.getSnapshot()!
  handoff.acknowledge(first.revision)
  assert.equal(handoff.getSnapshot(), second)
  handoff.acknowledge(second.revision)
  assert.equal(handoff.getSnapshot(), undefined)
})
