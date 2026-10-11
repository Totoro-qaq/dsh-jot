import { mkdir, writeFile } from 'node:fs/promises';
import { clientBuildOptions, hostBuildOptions } from './bundle.mjs';
import { build } from 'esbuild';
import { writeThirdPartyNotices } from './third-party-notices.mjs';

await mkdir('lib', { recursive: true });
const server = await build({ ...hostBuildOptions, outfile: 'lib/index.js' });
const client = await build({ ...clientBuildOptions, write: false });
const body = client.outputFiles[0].text;
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-jot",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${body}\nreturn module.exports;}});\n`);
const notices = await writeThirdPartyNotices({
  inputs: [...Object.keys(server.metafile.inputs), ...Object.keys(client.metafile.inputs)],
  licensesDir: 'LICENSES',
  noticesFile: 'THIRD_PARTY_NOTICES.md',
});
console.log(`Built Host and Client (${Math.round(Buffer.byteLength(body) / 1024)} KiB client, ${notices.packages.length} third-party notices).`);
