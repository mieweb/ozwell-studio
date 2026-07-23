import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { serveStatic } from '@hono/node-server/serve-static'

const __dirname = import.meta.dirname;

const MAIN_DIR = '/workspace';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function link(route: string, targetPath: string, label: string): string {
  return '<a href="' + route + '?path=' + encodeURIComponent(targetPath) + '">' + escapeHtml(label) + '</a><br />\n';
}

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
      html += link('/studio/@kerebron/listdir', path.resolve(fullpath, '..'), '..');
    }

    const files = await readdir(fullpath, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        html += link('/studio/@kerebron/listdir', fullpath + '/' + file.name, file.name);
      }
    }
    for (const file of files.filter(file => file.name.endsWith('.odt') || file.name.endsWith('.md'))) {
      if (file.isFile()) {
        html += link('/studio/@kerebron/editor', fullpath + '/' + file.name, file.name);
      }
    }

    return c.html(html);
  });

  app.get('/studio/@kerebron/file', async (c) => {
    const fullpath = path.normalize(c.req.query('path') || MAIN_DIR);
    if (!(fullpath + '/').startsWith(MAIN_DIR + '/')) {
      throw new Error('Path outside of MAIN_DIR');
    }

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
