import { build } from 'esbuild';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { JotStore } from '../src/store.js';
import { createJotHandler } from '../src/http.js';

// Local development only. Production routes use the DSH Connection authorizer.
const port = Number(process.env.JOT_DEV_PORT ?? 4178);
const token = randomBytes(32).toString('hex');
const store = new JotStore({ directory: resolve(process.env.JOT_DEV_DATA ?? '.jot-dev') });
const handler = createJotHandler(store, {
  authorize: req => req.headers.cookie?.split(';').some(part => part.trim() === `jot_preview=${token}`) ? undefined : 401,
});
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>随记 · Jot</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#20242b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px}.preview-nav{height:54px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e4e8;background:#fff}.preview-nav>span{font-weight:600}.preview-nav small{font-weight:400;color:#69717d;margin-left:6px}.preview-nav button{font:inherit;font-size:12px;border:0;background:transparent;color:#525b69;padding:7px 12px;border-radius:6px;cursor:pointer}.preview-nav button[aria-pressed=true]{background:#edf1f7;color:#255ca3}.preview-frame{height:calc(100dvh - 54px);background:#fff;margin:0 auto;max-width:1440px}.preview-compact{width:min(100%,380px);margin-right:0;border-left:1px solid #e2e4e8}button:focus-visible{outline:2px solid #356cbb;outline-offset:2px}
</style></head><body><div id="root"></div><script type="module" src="/dev.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403); res.end(); return; }
  if (req.url?.startsWith('/jot/api')) { await handler(req, res); return; }
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    if (req.method === 'GET' && req.url === '/dev.js') {
      const result = await build({ entryPoints: ['dev/preview.tsx'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', sourcemap: 'inline' });
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }); res.end(result.outputFiles[0]!.text); return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url?.startsWith('/?'))) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': `jot_preview=${token}; HttpOnly; SameSite=Strict; Path=/`, 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'" });
      res.end(html); return;
    }
    res.writeHead(404); res.end();
  } catch (error) { console.error(error); res.writeHead(500); res.end('Preview build failed.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Jot preview: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit()));
