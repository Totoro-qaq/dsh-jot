import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { collectBundleInputs } from '../scripts/bundle.mjs'
import { electsMit, noticeCoversPackage, packageLocation, writeThirdPartyNotices } from '../scripts/third-party-notices.mjs'

async function fixturePackage(root, { name, version, license, author, files }) {
  const directory = join(root, 'node_modules', ...name.split('/'))
  await mkdir(directory, { recursive: true })
  const manifest = { name, version, license }
  if (author) manifest.author = author
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest))
  for (const [file, contents] of Object.entries(files)) {
    const destination = join(directory, file)
    await mkdir(join(destination, '..'), { recursive: true })
    await writeFile(destination, contents)
  }
  return join(directory, 'index.js').split('\\').join('/')
}

const mitGrant = 'Permission is hereby granted, free of charge, to any person obtaining a copy'

test('package roots follow the last node_modules segment, including scoped names', () => {
  assert.equal(packageLocation('src/index.ts'), null)
  assert.equal(packageLocation('node_modules/.pnpm/fflate@0.8.2/node_modules/fflate/esm/browser.js'),
    'node_modules/.pnpm/fflate@0.8.2/node_modules/fflate')
  assert.equal(packageLocation('node_modules/.pnpm/@tiptap+core@3.31.4/node_modules/@tiptap/core/dist/index.js'),
    'node_modules/.pnpm/@tiptap+core@3.31.4/node_modules/@tiptap/core')
  assert.equal(packageLocation('C:\\pkg\\node_modules\\left-pad\\index.js'), 'C:\\pkg\\node_modules\\left-pad')
})

test('MIT is elected only for a pure OR expression that includes MIT', () => {
  assert.equal(electsMit('(MIT OR GPL-3.0-or-later)'), true)
  assert.equal(electsMit('Apache-2.0 OR MIT'), true)
  assert.equal(electsMit('MIT'), false)
  assert.equal(electsMit('GPL-3.0-or-later'), false)
  assert.equal(electsMit('MIT AND Apache-2.0'), false)
  assert.equal(electsMit('(MIT OR BSD-3-Clause) AND ISC'), false)
})

test('missing license files use the upstream copyright holder and the standard license text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-notices-'))
  const source = await fixturePackage(root, {
    name: 'header-only', version: '1.2.3', license: 'MIT',
    files: { 'index.js': '/* Copyright (c) 2018 Ada Lovelace */\nexport {}\n' },
  })
  const author = await fixturePackage(join(root, 'author'), {
    name: 'author-only', version: '4.0.0', license: 'ISC', author: 'Grace Hopper <grace@example.com>',
    files: { 'index.js': 'export {}\n' },
  })
  const apache = await fixturePackage(join(root, 'apache'), {
    name: 'apache-only', version: '1.0.0', license: 'Apache-2.0',
    files: { 'index.js': '// Copyright 2020 Test Foundation\nexport {}\n' },
  })
  const result = await writeThirdPartyNotices({
    inputs: [source, author, apache],
    licensesDir: join(root, 'LICENSES'),
    noticesFile: join(root, 'THIRD_PARTY_NOTICES.md'),
  })
  const header = await readFile(join(root, 'LICENSES', 'header-only@1.2.3.txt'), 'utf8')
  assert.match(header, /Copyright \(c\) 2018 Ada Lovelace/)
  assert.match(header, new RegExp(mitGrant))
  assert.match(header, /Copyright notice taken from index\.js/)
  assert.doesNotMatch(header, /<year>/)
  assert.equal(noticeCoversPackage(header), true)

  const isc = await readFile(join(root, 'LICENSES', 'author-only@4.0.0.txt'), 'utf8')
  assert.match(isc, /Copyright \(c\) Grace Hopper <grace@example\.com>/)
  assert.match(isc, /Permission to use, copy, modify/)
  assert.match(isc, /package\.json author/)
  assert.doesNotMatch(isc, /Internet Systems Consortium/)

  const apacheText = await readFile(join(root, 'LICENSES', 'apache-only@1.0.0.txt'), 'utf8')
  assert.match(apacheText, /Copyright 2020 Test Foundation/)
  assert.match(apacheText, /Grant of Copyright License/)
  assert.doesNotMatch(apacheText, /\[yyyy\]/)
  assert.deepEqual(result.packages.map(pkg => pkg.name).sort(), ['apache-only', 'author-only', 'header-only'])
})

test('dual-licensed packages record an MIT election and keep every shipped license file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-dual-'))
  const input = await fixturePackage(root, {
    name: 'jszip', version: '3.10.1', license: '(MIT OR GPL-3.0-or-later)',
    files: {
      'index.js': 'export {}\n',
      'LICENSE.markdown': `Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso\n\n${mitGrant} of this software.\n`,
      'LICENSE.gpl': 'GNU GENERAL PUBLIC LICENSE Version 3\n',
    },
  })
  const result = await writeThirdPartyNotices({
    inputs: [input], licensesDir: join(root, 'LICENSES'), noticesFile: join(root, 'THIRD_PARTY_NOTICES.md'),
  })
  const text = await readFile(join(root, 'LICENSES', 'jszip@3.10.1.txt'), 'utf8')
  assert.match(text, /Election: dsh-jot elects the MIT license\./)
  assert.match(text, /Stuart Knightley/)
  assert.match(text, /GNU GENERAL PUBLIC LICENSE/)
  assert.match(result.markdown, /`jszip@3\.10\.1` — \(MIT OR GPL-3\.0-or-later\); MIT elected/)
  assert.equal(result.packages[0].electedMit, true)

  const gplOnly = await fixturePackage(join(root, 'gpl-only'), {
    name: 'gpl-or-mit', version: '1.0.0', license: '(MIT OR GPL-3.0-or-later)',
    files: {
      'index.js': '',
      'COPYING': 'Copyright (c) 2009-2016 Stuart Knightley\n\nGNU GENERAL PUBLIC LICENSE Version 3\n',
    },
  })
  const elected = await writeThirdPartyNotices({
    inputs: [gplOnly], licensesDir: join(root, 'LICENSES-gpl'), noticesFile: join(root, 'notices-gpl.md'),
  })
  const generated = await readFile(join(root, 'LICENSES-gpl', 'gpl-or-mit@1.0.0.txt'), 'utf8')
  assert.match(generated, /dsh-jot elects the MIT license/)
  assert.match(generated, new RegExp(mitGrant))
  assert.match(generated, /Stuart Knightley/)
  assert.match(generated, /GNU GENERAL PUBLIC LICENSE/)
  assert.match(elected.markdown, /MIT elected/)
})

test('different versions keep distinct license files and a rebuild drops stale notices', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-versions-'))
  const licensesDir = join(root, 'LICENSES')
  const noticesFile = join(root, 'THIRD_PARTY_NOTICES.md')
  await mkdir(licensesDir, { recursive: true })
  await writeFile(join(licensesDir, 'sample-pkg@0.9.0.txt'), 'stale\n')
  const first = await fixturePackage(join(root, 'v1'), {
    name: 'sample-pkg', version: '1.0.0', license: 'MIT',
    files: { 'LICENSE': `Copyright (c) 2020 Version One\n\n${mitGrant} of the first version.\n`, 'index.js': '' },
  })
  const second = await fixturePackage(join(root, 'v2'), {
    name: 'sample-pkg', version: '2.0.0', license: 'MIT',
    files: { 'LICENSE': `Copyright (c) 2024 Version Two\n\n${mitGrant} of the second version.\n`, 'index.js': '' },
  })
  await writeThirdPartyNotices({ inputs: [first, second], licensesDir, noticesFile })
  const names = (await readdir(licensesDir)).sort()
  assert.deepEqual(names, ['sample-pkg@1.0.0.txt', 'sample-pkg@2.0.0.txt'])
  assert.match(await readFile(join(licensesDir, 'sample-pkg@1.0.0.txt'), 'utf8'), /Version One/)
  assert.match(await readFile(join(licensesDir, 'sample-pkg@2.0.0.txt'), 'utf8'), /Version Two/)

  await writeThirdPartyNotices({ inputs: [second], licensesDir, noticesFile })
  assert.deepEqual(await readdir(licensesDir), ['sample-pkg@2.0.0.txt'])
})

test('a bundled package with no copyright holder and no usable license fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jot-missing-'))
  const unknown = await fixturePackage(join(root, 'unknown'), {
    name: 'mystery-license', version: '0.0.1', license: 'UNKNOWN-LICENSE',
    files: { 'index.js': 'export {}\n' },
  })
  const anonymous = await fixturePackage(join(root, 'anon'), {
    name: 'anonymous-mit', version: '0.0.1', license: 'MIT',
    files: { 'index.js': 'export {}\n' },
  })
  const namedUnknown = await fixturePackage(join(root, 'named'), {
    name: 'custom-license', version: '0.0.1', license: 'UNKNOWN-LICENSE',
    files: { 'index.js': '/* Copyright (c) 2021 Unknown Holder */\nexport {}\n' },
  })
  const options = { licensesDir: join(root, 'LICENSES'), noticesFile: join(root, 'THIRD_PARTY_NOTICES.md') }
  await assert.rejects(writeThirdPartyNotices({ ...options, inputs: [unknown] }), /No copyright holder/)
  await assert.rejects(writeThirdPartyNotices({ ...options, inputs: [anonymous] }), /No copyright holder/)
  await assert.rejects(writeThirdPartyNotices({ ...options, inputs: [namedUnknown] }), /No license text/)
})

test('every package bundled by the client build has a copyright notice and license text', async () => {
  const { server, client } = await collectBundleInputs()
  assert.equal(server.some(input => input.includes('node_modules')), false)
  const root = await mkdtemp(join(tmpdir(), 'jot-bundle-'))
  const result = await writeThirdPartyNotices({
    inputs: [...server, ...client],
    licensesDir: join(root, 'LICENSES'),
    noticesFile: join(root, 'THIRD_PARTY_NOTICES.md'),
  })
  const required = [
    '@tanstack/react-virtual', '@tiptap/core', '@tiptap/pm', '@tiptap/starter-kit',
    'fflate', 'linkifyjs', 'orderedmap', 'prosemirror-model', 'prosemirror-view', 'rope-sequence', 'w3c-keyname',
    '@deepseek-ai/dsh-util-workspace-path',
  ]
  const names = new Set(result.packages.map(pkg => pkg.name))
  for (const name of required) assert.ok(names.has(name), `missing bundled notice for ${name}`)
  assert.equal(names.has('react'), false)
  assert.equal(names.has('react-dom'), false)
  assert.ok(result.packages.length >= 40)
  for (const pkg of result.packages) {
    const text = await readFile(join(root, 'LICENSES', pkg.file), 'utf8')
    assert.equal(noticeCoversPackage(text), true, pkg.file)
    assert.equal(pkg.electedMit, electsMit(pkg.expression))
    if (pkg.electedMit) assert.match(text, /dsh-jot elects the MIT license/)
  }
  const linkify = result.packages.find(pkg => pkg.name === 'linkifyjs')
  assert.match(await readFile(join(root, 'LICENSES', linkify.file), 'utf8'), /Nick Frasser/)
  const model = result.packages.find(pkg => pkg.name === 'prosemirror-model')
  assert.match(await readFile(join(root, 'LICENSES', model.file), 'utf8'), /Marijn Haverbeke/)

  const normalize = text => text.replace(/\r\n/g, '\n')
  const committedLicenses = (await readdir('LICENSES')).sort()
  const freshLicenses = (await readdir(join(root, 'LICENSES'))).sort()
  assert.deepEqual(committedLicenses, freshLicenses)
  for (const name of freshLicenses) {
    assert.equal(normalize(await readFile(join('LICENSES', name), 'utf8')), normalize(await readFile(join(root, 'LICENSES', name), 'utf8')))
  }
  assert.equal(normalize(await readFile('THIRD_PARTY_NOTICES.md', 'utf8')), normalize(result.markdown))
})

test('Noto Sans SC keeps the upstream Adobe copyright and reserved font name', async () => {
  const text = (await readFile('assets/fonts/OFL.txt', 'utf8')).replace(/\r\n/g, '\n')
  assert.ok(text.startsWith("Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.\n"))
  assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/)
})
