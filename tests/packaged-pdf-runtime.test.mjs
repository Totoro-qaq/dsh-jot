import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'
import * as bundle from '../scripts/bundle.mjs'

const require = createRequire(import.meta.url)
const pdfkitRoot = dirname(require.resolve('pdfkit/package.json'))
const fontkitRoot = await realpath(join(dirname(pdfkitRoot), 'fontkit'))
const unicodeRoot = await realpath(join(dirname(fontkitRoot), 'unicode-properties'))

async function legacyProfile(root) {
  const modules = join(root, 'node_modules')
  await mkdir(modules, { recursive: true })
  const controlled = new Set(['pdfkit', 'fontkit', 'unicode-properties'])
  for (const [name, source] of [['pdfkit', pdfkitRoot], ['fontkit', fontkitRoot], ['unicode-properties', unicodeRoot]]) {
    const destination = join(modules, name)
    await cp(source, destination, { recursive: true })
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (controlled.has(dependency)) continue
      const link = join(modules, dependency)
      await mkdir(dirname(link), { recursive: true })
      await symlink(await realpath(join(dirname(source), dependency)), link).catch(error => {
        if (error.code !== 'EEXIST') throw error
      })
    }
  }
  for (const name of ['docx', 'fflate']) {
    await symlink(await realpath(resolve('node_modules', name)), join(modules, name))
  }
  // Reproduce the exact installed 1.4.0 manifest defect, without reading or
  // modifying the user's real profile. The existing dist files are unchanged.
  const filename = join(modules, 'unicode-properties', 'package.json')
  const manifest = JSON.parse(await readFile(filename, 'utf8'))
  manifest.version = '1.4.0'
  manifest.exports.require = './dist.main.cjs'
  await writeFile(filename, JSON.stringify(manifest))
  const profileRequire = createRequire(join(modules, 'fontkit', 'dist', 'main.cjs'))
  assert.throws(() => profileRequire.resolve('unicode-properties'), error =>
    error.code === 'MODULE_NOT_FOUND' && error.message.includes('dist.main.cjs'))
}

test('packaged exports work with an old profile whose Unicode 1.4.0 require entry is broken', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-legacy-pdf-'))
  try {
    await legacyProfile(root)
    const lib = join(root, 'lib')
    await mkdir(lib)
    await build({ ...bundle.hostBuildOptions, entryPoints: ['src/exports.ts'], outfile: join(lib, 'exports.mjs') })
    if (bundle.pdfRuntimeBuildOptions) {
      await build({ ...bundle.pdfRuntimeBuildOptions, outfile: join(lib, 'pdf-runtime.cjs') })
      await cp(join(pdfkitRoot, 'js', 'data'), join(lib, 'data'), { recursive: true })
    }
    const script = `
      import assert from 'node:assert/strict';
      const { exportJotNote } = await import(${JSON.stringify(pathToFileURL(join(lib, 'exports.mjs')).href)});
      const id = '0123456789abcdef0123456789abcdef';
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
      const content = { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: '旧环境中的中文笔记' }] },
        { type: 'image', attrs: { attachmentId: id, alt: '中文图片' } },
      ] };
      const txt = await exportJotNote({ title: '保留笔记', content }, 'txt');
      assert.match(txt.buffer.toString('utf8'), /旧环境中的中文笔记/);
      const pdf = await exportJotNote({ title: 'PDF 中文图片', content }, 'pdf', {
        fontDirectory: ${JSON.stringify(resolve('assets/fonts'))},
        attachmentLoader: async () => ({ name: '图片.png', mimeType: 'image/png', size: png.length, data: png }),
      });
      assert.equal(pdf.buffer.subarray(0, 5).toString(), '%PDF-');
      assert.ok(pdf.buffer.toString('latin1').includes('/Subtype /Image'));
      assert.ok(pdf.buffer.length > 10_000);
      console.log('legacy-profile TXT, CJK PDF and PNG PASS');
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 30_000 })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    assert.match(result.stdout, /CJK PDF and PNG PASS/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
