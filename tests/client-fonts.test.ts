import assert from 'node:assert/strict'
import { test } from 'node:test'
import { jotStyles } from '../src/client/styles.js'

function property(selector: string, name: string): string {
  const rule = [...jotStyles.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
    .find(match => match[1]!.trim() === selector)
  assert.ok(rule, `missing style rule: ${selector}`)
  const declaration = rule[2]!.split(';').find(value => value.startsWith(`${name}:`))
  assert.ok(declaration, `missing ${name} in ${selector}`)
  return declaration.slice(name.length + 1)
}

/** Resolve only this stylesheet's nested var() fallback contract, not the browser cascade.
 * Real host computed-style acceptance is recorded separately from these contract tests. */
function resolveVariables(value: string, variables: Record<string, string>): string {
  while (value.includes('var(')) {
    const start = value.indexOf('var(')
    let end = start + 4, depth = 1, comma = -1
    for (; end < value.length; end++) {
      if (value[end] === '(') depth++
      else if (value[end] === ')' && --depth === 0) break
      else if (value[end] === ',' && depth === 1 && comma < 0) comma = end
    }
    assert.equal(depth, 0, `unbalanced variable fallback: ${value}`)
    const name = value.slice(start + 4, comma < 0 ? end : comma).trim()
    const fallback = comma < 0 ? '' : value.slice(comma + 1, end)
    const replacement = Object.hasOwn(variables, name) ? variables[name]! : fallback
    value = value.slice(0, start) + resolveVariables(replacement, variables) + value.slice(end + 1)
  }
  return value
}

const codeFamily = () => property('.jot-editor-mount .ProseMirror code', 'font-family')
const inlineSize = () => property('.jot-editor-mount .ProseMirror code', 'font-size')
const blockSize = () => property('.jot-editor-mount .ProseMirror pre code', 'font-size')

test('document code prefers the canonical host code family over the legacy mono alias', () => {
  assert.equal(resolveVariables(codeFamily(), {
    '--ds-font-family-code': '"Host Code",monospace',
    '--dsw-font-family-mono': '"Legacy Mono",monospace',
    '--dsw-font-family': '"Ordinary Prose",sans-serif',
  }), '"Host Code",monospace')
})

test('document code retains the old-host mono alias and ultimately the system monospace stack', () => {
  assert.equal(resolveVariables(codeFamily(), { '--dsw-font-family-mono': '"Legacy Mono",monospace' }),
    '"Legacy Mono",monospace')
  assert.equal(resolveVariables(codeFamily(), {}), 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace')
})

test('only document code sizes follow the explicit host code size', () => {
  for (const size of ['12px', '19px', '26px']) {
    const variables = { '--dsh-code-font-size': size, '--dsh-content-font-size': '16px' }
    assert.equal(resolveVariables(inlineSize(), variables), size)
    assert.equal(resolveVariables(blockSize(), variables), size)
    assert.equal(resolveVariables(property('.jot-editor-mount .ProseMirror', 'font-size'), variables), '16px')
  }
  const codeSizeRules = [...jotStyles.matchAll(/([^{}]+)\{([^{}]*--dsh-code-font-size[^{}]*)\}/gu)]
    .map(match => match[1]!.trim())
  assert.deepEqual(codeSizeRules, ['.jot-editor-mount .ProseMirror code', '.jot-editor-mount .ProseMirror pre code'])
})

test('old hosts retain the existing relative inline and block code sizes', () => {
  assert.equal(resolveVariables(inlineSize(), {}), '.9em')
  assert.equal(resolveVariables(blockSize(), {}), '.88em')
})

test('ordinary text still inherits its host family and code toolbar glyphs are not resized', () => {
  assert.equal(resolveVariables(property('.jot-app', 'font-family'), { '--dsw-font-family': '"Host Prose",sans-serif' }),
    '"Host Prose",sans-serif')
  assert.equal(resolveVariables(property('.jot-app', 'font-family'), {}), 'inherit')
  assert.equal(property('.jot-format-glyph', 'font-size'), '12px')
  assert.doesNotMatch(property('.jot-format-code .jot-format-glyph,.jot-format-codeBlock .jot-format-glyph', 'font-family'),
    /--ds-font-family-code/u)
})
