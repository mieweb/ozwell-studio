import type { Hono } from 'hono';

import { createServer as createViteServer } from 'vite';
import { proxyWs } from './proxyWs.ts';

const __dirname = import.meta.dirname;

export async function install({ app }: { app: Hono }) {
  const devProxyUrls: Record<string, string> = {};
  let port = undefined;

  const editorDir = __dirname + '/../editor';

  const viteDevServer = await createViteServer({
    base: '/@kerebron/editor',
    configFile: editorDir + '/vite.config.ts',
    root: editorDir,
    server: {
      host: '0.0.0.0',
      port,
      fs: { // https://vite.dev/config/server-options.html#server-fs-allow
        allow: [editorDir],
      },
    },
  });
  const proxyServer = await viteDevServer.listen();
  const addr = proxyServer.httpServer?.address();

  if (addr && 'object' === typeof addr) {
    // devProxyUrls['/@kerebron/editor'] = `http://${addr.address}:${addr.port}`;
    devProxyUrls['/@kerebron/editor'] = `http://localhost:${addr.port}`;
    port = addr.port + 1;
  }

  for (const path in devProxyUrls) {
    const devProxyUrl = devProxyUrls[path];
    console.log(`Proxy: ${path} => ${devProxyUrl}`);

    app.all(path + '/*', (c) => {
      const queryString = c.req.url
        .split('?')
        .map((e: string, idx: number) => {
          return idx > 0 ? e : '';
        })
        .join('?');

      const subPath = c.req.path;

      const proxyUrl = `${devProxyUrl}${subPath}`;

      return proxyWs(proxyUrl, {
        ...c.req, // optional, specify only when forwarding all the request data (including credentials) is necessary.
        headers: {
          ...c.req.header(),
          'X-Forwarded-For': '127.0.0.1',
          'X-Forwarded-Host': c.req.header('host'),
          Authorization: undefined, // do not propagate request headers contained in c.req.header('Authorization')
        },
      }, c);
    });
  }
}
