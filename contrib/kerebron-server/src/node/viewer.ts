import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { serveStatic } from '@hono/node-server/serve-static'

const __dirname = import.meta.dirname;

const MAIN_DIR = '/workspace';

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
  app.get('/studio/@kerebron/listdir', async (c) => {
    const fullpath = path.normalize(c.req.query('path') || MAIN_DIR);
    if (!(fullpath + '/').startsWith(MAIN_DIR + '/')) {
      throw new Error('Path outside of MAIN_DIR');
    }

    let html = '';
    if (fullpath !== MAIN_DIR) {
      html += '<a href="/studio/@kerebron/listdir?path=' + path.resolve(fullpath, '..') + '">..</a><br />\n';
    }

    const files = await readdir(fullpath, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        html += '<a href="/studio/@kerebron/listdir?path=' + fullpath + '/' +file.name +'">' + file.name + '</a><br />\n';
      }
    }
    for (const file of files.filter(file => file.name.endsWith('.odt') || file.name.endsWith('.md'))) {
      if (file.isFile()) {
        html += '<a href="/studio/@kerebron/editor?path=' + fullpath + '/' +file.name +'">' + file.name + '</a><br />\n';
      }
    }

    return c.html(html);
  });

  app.get('/studio/@kerebron/file', async (c) => {
    let html = '';

    const fullpath = path.normalize(c.req.query('path') || '/');

    let mimeType = '';
    const ext = fullpath.split('.').pop()?.toLowerCase();
    if (ext === 'odt') {
      mimeType = 'application/vnd.oasis.opendocument.text';
    } else if (ext === 'md') {
      mimeType = 'text/x-markdown';
    }

    if (!mimeType) {
      throw new Error('Invalid extension');
    }

    const data = await readFile(fullpath);

    return new Response(data, {
      headers: {
        'Content-Type': mimeType,
      },
    })
  });

  app.use(
    '/studio/@kerebron/wasm/*',
    serveStatic({
      root: __dirname + '/../../node_modules/@kerebron/wasm/assets',
      rewriteRequestPath: (path: string) => path.replace(/^\/studio\/@kerebron\/wasm/, '/'),
      mimes: { 'wasm': 'application/wasm' },
    }),
  );

}
