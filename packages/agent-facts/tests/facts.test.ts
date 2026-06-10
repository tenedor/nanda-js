import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/server/app.js';
import { createDb, type AgentFactsStorage } from '../src/server/db.js';
import type { AgentFacts } from '../src/AgentFacts.js';

vi.mock('../src/server/validation.js', () => ({
  verifyAgentFactsProof: vi.fn().mockResolvedValue(undefined),
  verifyAttestation: vi.fn().mockResolvedValue(undefined),
}));

const VALID_SIG = 'A'.repeat(86);
const FUTURE_DATE = '2099-01-01T00:00:00Z';
const PAST_DATE   = '2000-01-01T00:00:00Z';

const testFacts: AgentFacts = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  label: 'Test Agent',
  description: 'A test agent',
  version: '1.0.0',
  provider: { name: 'Example', url: 'https://example.com' },
  endpoints: { static: ['https://agent.example.com/api'] },
  capabilities: { modalities: ['text'] },
  certification: {
    level: 'verified',
    issuer: 'did:web:issuer.example.com',
    issuanceDate: '2025-01-01T00:00:00Z',
    expirationDate: FUTURE_DATE,
    statusListUrl: 'https://issuer.example.com/status',
  },
  proof: VALID_SIG,
};

const encodedId = encodeURIComponent(testFacts.id);

const validAttestation = {
  agentId: testFacts.id,
  action: 'invalidate-facts',
  issuedAt: new Date().toISOString(),
  signature: VALID_SIG,
};

describe('facts routes', () => {
  let app: FastifyInstance;
  let db: AgentFactsStorage;

  beforeEach(async () => {
    db = await createDb(':memory:');
    app = await createApp(db, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  describe('GET /facts/:id', () => {
    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(404);
    });

    it('returns the facts after registration', async () => {
      await db.insertFacts(testFacts);
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(testFacts);
    });

    it('returns 410 when facts have been invalidated', async () => {
      await db.insertFacts(testFacts);
      await db.invalidateFacts(testFacts.id);
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(410);
    });

    it('returns 410 when facts have expired', async () => {
      const expired = { ...testFacts, certification: { ...testFacts.certification, expirationDate: PAST_DATE } };
      await db.insertFacts(expired);
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(410);
    });
  });

  describe('POST /facts', () => {
    it('registers facts and returns 201', async () => {
      const res = await app.inject({ method: 'POST', url: '/facts', payload: testFacts });
      expect(res.statusCode).toBe(201);
      expect(await db.getFacts(testFacts.id)).toBeDefined();
    });

    it('returns 409 on duplicate registration', async () => {
      await db.insertFacts(testFacts);
      const res = await app.inject({ method: 'POST', url: '/facts', payload: testFacts });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('PUT /facts/:id', () => {
    it('updates facts and returns 204', async () => {
      await db.insertFacts(testFacts);
      const updated = { ...testFacts, label: 'Updated' };
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: updated });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testFacts.id))?.facts.label).toBe('Updated');
    });

    it('clears the invalidation flag on update', async () => {
      await db.insertFacts(testFacts);
      await db.invalidateFacts(testFacts.id);
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: testFacts });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testFacts.id))?.invalidated).toBe(false);
    });

    it('returns 400 when body id does not match path', async () => {
      const mismatch = { ...testFacts, id: 'did:web:other.example.com' };
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: mismatch });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: testFacts });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /facts/:id/invalidate', () => {
    it('invalidates facts and returns 204', async () => {
      await db.insertFacts(testFacts);
      const res = await app.inject({
        method: 'POST', url: `/facts/${encodedId}/invalidate`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testFacts.id))?.invalidated).toBe(true);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({
        method: 'POST', url: `/facts/${encodedId}/invalidate`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('schema validation', () => {
    it('rejects a POST body missing a required field', async () => {
      const { proof: _, ...noProof } = testFacts;
      const res = await app.inject({ method: 'POST', url: '/facts', payload: noProof });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an id that is not a DID', async () => {
      const res = await app.inject({
        method: 'POST', url: '/facts',
        payload: { ...testFacts, id: 'not-a-did' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a proof that is not 86 base64url characters', async () => {
      const res = await app.inject({
        method: 'POST', url: '/facts',
        payload: { ...testFacts, proof: 'tooshort' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a non-HTTPS provider url', async () => {
      const res = await app.inject({
        method: 'POST', url: '/facts',
        payload: { ...testFacts, provider: { name: 'Example', url: 'http://example.com' } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an invalidate attestation with wrong action', async () => {
      const res = await app.inject({
        method: 'POST', url: `/facts/${encodedId}/invalidate`,
        payload: { ...validAttestation, action: 'not-invalidate' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
