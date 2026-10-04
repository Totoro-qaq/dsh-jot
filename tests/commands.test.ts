import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ShortcutCommand, ShortcutContext, Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client'
import {
  effectiveShortcuts, parseShortcutDefinitions,
  type ShortcutCommandId, type ShortcutDocument, type ShortcutPlatform, type ShortcutRuntime,
} from '@deepseek-ai/dsh-client-shortcuts/protocol'
import { consumeJotCommand, createCommandBus, JOT_COMMANDS, readCommandSelection, registerJotCommands } from '../src/client/commands.js'

const page: ShortcutContext = { region: 'page', modal: null, target: null, source: 'keyboard' }

class CommandFixture implements Pick<Shortcuts, 'register'> {
  readonly commands = new Map<ShortcutCommandId, ShortcutCommand>()
  failAt?: string
  releases = 0
  register(command: ShortcutCommand) {
    assert.equal(this.commands.has(command.id), false, 'no duplicate command ownership')
    if (command.id === this.failAt) throw new Error('registration failed')
    parseShortcutDefinitions([...this.commands.values(), command].map(({ id, defaults }) => ({ id, defaults })))
    this.commands.set(command.id, command)
    return () => {
      if (this.commands.get(command.id) !== command) return
      this.commands.delete(command.id)
      this.releases++
    }
  }
  rows(document: ShortcutDocument, runtime: ShortcutRuntime, platform: ShortcutPlatform) {
    return effectiveShortcuts([...this.commands.values()].map(({ id, defaults }) => ({ id, defaults })), document, runtime, platform)
  }
  command(id: string) {
    const command = this.commands.get(id as ShortcutCommandId)
    assert.ok(command)
    return command
  }
}

for (const runtime of ['web', 'desktop'] as const) {
  for (const platform of ['macos', 'windows', 'linux'] as const) {
    test(`${runtime} ${platform}: all three commands are catalog contributions and accept user bindings`, () => {
      const fixture = new CommandFixture()
      const calls: string[] = []
      const dispose = registerJotCommands(fixture, { chinese: () => true, run: action => { calls.push(action) } })
      const initial: ShortcutDocument = { schemaVersion: 2, profiles: {} }
      assert.deepEqual(fixture.rows(initial, runtime, platform).map(row => row.id).sort(), JOT_COMMANDS.map(row => row.id).sort())
      assert.ok(fixture.rows(initial, runtime, platform).every(row => row.binding === null))
      // Linux Web admits only these three combinations in the official API;
      // real users may need to free a core binding before assigning one to Jot.
      const overrides = runtime === 'web' && platform === 'linux' ? {
        'dsh-jot.open': { code: 'Slash', modifiers: ['primary'] as const },
        'dsh-jot.new-note': { code: 'Comma', modifiers: ['primary', 'shift'] as const },
        'dsh-jot.capture': { code: 'Period', modifiers: ['primary', 'shift'] as const },
      } : {
        'dsh-jot.open': { code: 'KeyJ', modifiers: ['primary', 'alt'] as const },
        'dsh-jot.new-note': { code: 'KeyN', modifiers: ['primary', 'alt', 'shift'] as const },
        'dsh-jot.capture': { code: 'KeyK', modifiers: ['primary', 'alt', 'shift'] as const },
      }
      const document: ShortcutDocument = { schemaVersion: 2, profiles: { [`${runtime}:${platform}`]: overrides } }
      const preferences = structuredClone(document)
      assert.ok(fixture.rows(document, runtime, platform).every(row => row.binding !== null && row.issue === null && row.conflicts.length === 0))
      for (const definition of JOT_COMMANDS) {
        const resolution = fixture.command(definition.id).resolve(page)
        assert.equal(resolution.status, 'handled')
        if (resolution.status === 'handled') resolution.run()
      }
      assert.deepEqual(calls, ['open', 'new', 'capture'])
      dispose()
      assert.equal(fixture.rows(document, runtime, platform).length, 0)
      const remounted = registerJotCommands(fixture, { chinese: () => false, run() {} })
      assert.ok(fixture.rows(document, runtime, platform).every(row => row.binding !== null && row.modified))
      assert.deepEqual(document, preferences, 'unload and reload preserve the host-owned preferences')
      remounted()
    })
  }
}

test('command labels follow locale and aliases make every row searchable in the official catalog', () => {
  const fixture = new CommandFixture()
  let chinese = true
  const dispose = registerJotCommands(fixture, { chinese: () => chinese, run() {} })
  for (const definition of JOT_COMMANDS) {
    const command = fixture.command(definition.id)
    assert.equal(command.label(), definition.zh)
    assert.ok(command.aliases.includes('随记') && command.aliases.includes('jot'))
    assert.deepEqual(command.regions, ['page', 'editable', 'terminal'])
    assert.deepEqual(command.modals, [])
  }
  chinese = false
  for (const definition of JOT_COMMANDS) assert.equal(fixture.command(definition.id).label(), definition.en)
  dispose()
})

test('capture snapshots document and input selections before opening or changing focus', () => {
  const fixture = new CommandFixture()
  const received: string[] = []
  registerJotCommands(fixture, { chinese: () => true, run: (_action, text) => { received.push(text ?? '') } })
  let selected = '对话中的原始重点'
  const target = { tagName: 'P', ownerDocument: { getSelection: () => ({ toString: () => selected }) } } as unknown as Element
  const documentCapture = fixture.command('dsh-jot.capture').resolve({ ...page, target })
  const input = { tagName: 'TEXTAREA', value: '未选中「输入框内容」尾部', selectionStart: 4, selectionEnd: 9 } as unknown as Element
  const inputCapture = fixture.command('dsh-jot.capture').resolve({ ...page, region: 'editable', target: input })
  selected = '导航之后的其他文字'
  ;(input as HTMLTextAreaElement).value = '后来输入的内容'
  if (documentCapture.status === 'handled') documentCapture.run()
  if (inputCapture.status === 'handled') inputCapture.run()
  assert.deepEqual(received, ['对话中的原始重点', '输入框内容'])
  assert.equal(readCommandSelection({ tagName: 'INPUT', type: 'password', value: 'secret', selectionStart: 0, selectionEnd: 6 } as unknown as Element), '')
})

test('commands reject modal ownership and capture never reads a foreign frame selection', () => {
  const fixture = new CommandFixture()
  registerJotCommands(fixture, { chinese: () => true, run() { assert.fail('blocked input must not run') } })
  for (const definition of JOT_COMMANDS) {
    assert.deepEqual(fixture.command(definition.id).resolve({ ...page, modal: 'settings' }), { status: 'blocked', reason: 'modal' })
  }
  for (const source of ['iframe', 'webview'] as const) assert.deepEqual(fixture.command('dsh-jot.capture').resolve({ ...page, source }), { status: 'pass' })
})

test('unloading removes all rows once and invalidates previously resolved actions', () => {
  const fixture = new CommandFixture()
  let calls = 0
  const dispose = registerJotCommands(fixture, { chinese: () => true, run() { calls++ } })
  const commands = JOT_COMMANDS.map(definition => fixture.command(definition.id))
  const pending = commands.map(command => command.resolve(page))
  dispose(); dispose()
  for (const resolution of pending) if (resolution.status === 'handled') resolution.run()
  assert.equal(calls, 0)
  assert.equal(fixture.releases, 3)
  assert.equal(fixture.commands.size, 0)
  for (const command of commands) assert.deepEqual(command.resolve(page), { status: 'pass' })
})

test('failed registration rolls back earlier rows and can be retried as one activation', () => {
  const fixture = new CommandFixture()
  fixture.failAt = 'dsh-jot.capture'
  assert.throws(() => registerJotCommands(fixture, { chinese: () => true, run() {} }), /registration failed/u)
  assert.equal(fixture.commands.size, 0)
  assert.equal(fixture.releases, 2)
  fixture.failAt = undefined
  const dispose = registerJotCommands(fixture, { chinese: () => false, run() {} })
  assert.equal(fixture.commands.size, 3)
  dispose()
  registerJotCommands(undefined, { chinese: () => false, run() {} })()
})

test('a panel command survives navigation until its owning panel acknowledges the same revision', () => {
  const bus = createCommandBus()
  const recipient = { sessionId: 'conversation-a', tabId: 'jot-tab', signal: new AbortController().signal }
  let notifications = 0
  const off = bus.subscribe(() => { notifications++ })
  bus.send({ action: 'capture', target: 'compact', recipient, text: '保留选中内容' })
  const first = bus.snapshotFor('compact', recipient)!
  assert.equal(bus.snapshotFor('wide'), undefined)
  assert.equal(first.text, '保留选中内容')
  bus.send({ action: 'new', target: 'wide' })
  const latest = bus.snapshotFor('wide')!
  bus.acknowledge(first.revision)
  assert.equal(bus.snapshotFor('wide'), latest)
  bus.acknowledge(latest.revision)
  assert.equal(bus.getSnapshot(), undefined)
  assert.equal(notifications, 3)
  off()
  bus.send({ action: 'new', target: 'compact', recipient })
  assert.equal(notifications, 3)
})

test('busy panel keeps a new-note command pending, then executes it once without duplicate rerender work', () => {
  const bus = createCommandBus()
  bus.send({ action: 'new', target: 'wide' })
  const request = bus.snapshotFor('wide')!
  let calls = 0
  let acknowledgements = 0
  let lastHandled = 0
  const callbacks = {
    acknowledge(revision: number) { acknowledgements++; bus.acknowledge(revision) },
    run() { calls++ },
  }
  for (let render = 0; render < 20; render++) lastHandled = consumeJotCommand(bus.snapshotFor('wide'), {
    ready: true, busy: true, blocked: false, lastHandled,
  }, callbacks)
  assert.equal(calls, 0)
  assert.equal(acknowledgements, 0)
  assert.equal(bus.snapshotFor('wide'), request)
  lastHandled = consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled }, callbacks)
  assert.equal(calls, 1)
  assert.equal(acknowledgements, 1)
  assert.equal(bus.getSnapshot(), undefined)
  consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled }, callbacks)
  assert.equal(calls, 1, 'a stale effect cannot create another note')
})

test('pending commands wait for panel readiness and are discarded during modal ownership', () => {
  const bus = createCommandBus()
  const recipient = { sessionId: 'conversation-a', tabId: 'jot-tab', signal: new AbortController().signal }
  bus.send({ action: 'new', target: 'compact', recipient })
  const request = bus.snapshotFor('compact', recipient)!
  const callbacks = { acknowledge: bus.acknowledge, run() { assert.fail('not-ready or modal-owned command must not run') } }
  const lastHandled = consumeJotCommand(request, { ready: false, busy: false, blocked: false, lastHandled: 0 }, callbacks)
  assert.equal(lastHandled, 0)
  assert.equal(bus.getSnapshot(), request)
  const discarded = consumeJotCommand(request, { ready: true, busy: true, blocked: true, lastHandled }, callbacks)
  assert.equal(discarded, request.revision)
  assert.equal(bus.getSnapshot(), undefined)
  consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled: discarded }, callbacks)
})

for (const action of ['new', 'capture'] as const) {
  test(`${action}: retained conversations with the same tab id cannot consume each other's command`, () => {
    const bus = createCommandBus()
    const zh = { sessionId: 'conversation-zh', tabId: 'same-tab-id', signal: new AbortController().signal }
    const en = { sessionId: 'conversation-en', tabId: 'same-tab-id', signal: new AbortController().signal }
    bus.send({ action, target: 'compact', recipient: zh, text: '选区快照' })
    const request = bus.snapshotFor('compact', zh)!
    assert.equal(bus.snapshotFor('compact', en), undefined)
    assert.equal(bus.snapshotFor('compact'), undefined, 'an unscoped compact listener owns no request')
    assert.equal(bus.claim(request.revision, 'compact', en), false, 'the older hidden conversation cannot win by running first')
    let runs = 0
    const state = { ready: true, busy: false, blocked: false, lastHandled: 0 }
    const callbacks = { claim: (revision: number) => bus.claim(revision, 'compact', zh), run(received: typeof request) {
      runs++; assert.equal(received.text, '选区快照')
    } }
    consumeJotCommand(request, state, callbacks)
    consumeJotCommand(request, state, callbacks)
    assert.equal(runs, 1, 'two effects retaining the same request perform one side effect')
  })
}

test('two visible panes in one conversation still have exact tab recipients', () => {
  const bus = createCommandBus()
  const left = { sessionId: 'conversation-a', tabId: 'jot-left', signal: new AbortController().signal }
  const right = { sessionId: 'conversation-a', tabId: 'jot-right', signal: new AbortController().signal }
  bus.send({ action: 'capture', target: 'compact', recipient: right, text: 'Right pane' })
  const request = bus.snapshotFor('compact', right)!
  assert.equal(bus.snapshotFor('compact', left), undefined)
  assert.equal(bus.claim(request.revision, 'compact', left), false)
  assert.equal(bus.claim(request.revision, 'compact', right), true)
})

test('pending busy commands survive session switching without being transferred to another conversation', () => {
  const bus = createCommandBus()
  const recipient = { sessionId: 'conversation-a', tabId: 'jot-tab', signal: new AbortController().signal }
  bus.send({ action: 'new', target: 'compact', recipient })
  const request = bus.snapshotFor('compact', recipient)!
  let currentSession = 'conversation-a'
  let runs = 0
  const callbacks = { claim: (revision: number) => currentSession === recipient.sessionId && bus.claim(revision, 'compact', recipient), run() { runs++ } }
  assert.equal(consumeJotCommand(request, { ready: true, busy: true, blocked: false, lastHandled: 0 }, callbacks), 0)
  currentSession = 'conversation-b'
  assert.equal(consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled: 0 }, callbacks), 0)
  assert.equal(bus.getSnapshot(), request)
  currentSession = 'conversation-a'
  assert.equal(consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled: 0 }, callbacks), request.revision)
  assert.equal(runs, 1)
})

test('tab lifetime abort and plugin disposal retire pending work and remove subscriptions', () => {
  const bus = createCommandBus()
  const lifetime = new AbortController()
  const recipient = { sessionId: 'conversation-a', tabId: 'restored-tab', signal: lifetime.signal }
  let notifications = 0
  bus.subscribe(() => { notifications++ })
  bus.send({ action: 'capture', target: 'compact', recipient })
  const stale = bus.getSnapshot()!
  lifetime.abort()
  assert.equal(bus.getSnapshot(), undefined)
  assert.equal(bus.claim(stale.revision, 'compact', recipient), false)
  const restored = { ...recipient, signal: new AbortController().signal }
  bus.send({ action: 'new', target: 'compact', recipient: restored })
  assert.equal(bus.snapshotFor('compact', recipient), undefined)
  assert.ok(bus.snapshotFor('compact', restored))
  bus.dispose()
  const disposedNotifications = notifications
  bus.send({ action: 'new', target: 'wide' })
  assert.equal(bus.getSnapshot(), undefined)
  assert.equal(notifications, disposedNotifications)
  assert.equal(bus.claim(stale.revision, 'compact', restored), false)
})

test('a superseded tab lifetime cannot clear a new request owned by the restored occurrence', () => {
  const bus = createCommandBus()
  const old = new AbortController()
  const recipient = { sessionId: 'conversation-a', tabId: 'restored-tab', signal: old.signal }
  bus.send({ action: 'new', target: 'compact', recipient })
  const restored = { ...recipient, signal: new AbortController().signal }
  bus.send({ action: 'capture', target: 'compact', recipient: restored })
  const current = bus.snapshotFor('compact', restored)
  old.abort()
  assert.equal(bus.snapshotFor('compact', restored), current)
})
