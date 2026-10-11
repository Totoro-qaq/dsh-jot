import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const sdkNames = Object.keys(pkg.peerDependencies).filter(name => name.startsWith('@deepseek-ai/dsh-'))

test('DSH compatibility preserves the existing engine range and Cordis/Schemastery contracts', () => {
  assert.equal(pkg.engines.dsh, '^0.2.0-rc.2 || ^0.2.1-alpha.1')
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '~4.0.4 || 4.0.5-alpha.1')
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '~3.18.4 || 3.18.5-alpha.1')
  assert.equal(pkg.devDependencies['@deepseek-ai/cordis'], '4.0.5-alpha.1')
  assert.equal(pkg.devDependencies['@deepseek-ai/schemastery'], '3.18.5-alpha.1')
  assert.equal(sdkNames.length, 13, 'all directly used host and client SDK packages are checked')
})

for (const name of sdkNames) {
  test(`${name} delegates SDK version selection to the host instead of an enumerated release list`, () => {
    assert.equal(pkg.peerDependencies[name], '*')
    assert.equal(pkg.dependencies[name], undefined, 'host SDK packages must not ship a second runtime copy')
  })

  test(`${name} development pin selects the actual alpha.2 SDK for build and test validation`, () => {
    assert.equal(pkg.devDependencies[name], '0.2.1-alpha.2')
    const installed = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'))
    assert.equal(installed.version, pkg.devDependencies[name], 'installed types must match the declared development SDK')
  })
}
