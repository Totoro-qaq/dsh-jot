import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import type { Context } from '@deepseek-ai/cordis'
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
  const effects: (() => void)[] = []
  const retain = (result: unknown) => { if (typeof result === 'function') effects.push(result as () => void) }
  const context = {
    locale,
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
    sidebarRight: { openTab() {} },
    layout: { selectPanel() {} },
    effect(operation: () => unknown) { retain(operation()); return () => {} },
  }
  const component = (key: string) => {
    const result = bodies.get(key)
    assert.ok(result, `missing native registration ${key}`)
    return result
  }
  return { locale, bodies, tabTypes, registrations, component, context,
    mount() { apply(context as unknown as Context) },
    unmount() { for (const dispose of effects.splice(0).reverse()) dispose() },
  }
}

test('native memo entry retains LocaleRuntime this binding across both React surfaces', () => {
  const { locale, registrations, component, mount, unmount } = entryFixture()
  mount()
  // getServerSnapshot invokes exactly the function handed to useSyncExternalStore.
  assert.doesNotThrow(() => renderToString(createElement(component(`main:${PANEL_ID}`))))
  assert.doesNotThrow(() => renderToString(createElement(component(`sidebar.right.pane.tab:${TAB_ID}`))))
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
