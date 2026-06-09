import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { createApp } from '../src/server/app.js';
import { createDb, type AgentAddrStorage } from '../src/server/db.js';
import type { AgentAddr } from '../src/AgentAddr.js';

// Stub out DID-based validation so unit tests don't make network calls.
vi.mock('../src/server/validation.js', () => ({
  verifyAgentAddrSignature: vi.fn().mockResolvedValue(undefined),
  verifyAttestation: vi.fn().mockResolvedValue(undefined),
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public statusCode = 400) { super(message); }
  },
}));

const testRecord: AgentAddr = {
  agentId: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  primaryFactsUrl: 'https://agent.example.com/.well-known/agent-facts',
  ttl: 3600,
  signature: 'dGVzdHNpZ25hdHVyZQ',
};

const encodedId = encodeURIComponent(testRecord.agentId);

describe('agent index routes', () => {
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

  describe('GET /agents/:id', () => {
    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({ method: 'GET', url: `/agents/${encodedId}` });
      expect(res.statusCode).toBe(404);
    });

    it('returns the agent after registration', async () => {
      await db.insertAgent(testRecord);
      const res = await app.inject({ method: 'GET', url: `/agents/${encodedId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(testRecord);
    });
  });

  describe('POST /agents', () => {
    it('registers a new agent and returns 201', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: testRecord,
      });
      expect(res.statusCode).toBe(201);
      expect(await db.getAgent(testRecord.agentId)).toEqual(testRecord);
    });

    it('returns 409 on duplicate registration', async () => {
      await db.insertAgent(testRecord);
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: testRecord,
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('PUT /agents/:id', () => {
    it('updates an existing agent and returns 204', async () => {
      await db.insertAgent(testRecord);
      const updated = { ...testRecord, ttl: 7200 };
      const res = await app.inject({
        method: 'PUT', url: `/agents/${encodedId}`,
        payload: updated,
      });
      expect(res.statusCode).toBe(204);
      expect(await db.getAgent(testRecord.agentId)).toEqual(updated);
    });

    it('returns 400 when body agentId does not match path', async () => {
      const res = await app.inject({
        method: 'PUT', url: `/agents/${encodeURIComponent('did:web:other.example.com')}`,
        payload: testRecord,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({
        method: 'PUT', url: `/agents/${encodedId}`,
        payload: testRecord,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('deletes an existing agent and returns 204', async () => {
      await db.insertAgent(testRecord);
      const attestation = {
        agentId: testRecord.agentId,
        action: 'delete-agent',
        issuedAt: new Date().toISOString(),
        signature: 'dGVzdA',
      };
      const res = await app.inject({
        method: 'DELETE', url: `/agents/${encodedId}`,
        payload: attestation,
      });
      expect(res.statusCode).toBe(204);
      expect(await db.getAgent(testRecord.agentId)).toBeUndefined();
    });

    it('returns 404 when deleting unknown agent', async () => {
      const attestation = {
        agentId: testRecord.agentId,
        action: 'delete-agent',
        issuedAt: new Date().toISOString(),
        signature: 'dGVzdA',
      };
      const res = await app.inject({
        method: 'DELETE', url: `/agents/${encodedId}`,
        payload: attestation,
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
