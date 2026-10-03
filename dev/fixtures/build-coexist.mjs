import { build } from 'esbuild'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { 'out-dir': { type: 'string' } } })
const fixtureDir = dirname(fileURLToPath(import.meta.url))
const output = values['out-dir'] ? resolve(values['out-dir']) : await mkdtemp(join(tmpdir(), 'dsh-jot-coexist-fixture-'))
await mkdir(join(output, 'lib'), { recursive: true })
const client = await build({
  entryPoints: [join(fixtureDir, 'coexist-client.tsx')], bundle: true, platform: 'browser',
  format: 'cjs', target: 'es2022', minify: true, write: false,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  define: { 'process.env.NODE_ENV': '"production"' },
})
const body = client.outputFiles[0].text
await writeFile(join(output, 'lib/client.js'), `window.__ModuleLoader__.load({id:"dsh-jot-coexist-fixture",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${body}\nreturn module.exports;}});\n`)
await writeFile(join(output, 'lib/index.js'), 'export const name = "dsh-jot-coexist-fixture"; export function apply() {}\n')
await writeFile(join(output, 'cordis.patch.yml'), '- insert:\n    - id: dsh-jot-coexist-fixture\n      name: dsh-jot-coexist-fixture\n')
await writeFile(join(output, 'package.json'), JSON.stringify({
  name: 'dsh-jot-coexist-fixture', version: '0.0.1', private: true, type: 'module',
  description: 'Test-only additive decoration and native-sidebar coexistence fixture for Jot.',
  main: 'lib/index.js', exports: { '.': './lib/index.js', './client': './lib/client.js', './package.json': './package.json' },
  files: ['lib', 'cordis.patch.yml'],
  engines: { dsh: '>=0.2.0-rc.2 <0.3.0' },
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar-right'] },
  },
}, null, 2) + '\n')
console.log(output)
