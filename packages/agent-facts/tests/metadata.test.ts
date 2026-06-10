import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp, PROTOCOL_VERSION } from '../src/server/app.js';
import type { AgentFactsStorage } from '../src/server/db.js';

function makeStubDb(): AgentFactsStorage {
  return {
    ping: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe('metadata routes', () => {
  let app: FastifyInstance;
  let db: AgentFactsStorage;

  beforeEach(async () => {
    db = makeStubDb();
    app = await createApp(db, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /version', () => {
    it('returns 200 with the protocol version', async () => {
      const res = await app.inject({ method: 'GET', url: '/version' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ version: PROTOCOL_VERSION });
    });
  });

  describe('GET /status', () => {
    it('returns ok when the database is reachable', async () => {
      const res = await app.inject({ method: 'GET', url: '/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });

    it('returns unavailable when the database ping fails', async () => {
      vi.spyOn(db, 'ping').mockRejectedValueOnce(new Error('db gone'));
      const res = await app.inject({ method: 'GET', url: '/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'unavailable' });
    });
  });
});
