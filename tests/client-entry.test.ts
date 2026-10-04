import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement, Fragment, type ComponentType, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { Context } from '@deepseek-ai/cordis'
import type { ShortcutCommand, ShortcutContext } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { SidebarRightTabInfo } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { JotAppProps } from '../src/client/App.js'
import { consumeJotCommand } from '../src/client/commands.js'
import { apply, PANEL_ID, TAB_ID } from '../src/client/index.js'
import { JotIcon } from '../src/client/JotIcon.js'

/** Match public LocaleRuntime's prototype-method shape, including its required `this`. */
class LocaleFixture {
  private snapshot = { active: 'zh', locales: [], revision: 0 }
  private listeners = new Set<() => void>()
  getSnapshot() { return this.snapshot }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  select(active: string) {
    this.snapshot = { ...this.snapshot, active, revision: this.snapshot.revision + 1 }
    for (const listener of this.listeners) listener()
  }
}

function entryFixture() {
  const locale = new LocaleFixture()
  const bodies = new Map<string, ComponentType<any>>()
  const registrations: Record<string, unknown>[] = []
  const tabTypes = new Map<string, Record<string, any>>()
  const keyboardCommands = new Map<string, ShortcutCommand>()
  const selectedPanels: unknown[] = []
  const openedTabs: string[] = []
  let panelId: unknown = null
  let seatMounted: unknown = undefined
  const activeTabs = new Map<string, string>()
  const lifetimes = new Map<string, AbortController>()
  const occurrence = (sessionId: string, tab: { id: string }) => {
    const key = `${sessionId}:${tab.id}`
    if (!lifetimes.has(key)) lifetimes.set(key, new AbortController())
    return { signal: lifetimes.get(key)!.signal }
  }
  const effects: (() => void)[] = []
  const retain = (result: unknown) => { if (typeof result === 'function') effects.push(result as () => void) }
  const context = {
    locale,
    shortcuts: {
      runtime: 'web', platform: 'macos',
      register(command: ShortcutCommand) {
        assert.equal(keyboardCommands.has(command.id), false, 'duplicate keyboard registration')
        keyboardCommands.set(command.id, command)
        return () => { if (keyboardCommands.get(command.id) === command) keyboardCommands.delete(command.id) }
      },
    },
    slots: {
      inject(_name: string, operation: () => unknown) { retain(operation()); return () => {} },
      register(options: Record<string, unknown>, component: ComponentType<any>) {
        const key = `${options.name}:${options.key ?? options.id}`
        assert.ok(!bodies.has(key), `duplicate registration ${key}`)
        bodies.set(key, component)
        registrations.push(options)
        return () => { bodies.delete(key) }
      },
    },
    sidebarRightTabs: { register(definition: Record<string, any>) {
      assert.ok(!tabTypes.has(definition.id), 'duplicate tab type')
      tabTypes.set(definition.id, definition)
      return () => { tabTypes.delete(definition.id) }
    } },
    sidebarRight: { mounted: { getSnapshot: () => seatMounted, subscribe() { return () => {} } },
      active() { return typeof seatMounted === 'string' ? { id: activeTabs.get(seatMounted) ?? 'jot-tab', kind: 'dsh-jot' } : undefined },
      tabDomain: { occurrence }, openTab(kind: string) { openedTabs.push(kind) },
    },
    layout: { panelInfo: { getSnapshot: () => ({ activePanelId: panelId }), subscribe() { return () => {} } }, selectPanel(id: unknown) { panelId = id; selectedPanels.push(id) } },
    effect(operation: () => unknown) { retain(operation()); return () => {} },
  }
  const component = (key: string) => {
    const result = bodies.get(key)
    assert.ok(result, `missing native registration ${key}`)
    return result
  }
  return { locale, bodies, tabTypes, keyboardCommands, selectedPanels, openedTabs, registrations, component, context,
    showConversation(sessionId = 'conversation-a', tabId = 'jot-tab') { panelId = null; seatMounted = sessionId; activeTabs.set(sessionId, tabId) },
    compactProps(sessionId = 'conversation-a', tabId = 'jot-tab') {
      return { sessionId, useTabInfo: () => ({
        sidebar: { expanded: true, fullscreen: false }, panel: { id: `pane-${tabId}` },
        tab: { id: tabId, kind: 'dsh-jot', visible: seatMounted === sessionId, signal: occurrence(sessionId, { id: tabId }).signal },
      } as unknown as SidebarRightTabInfo) }
    },
    closeTab(sessionId: string, tabId: string) { lifetimes.get(`${sessionId}:${tabId}`)?.abort() },
    mount() { apply(context as unknown as Context) },
    unmount() { for (const dispose of effects.splice(0).reverse()) dispose() },
  }
}

test('native memo entry retains LocaleRuntime this binding across both React surfaces', () => {
  const { locale, registrations, component, mount, unmount, compactProps } = entryFixture()
  mount()
  // getServerSnapshot invokes exactly the function handed to useSyncExternalStore.
  assert.doesNotThrow(() => renderToString(createElement(component(`main:${PANEL_ID}`))))
  assert.doesNotThrow(() => renderToString(createElement(component(`sidebar.right.pane.tab:${TAB_ID}`), compactProps())))
  locale.select('en')
  assert.doesNotThrow(() => renderToString(createElement(component(`main:${PANEL_ID}`))))
  const sidebar = registrations.find(options => options.name === 'sidebar.panellist')!
  assert.equal((sidebar.label as () => string)(), 'Jot')
  unmount()
})

test('Jot adds isolated native entries beside other plugins and releases its registrations', () => {
  const fixture = entryFixture()
  const Foreign = () => createElement('span', null, 'Existing feature')
  for (const options of [
    { name: 'main', key: 'other-panel' },
    { name: 'sidebar.panellist', id: 'other-panel' },
    { name: 'conversation.input.left', id: 'other-plugin/open' },
    { name: 'sidebar' },
    { name: 'shell.leading' },
  ]) fixture.context.slots.register(options, Foreign)
  const original = new Map(fixture.bodies)
  fixture.mount()
  for (const [key, component] of original) assert.equal(fixture.bodies.get(key), component)
  assert.equal(fixture.bodies.has('conversation.input.left:dsh-jot/open'), false)
  assert.equal(fixture.bodies.has(`main:${PANEL_ID}`), true)
  assert.equal(fixture.bodies.has(`sidebar.right.pane.tab:${TAB_ID}`), true)
  assert.equal(fixture.tabTypes.get(TAB_ID)?.guide[0].icon, JotIcon)
  fixture.unmount()
  assert.deepEqual(fixture.bodies, original)
  assert.equal(fixture.tabTypes.size, 0)
})

test('the notebook icon accepts native expanded and rail sizes without wrapping a navigation button', () => {
  const fixture = entryFixture()
  fixture.mount()
  const Icon = fixture.component(`sidebar.panellist:${PANEL_ID}`)
  for (const size of [16, 18]) {
    const html = renderToString(createElement(Icon, { size, active: true }))
    assert.match(html, new RegExp(`width="${size}" height="${size}"`, 'u'))
    assert.match(html, /display:block/u)
    assert.doesNotMatch(html, /<button/u)
    const colors = new Set([...html.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/giu)].map(match => match[1]))
    assert.ok(colors.size >= 3, 'the product mark remains colorful in both native icon sizes')
  }
  fixture.unmount()
})

test('the native entry registers all keyboard settings rows, routes to visible surfaces, and cleans up for remount', () => {
  const fixture = entryFixture()
  const keyboardContext: ShortcutContext = { target: null, region: 'page', modal: null, source: 'keyboard' }
  const invoke = (id: string) => {
    const resolution = fixture.keyboardCommands.get(id)!.resolve(keyboardContext)
    assert.equal(resolution.status, 'handled')
    if (resolution.status === 'handled') resolution.run()
  }
  fixture.mount()
  assert.deepEqual([...fixture.keyboardCommands.keys()].sort(), ['dsh-jot.capture', 'dsh-jot.new-note', 'dsh-jot.open'])
  fixture.locale.select('en')
  assert.equal(fixture.keyboardCommands.get('dsh-jot.new-note')!.label(), 'Jot: New note')
  invoke('dsh-jot.open')
  assert.deepEqual(fixture.selectedPanels, [PANEL_ID])
  invoke('dsh-jot.new-note')
  assert.equal(fixture.selectedPanels.at(-1), PANEL_ID)
  fixture.showConversation()
  invoke('dsh-jot.capture')
  assert.deepEqual(fixture.openedTabs, ['dsh-jot'])
  fixture.unmount()
  assert.equal(fixture.keyboardCommands.size, 0)
  fixture.mount()
  assert.equal(fixture.keyboardCommands.size, 3)
  fixture.unmount()
})

/** Render the actual registered React entry twice with the host's public slot props. */
function renderCompactSlots(fixture: ReturnType<typeof entryFixture>, slots: Array<{ sessionId: string; tabId: string }>): JotAppProps[] {
  const result: JotAppProps[] = []
  const Native = fixture.component(`sidebar.right.pane.tab:${TAB_ID}`) as (props: ReturnType<typeof fixture.compactProps>) => ReactElement<JotAppProps>
  function Probe({ index }: { index: number }) {
    const slot = slots[index]!
    const element = Native(fixture.compactProps(slot.sessionId, slot.tabId))
    result[index] = element.props
    return element
  }
  renderToString(createElement(Fragment, null, slots.map((_slot, index) => createElement(Probe, { key: index, index }))))
  return result
}

for (const [id, expectedAction] of [['dsh-jot.new-note', 'new'], ['dsh-jot.capture', 'capture']] as const) {
  test(`${id}: two retained conversation entries execute only in the foreground slot`, () => {
    const fixture = entryFixture()
    fixture.mount()
    fixture.showConversation('conversation-zh', 'same-tab-id')
    const resolved = fixture.keyboardCommands.get(id)!.resolve({ target: null, region: 'page', modal: null, source: 'keyboard' })
    assert.equal(resolved.status, 'handled')
    if (resolved.status === 'handled') resolved.run()
    const [hidden, foreground] = renderCompactSlots(fixture, [
      { sessionId: 'conversation-en', tabId: 'same-tab-id' }, { sessionId: 'conversation-zh', tabId: 'same-tab-id' },
    ])
    assert.equal(hidden!.commandRequest, undefined)
    const request = foreground!.commandRequest!
    assert.equal(request.action, expectedAction)
    assert.equal(hidden!.onCommandClaim!(request.revision), false, 'hidden effect cannot acquire the foreground request')
    let sideEffects = 0
    const consume = () => consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled: 0 }, {
      claim: foreground!.onCommandClaim, run: action => { assert.equal(action.action, expectedAction); sideEffects++ },
    })
    consume(); consume()
    assert.equal(sideEffects, 1, expectedAction === 'capture' ? 'one command opens one capture modal' : 'one command creates one note')
    fixture.unmount()
    assert.equal(foreground!.onCommandClaim!(request.revision), false)
  })
}

test('two visible Jot tabs in different panes receive only the captured active tab', () => {
  const fixture = entryFixture()
  fixture.mount()
  fixture.showConversation('conversation-zh', 'right-jot')
  const resolved = fixture.keyboardCommands.get('dsh-jot.capture')!.resolve({ target: null, region: 'page', modal: null })
  if (resolved.status === 'handled') resolved.run()
  const [left, right] = renderCompactSlots(fixture, [
    { sessionId: 'conversation-zh', tabId: 'left-jot' }, { sessionId: 'conversation-zh', tabId: 'right-jot' },
  ])
  assert.equal(left!.commandRequest, undefined)
  const request = right!.commandRequest!
  assert.equal(left!.onCommandClaim!(request.revision), false)
  assert.equal(right!.onCommandClaim!(request.revision), true)
  fixture.unmount()
})

test('a pending busy slot cannot execute after session switching and resumes only when its owner returns', () => {
  const fixture = entryFixture()
  fixture.mount()
  fixture.showConversation('conversation-zh', 'jot-tab')
  const resolved = fixture.keyboardCommands.get('dsh-jot.new-note')!.resolve({ target: null, region: 'page', modal: null })
  if (resolved.status === 'handled') resolved.run()
  const scopes = [{ sessionId: 'conversation-zh', tabId: 'jot-tab' }, { sessionId: 'conversation-en', tabId: 'jot-tab' }]
  const before = renderCompactSlots(fixture, scopes)
  const request = before[0]!.commandRequest!
  let runs = 0
  assert.equal(consumeJotCommand(request, { ready: true, busy: true, blocked: false, lastHandled: 0 }, {
    claim: before[0]!.onCommandClaim, run() { runs++ },
  }), 0)
  fixture.showConversation('conversation-en', 'jot-tab')
  assert.equal(before[0]!.onCommandClaim!(request.revision), false, 'a stale effect checks live host selection before claim')
  const switched = renderCompactSlots(fixture, scopes)
  assert.equal(switched[0]!.commandRequest, undefined)
  assert.equal(switched[1]!.commandRequest, undefined, 'the pending request is never redirected')
  fixture.showConversation('conversation-zh', 'jot-tab')
  const returned = renderCompactSlots(fixture, scopes)
  assert.equal(returned[0]!.commandRequest, request)
  consumeJotCommand(request, { ready: true, busy: false, blocked: false, lastHandled: 0 }, {
    claim: returned[0]!.onCommandClaim, run() { runs++ },
  })
  assert.equal(runs, 1)
  fixture.unmount()
})

test('closing a pending compact tab and unmounting the plugin invalidate previously rendered claims', () => {
  const fixture = entryFixture()
  fixture.mount()
  fixture.showConversation('conversation-zh', 'jot-tab')
  const resolved = fixture.keyboardCommands.get('dsh-jot.capture')!.resolve({ target: null, region: 'page', modal: null })
  if (resolved.status === 'handled') resolved.run()
  const [rendered] = renderCompactSlots(fixture, [{ sessionId: 'conversation-zh', tabId: 'jot-tab' }])
  const request = rendered!.commandRequest!
  fixture.closeTab('conversation-zh', 'jot-tab')
  assert.equal(rendered!.onCommandClaim!(request.revision), false)
  fixture.unmount()
  assert.equal(rendered!.onCommandClaim!(request.revision), false)
  assert.equal(fixture.keyboardCommands.size, 0)
})
