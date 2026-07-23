import { randomUUID } from 'node:crypto';

import type { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';

import { HonoYjsMemAdapter } from '@kerebron/extension-server-hono/HonoYjsMemAdapter';
const yjsAdapter = new HonoYjsMemAdapter();

export function install(
  { app, upgradeWebSocket }: { app: Hono; upgradeWebSocket: UpgradeWebSocket },
) {
  app.get(
    '/studio/@kerebron/yjs/:room',
    upgradeWebSocket((c) => {
      return yjsAdapter.upgradeWebSocket(c.req.param('room'));
    }),
  );

  app.get('/studio/@kerebron/api/rooms', (c) => {
    const retVal = yjsAdapter.getRoomNames();
    return c.json(retVal);
  });

  app.post('/studio/@kerebron/api/rooms', (c) => {
    const roomId = randomUUID();
    yjsAdapter.addRoom(roomId);
    return c.json(roomId);
  });
}
