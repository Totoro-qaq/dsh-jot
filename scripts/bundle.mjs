import { build } from 'esbuild';

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
  const client = await build({ ...clientBuildOptions, write: false });
  return {
    server: Object.keys(server.metafile.inputs),
    client: Object.keys(client.metafile.inputs),
  };
}
