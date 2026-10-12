import assert from 'node:assert/strict'
import { test } from 'node:test'
import { jotStyles } from '../src/client/styles.js'

test('keyboard focus on the title and editor body uses the accent outline', () => {
  assert.match(jotStyles, /\.jot-title-input:focus-visible\{outline:2px solid var\(--jot-accent\);outline-offset:3px\}/)
  assert.match(jotStyles, /\.jot-editor-mount \.ProseMirror:focus-visible\{outline:2px solid var\(--jot-accent\);outline-offset:2px\}/)
  assert.doesNotMatch(jotStyles, /\.ProseMirror:focus-visible\{outline:0\}/)
  assert.match(jotStyles, /\.jot-table-column-resize:focus-visible\{outline:2px solid var\(--jot-accent\);outline-offset:1px\}/)
  assert.match(jotStyles, /\.jot-table-column-resize\{[^}]*pointer-events:none/)
  assert.doesNotMatch(jotStyles, /\.jot-table-column-resize\{[^}]*pointer-events:auto/)
  assert.match(jotStyles, /\.jot-table-width-status\{[^}]*clip:rect\(0,0,0,0\)/)
  assert.match(jotStyles, /\.jot-link-popover\{width:min\(320px/)
  assert.doesNotMatch(jotStyles, /\.jot-link-popover\{position:fixed/)
})
