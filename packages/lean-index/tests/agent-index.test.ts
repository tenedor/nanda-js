import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { createApp } from '../src/server/app.js';
import { createDb, type AgentAddrStorage } from '../src/server/db.js';
import type { AgentAddr } from '../src/AgentAddr.js';

// Stub out DID-based validation so unit tests don't make network calls.
vi.mock('../src/server/validation.js', () => ({
  verifyAgentAddrSignature: vi.fn().mockResolvedValue(undefined),
  verifyAttestation: vi.fn().mockResolvedValue(undefined),
}));

// 86 base64url chars = valid Ed25519 signature placeholder
const VALID_SIG = 'A'.repeat(86);

const testRecord: AgentAddr = {
  agentId: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  primaryFactsUrl: 'https://agent.example.com/.well-known/agent-facts',
  ttl: 3600,
  signature: VALID_SIG,
};

const encodedId = encodeURIComponent(testRecord.agentId);

const validAttestation = {
  agentId: testRecord.agentId,
  action: 'delete-agent',
  issuedAt: new Date().toISOString(),
  signature: VALID_SIG,
};

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
      const res = await app.inject({ method: 'POST', url: '/agents', payload: testRecord });
      expect(res.statusCode).toBe(201);
      expect(await db.getAgent(testRecord.agentId)).toEqual(testRecord);
    });

    it('returns 409 on duplicate registration', async () => {
      await db.insertAgent(testRecord);
      const res = await app.inject({ method: 'POST', url: '/agents', payload: testRecord });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('PUT /agents/:id', () => {
    it('updates an existing agent and returns 204', async () => {
      await db.insertAgent(testRecord);
      const updated = { ...testRecord, ttl: 7200 };
      const res = await app.inject({ method: 'PUT', url: `/agents/${encodedId}`, payload: updated });
      expect(res.statusCode).toBe(204);
      expect(await db.getAgent(testRecord.agentId)).toEqual(updated);
    });

    it('returns 400 when body agentId does not match path', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/agents/${encodeURIComponent('did:web:other.example.com')}`,
        payload: testRecord,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({ method: 'PUT', url: `/agents/${encodedId}`, payload: testRecord });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('deletes an existing agent and returns 204', async () => {
      await db.insertAgent(testRecord);
      const res = await app.inject({
        method: 'DELETE', url: `/agents/${encodedId}`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(204);
      expect(await db.getAgent(testRecord.agentId)).toBeUndefined();
    });

    it('returns 404 when deleting unknown agent', async () => {
      const res = await app.inject({
        method: 'DELETE', url: `/agents/${encodedId}`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('schema validation', () => {
    it('rejects a POST body missing a required field', async () => {
      const { agentId: _, ...noId } = testRecord;
      const res = await app.inject({ method: 'POST', url: '/agents', payload: noId });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an agentId that is not a DID', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, agentId: 'not-a-did' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a non-HTTPS facts URL', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, primaryFactsUrl: 'http://agent.example.com/facts' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects ttl of zero', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, ttl: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects ttl exceeding the maximum', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, ttl: 2_592_001 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a signature that is not 86 base64url characters', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, signature: 'tooshort' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an unknown extra field', async () => {
      const res = await app.inject({
        method: 'POST', url: '/agents',
        payload: { ...testRecord, unknownField: 'surprise' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a DELETE attestation with wrong action', async () => {
      const res = await app.inject({
        method: 'DELETE', url: `/agents/${encodedId}`,
        payload: { ...validAttestation, action: 'not-delete-agent' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
