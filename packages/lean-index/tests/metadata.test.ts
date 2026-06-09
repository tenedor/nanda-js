import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { createApp, PROTOCOL_VERSION } from '../src/server/app.js';
import { createDb, type AgentAddrStorage } from '../src/server/db.js';

describe('metadata routes', () => {
  let app: FastifyInstance;
  let db: AgentAddrStorage;

  beforeEach(async () => {
    db = await createDb(':memory:');
    app = await createApp(db, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  describe('GET /version', () => {
    it('returns 200 with the protocol version', async () => {
      const res = await app.inject({ method: 'GET', url: '/version' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ version: PROTOCOL_VERSION });
    });
  });

  describe('GET /status', () => {
    it('returns 200 with ok status', async () => {
      const res = await app.inject({ method: 'GET', url: '/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    });
  });
});
