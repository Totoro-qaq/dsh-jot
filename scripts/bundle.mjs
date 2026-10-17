import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfkitEntry = require.resolve('pdfkit');
export const pdfRuntimeAssetsDirectory = join(dirname(pdfkitEntry), 'data');

// Freeze the complete Node PDF engine at build time. A profile may retain an
// older flattened fontkit/Unicode dependency graph; it must not select the PDF
// engine's transitive modules. Only Node built-ins remain external here.
export const pdfRuntimeBuildOptions = {
  entryPoints: [pdfkitEntry],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  metafile: true,
};

// Host 与 Client 的打包参数只放在这里，构建脚本和许可覆盖测试共用同一份。
export const hostBuildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  metafile: true,
  plugins: [{
    name: 'private-pdf-runtime',
    setup(build) {
      build.onResolve({ filter: /^pdfkit$/ }, () => ({ path: './pdf-runtime.cjs', external: true }));
    },
  }],
};

export const clientBuildOptions = {
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  minify: true,
  metafile: true,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  define: { 'process.env.NODE_ENV': '"production"' },
};

/** 与正式构建相同的输入集合。write:false 只取 metafile，不改 lib/。 */
export async function collectBundleInputs() {
  const server = await build({ ...hostBuildOptions, outfile: 'lib/index.js', write: false });
  const pdf = await build({ ...pdfRuntimeBuildOptions, outfile: 'lib/pdf-runtime.cjs', write: false });
  const client = await build({ ...clientBuildOptions, write: false });
  return {
    server: Object.keys(server.metafile.inputs),
    pdf: Object.keys(pdf.metafile.inputs),
    client: Object.keys(client.metafile.inputs),
  };
}
