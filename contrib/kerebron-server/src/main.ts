import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { upgradeWebSocket, serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

const __dirname = import.meta.dirname;

const port = 8787;

const app = new Hono();

(await import('./node/yjs.ts')).install({ app, upgradeWebSocket });
(await import('./node/lsp.ts')).install({ app, upgradeWebSocket });
await (await import('./node/devViteProxy.ts')).install({ app });
(await import('./node/viewer.ts')).install({ app, upgradeWebSocket });

const wss = new WebSocketServer({ noServer: true });

serve({
  fetch: app.fetch,
  websocket: { server: wss },
  port
}, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
