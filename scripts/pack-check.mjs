import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { noticeCoversPackage } from './third-party-notices.mjs';

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const source = await readFile('lib/client.js', 'utf8');
let registration;
runInNewContext(source, { window: { __ModuleLoader__: { load(value) { registration = value; } } } });
assert.equal(registration?.id, manifest.name);
assert.equal(typeof registration.factory, 'function');
const require = createRequire(import.meta.url);
const externalNames = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']);
const exported = registration.factory(name => { assert.ok(externalNames.has(name), `Unsupported client external: ${name}`); return require(name); });
assert.equal(typeof exported.apply, 'function');
assert.ok(Array.isArray(exported.inject));
const host = await import('../lib/index.js');
assert.equal(typeof host.apply, 'function');
assert.ok(Array.isArray(host.inject));
assert.ok(manifest.files.includes('THIRD_PARTY_NOTICES.md'));
assert.ok(manifest.files.includes('LICENSES'));
const notices = await readFile('THIRD_PARTY_NOTICES.md', 'utf8');
const licenseNames = (await readdir('LICENSES')).filter(name => name.endsWith('.txt')).sort();
const linked = [...notices.matchAll(/\(LICENSES\/([^)]+)\)/g)].map(match => match[1]).sort();
assert.deepEqual(linked, licenseNames);
assert.ok(licenseNames.length > 0);
for (const name of licenseNames) {
  const text = await readFile(join('LICENSES', name), 'utf8');
  assert.ok(noticeCoversPackage(text), `incomplete third-party notice: ${name}`);
}
const fontLicense = (await readFile('assets/fonts/OFL.txt', 'utf8')).replace(/\r\n/g, '\n');
assert.ok(fontLicense.startsWith("Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.\n"));
console.log('Host exports, Client factory identity, shared React imports, and third-party notices verified.');
