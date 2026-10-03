import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('lib', { recursive: true });
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true,
  platform: 'node', target: 'node22', format: 'esm', packages: 'external',
  sourcemap: true,
});
const client = await build({
  entryPoints: ['src/client/index.tsx'], bundle: true, platform: 'browser',
  format: 'cjs', target: 'es2022', minify: true, write: false,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const body = client.outputFiles[0].text;
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-jot",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${body}\nreturn module.exports;}});\n`);
console.log(`Built Host and Client (${Math.round(Buffer.byteLength(body) / 1024)} KiB client).`);
