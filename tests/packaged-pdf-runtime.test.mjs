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

async function packagedProfile(root) {
  await legacyProfile(root)
  const lib = join(root, 'lib')
  await mkdir(lib)
  await cp(resolve('assets/fonts'), join(root, 'assets', 'fonts'), { recursive: true })
  await build({ ...bundle.hostBuildOptions, entryPoints: ['src/exports.ts'], outfile: join(lib, 'exports.mjs') })
  if (bundle.pdfRuntimeBuildOptions) {
    await build({ ...bundle.pdfRuntimeBuildOptions, outfile: join(lib, 'pdf-runtime.cjs') })
    await cp(join(pdfkitRoot, 'js', 'data'), join(lib, 'data'), { recursive: true })
  }
  return pathToFileURL(join(lib, 'exports.mjs')).href
}

function runPackaged(script) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  return result.stdout
}

test('packaged exports work with an old profile whose Unicode 1.4.0 require entry is broken', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-legacy-pdf-'))
  try {
    const entry = await packagedProfile(root)
    const script = String.raw`
      import assert from 'node:assert/strict';
      import { inflateSync } from 'node:zlib';
      const { exportJotNote, exportHealth } = await import(${JSON.stringify(entry)});
      exportHealth.start();
      await Promise.all([exportHealth.require('pdf'), exportHealth.require('docx')]);
      assert.equal(exportHealth.snapshot().pdf.status, 'ready');
      assert.equal(exportHealth.snapshot().docx.status, 'ready');
      const id = '0123456789abcdef0123456789abcdef';
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
      const content = { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: '旧环境中的中文笔记' }] },
        { type: 'image', attrs: { attachmentId: id, alt: '中文图片' } },
        ...Array.from({ length: 110 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: '多页中文笔记 ' + index }] })),
        { type: 'paragraph', content: [{ type: 'text', text: '尾' }] },
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
      const raw = pdf.buffer.toString('latin1');
      const pages = (raw.match(/\/Type \/Page\b/g) ?? []).length;
      assert.ok(pages >= 3, 'long Chinese text is paginated');
      const streams = [];
      const matcher = /<<[^]*?>>\s*stream\r?\n/g;
      let match;
      while ((match = matcher.exec(raw))) {
        const start = matcher.lastIndex, end = raw.indexOf('\nendstream', start);
        if (end < 0) break;
        try { streams.push((match[0].includes('/FlateDecode') ? inflateSync(pdf.buffer.subarray(start, end)) : pdf.buffer.subarray(start, end)).toString('latin1')); } catch {}
        matcher.lastIndex = end + 10;
      }
      assert.ok(streams.some(stream => stream.includes('5c3e')), 'final Chinese glyph has a Unicode mapping');
      const bodies = streams.filter(stream => /\/F\d+ [\d.]+ Tf/.test(stream));
      assert.equal(bodies.length, pages);
      for (const body of bodies) assert.equal((body.match(/\/F\d+ 8 Tf/g) ?? []).length, 1, 'each page retains a footer');
      console.log('legacy-profile TXT, CJK PDF and PNG PASS');
    `
    assert.match(runPackaged(script), /CJK PDF and PNG PASS/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const failure of ['missing-pdf-font', 'broken-docx']) {
  test(`packaged startup reports ${failure} before export while other formats remain usable`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'jot-export-isolation-'))
    try {
      const entry = await packagedProfile(root)
      if (failure === 'missing-pdf-font') {
        await rm(join(root, 'assets', 'fonts', 'NotoSansSC-Bold.otf'))
      } else {
        // Replace only the synthetic profile's symlink, never its target.
        const directory = join(root, 'node_modules', 'docx')
        await rm(directory)
        await mkdir(directory)
        await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'docx', main: './missing-engine.cjs' }))
      }
      runPackaged(`
        import assert from 'node:assert/strict';
        const { exportJotNote, exportHealth } = await import(${JSON.stringify(entry)});
        const broken = ${JSON.stringify(failure === 'broken-docx' ? 'docx' : 'pdf')};
        const healthy = broken === 'pdf' ? 'docx' : 'pdf';
        const note = { title: 'Independent note', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '仍然能用' }] }] } };
        exportHealth.start();
        await exportHealth.require(healthy);
        await assert.rejects(exportHealth.require(broken), { code: broken.toUpperCase() + '_ENGINE_UNAVAILABLE' });
        assert.equal(exportHealth.snapshot()[broken].status, 'unavailable');
        assert.equal(exportHealth.snapshot()[healthy].status, 'ready');
        assert.ok((await exportJotNote(note, 'txt')).buffer.length > 0);
        assert.ok((await exportJotNote(note, healthy)).buffer.length > 0);
        await assert.rejects(exportJotNote(note, broken), { code: broken.toUpperCase() + '_ENGINE_UNAVAILABLE' });
      `)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}
