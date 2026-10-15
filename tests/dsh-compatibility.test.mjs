import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const sdkNames = Object.keys(pkg.peerDependencies).filter(name => name.startsWith('@deepseek-ai/dsh-'))

test('DSH compatibility preserves bounded host support and includes the alpha.3 Cordis/Schemastery contracts', () => {
  assert.equal(pkg.engines.dsh, '^0.2.0-rc.2 || ^0.2.1-alpha.1')
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '~4.0.4 || 4.0.5-alpha.1 || 4.0.5-alpha.2')
  assert.equal(pkg.peerDependencies['@deepseek-ai/schemastery'], '~3.18.4 || 3.18.5-alpha.1 || 3.18.5-alpha.2')
  assert.equal(pkg.devDependencies['@deepseek-ai/cordis'], '4.0.5-alpha.2')
  assert.equal(pkg.devDependencies['@deepseek-ai/schemastery'], '3.18.5-alpha.2')
  assert.equal(sdkNames.length, 13, 'all directly used host and client SDK packages are checked')
})

for (const name of sdkNames) {
  test(`${name} delegates SDK version selection to the host instead of an enumerated release list`, () => {
    assert.equal(pkg.peerDependencies[name], '*')
    assert.equal(pkg.dependencies[name], undefined, 'host SDK packages must not ship a second runtime copy')
  })

  test(`${name} development pin selects the alpha.3 SDK for build and test validation`, () => {
    assert.equal(pkg.devDependencies[name], '0.2.1-alpha.3')
  })

  test(`${name} installed SDK is alpha.3 rather than a stale earlier installation`, () => {
    const installed = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'))
    assert.equal(installed.version, '0.2.1-alpha.3', 'installed types must match the tested host SDK')
  })
}

for (const [name, version] of [
  ['@deepseek-ai/cordis', '4.0.5-alpha.2'],
  ['@deepseek-ai/schemastery', '3.18.5-alpha.2'],
]) {
  test(`${name} installed runtime matches the alpha.3 SDK dependency contract`, () => {
    const installed = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'))
    assert.equal(installed.version, version)
  })
}

for (const [readme, guide] of [
  ['README.md', 'docs/GUIDE.zh-CN.md'],
  ['README.en.md', 'docs/GUIDE.en.md'],
]) {
  const readmeText = readFileSync(new URL(`../${readme}`, import.meta.url), 'utf8')
  const guideText = readFileSync(new URL(`../${guide}`, import.meta.url), 'utf8')

  test(`${guide} upgrades alpha.3 Web by removing the installed package before adding its replacement`, () => {
    assert.match(guideText, /dsh plugin --profile web remove dsh-jot\s*\ndsh plugin --profile web add dsh-jot@latest/u)
    assert.match(guideText, /already-installed/u)
    assert.match(guideText, /dsh-v0\.2\.1-alpha\.3\/docs\/upgrade-guide\/v0\.2\.1-alpha\.2\/plugin-install-over-installed\/guide/u)
  })

  test(`${readme} and its upgrade guide distinguish alpha.3 Web from the official rc.2 Desktop`, () => {
    assert.match(readmeText, /alpha\.3.*Web/u)
    assert.match(guideText, /0\.2\.0-rc\.2/u)
    assert.ok(readmeText.includes(guide.replace('docs/', './docs/')))
    assert.doesNotMatch(guideText, /(?:rm|rmdir)\s+[^\n]*(?:\.dsh|DSH_HOME|\/jot)/u)
  })
}
