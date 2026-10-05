import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tidyMenuEntries, type ActionMenuEntry } from '../src/client/ActionMenu.js'

test('menus never show a leading, trailing or doubled divider when optional groups are absent', () => {
  const item = (label: string): ActionMenuEntry => ({ label, onSelect() {} })
  const divider: ActionMenuEntry = { separator: true }
  const labels = (entries: ActionMenuEntry[]) => tidyMenuEntries(entries).map(entry =>
    'separator' in entry ? '—' : 'heading' in entry ? `#${entry.heading}` : entry.label)
  assert.deepEqual(labels([divider, item('a'), divider, divider, item('b'), divider]), ['a', '—', 'b'])
  assert.deepEqual(labels([{ heading: 'Sort' }, item('a'), divider, divider, item('Shortcuts'), item('Empty Trash')]),
    ['#Sort', 'a', '—', 'Shortcuts', 'Empty Trash'])
  assert.deepEqual(labels([divider, divider]), [])
})
