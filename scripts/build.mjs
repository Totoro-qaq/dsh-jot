import { cp, mkdir, writeFile } from 'node:fs/promises';
import { clientBuildOptions, hostBuildOptions, pdfRuntimeAssetsDirectory, pdfRuntimeBuildOptions } from './bundle.mjs';
import { build } from 'esbuild';
import { writeThirdPartyNotices } from './third-party-notices.mjs';

await mkdir('lib', { recursive: true });
const server = await build({ ...hostBuildOptions, outfile: 'lib/index.js' });
const pdf = await build({ ...pdfRuntimeBuildOptions, outfile: 'lib/pdf-runtime.cjs' });
// PDFKit's public Node build reads its standard AFM fonts and ICC profile from
// __dirname/data. Keep that layout beside the controlled CJS engine.
await cp(pdfRuntimeAssetsDirectory, 'lib/data', { recursive: true });
const client = await build({ ...clientBuildOptions, write: false });
const body = client.outputFiles[0].text;
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-jot",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${body}\nreturn module.exports;}});\n`);
const notices = await writeThirdPartyNotices({
  inputs: [...Object.keys(server.metafile.inputs), ...Object.keys(pdf.metafile.inputs), ...Object.keys(client.metafile.inputs)],
  licensesDir: 'LICENSES',
  noticesFile: 'THIRD_PARTY_NOTICES.md',
});
console.log(`Built Host and Client (${Math.round(Buffer.byteLength(body) / 1024)} KiB client, ${notices.packages.length} third-party notices).`);
