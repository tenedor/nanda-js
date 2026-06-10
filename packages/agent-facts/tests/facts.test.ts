import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/server/app.js';
import { createDb, type AgentFactsStorage } from '../src/server/db.js';
import type { AgentFacts } from '../src/AgentFacts.js';
import type { VerifiableCredential } from '@nanda/shared';

vi.mock('../src/server/validation.js', () => ({
  verifyAgentFactsVc: vi.fn().mockResolvedValue(undefined),
  verifyAttestation: vi.fn().mockResolvedValue(undefined),
}));

const VALID_SIG   = 'A'.repeat(86);
const FUTURE_DATE = '2099-01-01T00:00:00Z';
const PAST_DATE   = '2000-01-01T00:00:00Z';

const testContent: AgentFacts = {
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
};

function makeVc(content: AgentFacts = testContent, validUntil = FUTURE_DATE): VerifiableCredential<AgentFacts> {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: content.id,
    validFrom: '2025-01-01T00:00:00Z',
    validUntil,
    credentialSubject: content,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      created: '2025-01-01T00:00:00Z',
      verificationMethod: `${content.id}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: VALID_SIG,
    },
  };
}

const testVc = makeVc();
const encodedId = encodeURIComponent(testContent.id);

const validAttestation = {
  agentId: testContent.id,
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

    it('returns the full VC after registration', async () => {
      await db.insertFacts(testVc);
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(testVc);
    });

    it('returns 410 when facts have been invalidated', async () => {
      await db.insertFacts(testVc);
      await db.invalidateFacts(testContent.id);
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(410);
    });

    it('returns 410 when the VC has expired', async () => {
      await db.insertFacts(makeVc(testContent, PAST_DATE));
      const res = await app.inject({ method: 'GET', url: `/facts/${encodedId}` });
      expect(res.statusCode).toBe(410);
    });
  });

  describe('POST /facts', () => {
    it('registers a VC and returns 201', async () => {
      const res = await app.inject({ method: 'POST', url: '/facts', payload: testVc });
      expect(res.statusCode).toBe(201);
      expect(await db.getFacts(testContent.id)).toBeDefined();
    });

    it('returns 409 on duplicate registration', async () => {
      await db.insertFacts(testVc);
      const res = await app.inject({ method: 'POST', url: '/facts', payload: testVc });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('PUT /facts/:id', () => {
    it('updates facts and returns 204', async () => {
      await db.insertFacts(testVc);
      const updated = makeVc({ ...testContent, label: 'Updated' });
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: updated });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testContent.id))?.vc.credentialSubject.label).toBe('Updated');
    });

    it('clears the invalidation flag on update', async () => {
      await db.insertFacts(testVc);
      await db.invalidateFacts(testContent.id);
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: testVc });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testContent.id))?.invalidated).toBe(false);
    });

    it('returns 400 when credentialSubject.id does not match path', async () => {
      const mismatch = makeVc({ ...testContent, id: 'did:web:other.example.com' });
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: mismatch });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({ method: 'PUT', url: `/facts/${encodedId}`, payload: testVc });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /facts/:id/invalidate', () => {
    it('invalidates facts and returns 204', async () => {
      await db.insertFacts(testVc);
      const res = await app.inject({
        method: 'POST', url: `/facts/${encodedId}/invalidate`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(204);
      expect((await db.getFacts(testContent.id))?.invalidated).toBe(true);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await app.inject({
        method: 'POST', url: `/facts/${encodedId}/invalidate`, payload: validAttestation,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('schema validation', () => {
    it('rejects a POST body missing credentialSubject', async () => {
      const { credentialSubject: _, ...noSubject } = testVc;
      const res = await app.inject({ method: 'POST', url: '/facts', payload: noSubject });
      expect(res.statusCode).toBe(400);
    });

    it('accepts a POST body without validUntil (credential does not expire)', async () => {
      const { validUntil: _, ...noExpiry } = testVc;
      const res = await app.inject({ method: 'POST', url: '/facts', payload: noExpiry });
      expect(res.statusCode).toBe(201);
    });

    it('rejects a proof that is not a DataIntegrityProof', async () => {
      const bad = { ...testVc, proof: { ...testVc.proof, type: 'RawSignature' } };
      const res = await app.inject({ method: 'POST', url: '/facts', payload: bad });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a credentialSubject with a non-DID id', async () => {
      const bad = makeVc({ ...testContent, id: 'not-a-did' });
      const res = await app.inject({ method: 'POST', url: '/facts', payload: bad });
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
