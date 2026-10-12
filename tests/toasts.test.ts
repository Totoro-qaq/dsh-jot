import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activateToast, dismissToast, emptyToastQueue, pushToast, type ToastNotice } from '../src/client/toasts.js'

const notice = (id: number, text: string, action = false): ToastNotice => ({
  id, text, ...(action ? { action: { label: 'Undo', run() {} } } : {}),
})

test('an undo toast stays visible when a later notice arrives, and dismissing it reveals that notice', () => {
  let queue = pushToast(emptyToastQueue(), notice(1, 'Moved 3 notes to Trash', true))
  const undo = queue.visible
  queue = pushToast(queue, notice(2, 'Exported'))
  queue = pushToast(queue, notice(3, 'Saved'))
  assert.equal(queue.visible, undo, 'the same undo object stays visible, so its timer is not reset')
  assert.equal(queue.deferred?.id, 3, 'only the latest ordinary notice is kept')
  queue = dismissToast(queue, 1)
  assert.equal(queue.visible?.id, 3)
  assert.equal(queue.deferred, null)
  queue = dismissToast(queue, 99)
  assert.equal(queue.visible?.id, 3, 'dismissing another id leaves the queue alone')
})

test('undo stays on screen while the app is busy, and runs only after that', () => {
  let ran = 0
  const queue = pushToast(emptyToastQueue(), { id: 1, text: 'Moved to Trash', action: { label: 'Undo', run: () => { ran++ } } })
  const blocked = activateToast(queue, 1, true)
  assert.equal(blocked.queue, queue)
  assert.equal(blocked.run, null)
  assert.equal(ran, 0)
  const ready = activateToast(queue, 1, false)
  assert.equal(ready.queue.visible, null)
  ready.run?.()
  assert.equal(ran, 1)
})

test('a newer undo replaces the visible undo and ordinary notices still replace each other', () => {
  let queue = pushToast(emptyToastQueue(), notice(1, 'First', true))
  queue = pushToast(queue, notice(2, 'Background'))
  queue = pushToast(queue, notice(3, 'Second', true))
  assert.equal(queue.visible?.id, 3)
  assert.equal(queue.deferred?.id, 2)
  queue = pushToast(emptyToastQueue(), notice(4, 'One'))
  queue = pushToast(queue, notice(5, 'Two'))
  assert.equal(queue.visible?.id, 5)
  assert.equal(queue.deferred, null)
})
