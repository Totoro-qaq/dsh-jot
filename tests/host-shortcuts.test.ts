import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ShortcutCommand, ShortcutFixedCommand } from '@deepseek-ai/dsh-client-shortcuts/client'
import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { history, redo, undo } from '@tiptap/pm/history'
import { createJotExtensions } from '../src/client/editor-extensions.js'
import {
  bindingKey, effectiveShortcuts, normalizeBinding, parseShortcutDefinitions, presentBinding,
  type ShortcutCommandId, type ShortcutDefinition, type ShortcutDocument,
  type ShortcutPlatform, type ShortcutRuntime,
} from '@deepseek-ai/dsh-client-shortcuts/protocol'
import { createHostEditorShortcuts, EDITOR_BOLD_SHORTCUT_ID, EDITOR_UNDO_SHORTCUT_ID, EDITOR_REDO_SHORTCUT_ID, type HostShortcutService } from '../src/client/host-shortcuts.js'

const sidebarId = 'sidebar.left.toggle' as ShortcutCommandId
const otherId = 'sidebar.right.toggle' as ShortcutCommandId
const modB = { code: 'KeyB', modifiers: ['primary'] } as const
const modAltB = { code: 'KeyB', modifiers: ['primary', 'alt'] } as const

/** Public protocol fixture uses the same ingress validation and arbitration as Native. */
class ShortcutFixture implements HostShortcutService {
  readonly fixed = new Map<ShortcutCommandId, ShortcutFixedCommand>()
  readonly commands = new Map<ShortcutCommandId, ShortcutCommand>()
  readonly document: ShortcutDocument
  registrations = 0
  releases = 0
  failRegistration = false
  failCommandRegistration = false
  failCommandId?: ShortcutCommandId
  normalRegistrations = 0
  constructor(readonly runtime: ShortcutRuntime, readonly platform: ShortcutPlatform, override = false) {
    this.document = { schemaVersion: 2, profiles: override ? {
      [`${runtime}:${platform}`]: { [sidebarId]: modAltB, [otherId]: modB },
    } : {} }
  }
  describeBinding(binding: Parameters<HostShortcutService['describeBinding']>[0]) {
    const normalized = binding === null ? null : normalizeBinding(binding, this.platform)
    return { binding: normalized, keys: presentBinding(normalized, this.platform).keys, issue: null, conflicts: [] }
  }
  registerFixed(command: ShortcutFixedCommand) {
    if (this.failRegistration) throw new Error('registration failed')
    assert.equal(this.fixed.has(command.id), false, 'duplicate fixed registration')
    this.registrations++
    this.fixed.set(command.id, command)
    // The actual Native ingress accepts a fixed reservation overlapping defaults.
    assert.doesNotThrow(() => parseShortcutDefinitions(this.definitions()))
    return () => {
      if (this.fixed.get(command.id) !== command) return
      this.fixed.delete(command.id)
      this.releases++
    }
  }
  register(command: ShortcutCommand) {
    if (this.failCommandRegistration || this.failCommandId === command.id) throw new Error('command registration failed')
    assert.equal(this.commands.has(command.id), false, 'duplicate command registration')
    parseShortcutDefinitions([...this.definitions(), { id: command.id, defaults: command.defaults }])
    this.commands.set(command.id, command)
    this.normalRegistrations++
    return () => { if (this.commands.get(command.id) === command) this.commands.delete(command.id) }
  }
  // Any accidental use of these preference/recording operations is a test failure.
  edit() { throw new Error('editor focus must not write preferences') }
  recording() { throw new Error('editor focus must not suppress all native shortcuts') }
  definitions(): readonly ShortcutDefinition[] {
    return [
      { id: sidebarId, defaults: { 'desktop:macos': modB, 'desktop:windows': modB } },
      { id: otherId, defaults: { 'desktop:macos': modAltB, 'desktop:windows': modAltB } },
      ...[...this.commands.values()].map(command => ({ id: command.id, defaults: command.defaults })),
      ...[...this.fixed.values()].map(command => ({ id: command.id, defaults: {}, fixed: command.bindings })),
    ]
  }
  rows() { return effectiveShortcuts(this.definitions(), this.document, this.runtime, this.platform) }
  /** Mirrors installDesktopShortcuts.publish's accepted-key filter. */
  nativeKeys() {
    return new Set(this.rows().flatMap(row => row.binding && row.issue === null && row.conflicts.length === 0
      ? [bindingKey(row.binding)] : []))
  }
}

for (const platform of ['macos', 'windows'] as const) {
  test(`${platform} Desktop releases Mod+B to the editor and restores the host binding on blur`, () => {
    const service = new ShortcutFixture('desktop', platform)
    const preferences = JSON.stringify(service.document)
    const primary = bindingKey(normalizeBinding(modB, platform))
    const other = bindingKey(normalizeBinding(modAltB, platform))
    assert.equal(service.nativeKeys().has(primary), true)
    const guard = createHostEditorShortcuts(service, { label: () => '随记：粗体' })
    const release = guard.enter({})
    assert.equal(service.nativeKeys().has(primary), false)
    assert.equal(service.nativeKeys().has(other), true, 'unrelated host commands remain available')
    assert.deepEqual(service.rows().find(row => row.id === sidebarId)?.conflicts, [EDITOR_BOLD_SHORTCUT_ID])
    const fixed = service.fixed.get(EDITOR_BOLD_SHORTCUT_ID)!
    assert.equal(fixed.label(), '随记：粗体')
    assert.deepEqual(fixed.keys, platform === 'macos' ? ['⌘', 'B'] : ['Ctrl', '+', 'B'])
    release()
    release()
    assert.equal(service.nativeKeys().has(primary), true)
    assert.equal(service.releases, 1)
    assert.equal(JSON.stringify(service.document), preferences)
  })

  test(`${platform} Desktop preserves custom binding preferences when the local reservation ends`, () => {
    const service = new ShortcutFixture('desktop', platform, true)
    const before = structuredClone(service.rows())
    const document = structuredClone(service.document)
    const guard = createHostEditorShortcuts(service)
    guard.enter({})
    assert.deepEqual(service.rows().find(row => row.id === otherId)?.conflicts, [EDITOR_BOLD_SHORTCUT_ID])
    assert.deepEqual(service.rows().find(row => row.id === sidebarId)?.conflicts, [])
    guard.dispose()
    assert.deepEqual(service.rows(), before)
    assert.deepEqual(service.document, document)
  })
}

test('multiple editors share one reservation; stale cleanup cannot release a newer focus lease', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  const compact = {}, wide = {}
  const oldCompact = guard.enter(compact)
  const newCompact = guard.enter(compact)
  const releaseWide = guard.enter(wide)
  assert.equal(service.registrations, 1)
  oldCompact()
  releaseWide()
  assert.equal(service.fixed.size, 1)
  newCompact()
  assert.equal(service.fixed.size, 0)
  assert.equal(service.releases, 1)
  const releaseRefocus = guard.enter(wide)
  assert.equal(service.registrations, 2)
  guard.dispose()
  guard.dispose()
  releaseRefocus()
  guard.enter({})()
  assert.equal(service.fixed.size, 0)
  assert.equal(service.releases, 2)
  assert.equal(service.registrations, 2)
})

test('a failed registration leaves no lease or reservation and may be retried', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  service.failRegistration = true
  assert.throws(() => guard.enter({}), /registration failed/u)
  service.failRegistration = false
  const release = guard.enter({})
  assert.equal(service.fixed.size, 1)
  release()
  assert.equal(service.fixed.size, 0)
})

test('Web, Linux Desktop, and previews without the host service use local editor dispatch', () => {
  for (const [runtime, platform] of [
    ['web', 'macos'], ['web', 'windows'], ['web', 'linux'], ['desktop', 'linux'],
  ] as const) {
    const service = new ShortcutFixture(runtime, platform)
    const guard = createHostEditorShortcuts(service)
    guard.enter({})()
    guard.dispose()
    assert.equal(service.registrations, 0)
  }
  const preview = createHostEditorShortcuts(undefined)
  preview.enter({})()
  preview.dispose()
})

test('macOS Native history keys suppress menu accelerators and route real ProseMirror table undo and redo', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  const preferences = structuredClone(service.document)
  const schema = getSchema(createJotExtensions())
  let state = EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph', null, schema.text('正文'))]), plugins: [history()] })
  const table = schema.nodes.table!.create(null, [schema.nodes.tableRow!.create(null, [schema.nodes.tableCell!.createAndFill()!])])
  state = state.apply(state.tr.insert(state.doc.content.size, table))
  assert.equal(state.doc.childCount, 2)
  const target = {} as Element
  const owner = { handleShortcut(action: 'undo' | 'redo', actualTarget?: EventTarget | null) {
    assert.equal(this, owner, 'editor facade retains its method receiver')
    assert.equal(actualTarget, target)
    return (action === 'undo' ? undo : redo)(state, transaction => { state = state.apply(transaction) })
  } }
  const release = guard.enter(owner)
  const binding = bindingKey(normalizeBinding({ code: 'KeyZ', modifiers: ['primary', 'shift'] }, 'macos'))
  const undoKey = bindingKey(normalizeBinding({ code: 'KeyZ', modifiers: ['primary'] }, 'macos'))
  // Actual installDesktopShortcuts.beforeInput sets ignoreMenuShortcuts when
  // this normal-command key matches; a fixed row alone is absent from keys.
  assert.equal(service.nativeKeys().has(binding), true)
  assert.equal(service.nativeKeys().has(undoKey), true)
  const route = (id: ShortcutCommandId) => {
    const command = service.commands.get(id)!
    const resolved = command.resolve({ target, region: 'editable', modal: null, source: 'keyboard' })
    assert.equal(resolved.status, 'handled')
    if (resolved.status === 'handled') resolved.run()
  }
  route(EDITOR_UNDO_SHORTCUT_ID)
  assert.equal(state.doc.childCount, 1)
  assert.equal(state.doc.lastChild?.type.name, 'paragraph')
  route(EDITOR_REDO_SHORTCUT_ID)
  assert.equal(state.doc.childCount, 2)
  assert.equal(state.doc.lastChild?.type.name, 'table')
  release()
  assert.equal(service.nativeKeys().has(binding), false)
  assert.equal(service.nativeKeys().has(undoKey), false)
  assert.equal(service.commands.size, 0)
  assert.deepEqual(service.document, preferences)
})

test('Native history routes only focused editor ownership and reject modal/foreign-frame or stale resolutions', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  let calls = 0
  const owner = { handleShortcut() { calls++; return true } }
  const release = guard.enter(owner)
  const context = { target: {} as Element, region: 'editable' as const, modal: null }
  const resolutions = [EDITOR_UNDO_SHORTCUT_ID, EDITOR_REDO_SHORTCUT_ID].map(id => {
    const command = service.commands.get(id)!
    assert.equal(command.resolve({ ...context, modal: 'other' }).status, 'pass')
    assert.equal(command.resolve({ ...context, region: 'page' }).status, 'pass')
    assert.equal(command.resolve({ ...context, target: null }).status, 'pass')
    assert.equal(command.resolve({ ...context, source: 'iframe' }).status, 'pass')
    assert.equal(command.resolve({ ...context, source: 'webview' }).status, 'pass')
    return command.resolve(context)
  })
  release()
  for (const resolved of resolutions) if (resolved.status === 'handled') resolved.run()
  assert.equal(calls, 0)
  assert.equal(service.commands.size, 0)
  for (const [runtime, platform] of [['desktop', 'windows'], ['desktop', 'linux'], ['web', 'macos']] as const) {
    const other = new ShortcutFixture(runtime, platform)
    const focused = createHostEditorShortcuts(other)
    focused.enter(owner)
    assert.equal(other.normalRegistrations, 0, 'other shells keep existing local history dispatch')
    focused.dispose()
  }
})

test('failed Native history registration rolls back a new focus reservation and can be retried', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  const owner = { handleShortcut() { return true } }
  service.failCommandRegistration = true
  assert.throws(() => guard.enter(owner), /command registration failed/u)
  assert.equal(service.fixed.size, 0)
  assert.equal(service.commands.size, 0)
  service.failCommandRegistration = false
  guard.enter(owner)
  assert.equal(service.commands.size, 2)
  guard.dispose()
  assert.equal(service.commands.size, 0)
  assert.equal(service.fixed.size, 0)
})

test('failure registering the second history command rolls back the first command as well', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  const owner = { handleShortcut() { return true } }
  service.failCommandId = EDITOR_REDO_SHORTCUT_ID
  assert.throws(() => guard.enter(owner), /command registration failed/u)
  assert.equal(service.normalRegistrations, 1)
  assert.equal(service.commands.size, 0)
  assert.equal(service.fixed.size, 0)
  service.failCommandId = undefined
  guard.enter(owner)
  assert.equal(service.commands.size, 2)
  guard.dispose()
  assert.equal(service.commands.size, 0)
  assert.equal(service.fixed.size, 0)
})

test('both Native history registrations survive stale focus cleanup and restore after the final editor leaves', () => {
  const service = new ShortcutFixture('desktop', 'macos')
  const guard = createHostEditorShortcuts(service)
  const owner = { handleShortcut() { return true } }, other = { handleShortcut() { return true } }
  const stale = guard.enter(owner), latest = guard.enter(owner), releaseOther = guard.enter(other)
  assert.equal(service.normalRegistrations, 2)
  stale(); releaseOther()
  assert.equal(service.commands.size, 2)
  latest()
  assert.equal(service.commands.size, 0)
  assert.equal(service.fixed.size, 0)
})
