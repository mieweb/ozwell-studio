import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';

import { proxyProcess } from '../lsp/proxyProcess.ts';

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
  app.get(
    '/studio/@kerebron/lsp/process',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'node',
        ['../../../lsp-toy/server/out/server.js'],
        c,
      );
    }),
  );

  app.get(
    '/studio/@kerebron/lsp/yaml',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'npm',
        ['exec', '--', 'yaml-language-server', '--stdio'],
        c,
      );
    }),
  );

  app.get(
    '/studio/@kerebron/lsp/typescript',
    upgradeWebSocket((c) => {
      return proxyProcess(
        'npm',
        [
          'exec',
          '--package=typescript',
          '--package=typescript-language-server',
          '--',
          'typescript-language-server',
          '--stdio',
        ],
        c,
      );
    }),
  );

}
