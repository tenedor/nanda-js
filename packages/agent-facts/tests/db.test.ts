import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb, type AgentFactsStorage } from '../src/server/db.js';
import { NotFoundError, ConflictError, type VerifiableCredential } from '@nanda/shared';
import type { AgentFacts } from '../src/AgentFacts.js';

const FUTURE_DATE = '2099-01-01T00:00:00Z';
const PAST_DATE   = '2000-01-01T00:00:00Z';
const VALID_SIG   = 'A'.repeat(86);

function makeTestVc(id = 'did:web:agent.example.com', validUntil = FUTURE_DATE): VerifiableCredential<AgentFacts> {
  const subject: AgentFacts = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id,
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
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: id,
    validFrom: '2025-01-01T00:00:00Z',
    ...(validUntil !== undefined && { validUntil }),
    credentialSubject: subject,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      created: '2025-01-01T00:00:00Z',
      verificationMethod: `${id}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: VALID_SIG,
    },
  };
}

describe('ping', () => {
  let db: AgentFactsStorage;
  beforeEach(async () => { db = await createDb(':memory:'); });
  afterEach(async () => { await db.close(); });

  it('resolves when the database is reachable', async () => {
    await expect(db.ping()).resolves.toBeUndefined();
  });

  it('rejects when the timeout elapses before the query returns', async () => {
    vi.useFakeTimers();
    const p = db.ping(100);
    vi.runAllTimers();
    await expect(p).rejects.toThrow('ping timeout');
    vi.useRealTimers();
  });
});

describe('AgentFactsStorage', () => {
  let db: AgentFactsStorage;
  const testVc = makeTestVc();

  beforeEach(async () => { db = await createDb(':memory:'); });
  afterEach(async () => { await db.close(); });

  describe('getFacts', () => {
    it('returns undefined for an unknown agent', async () => {
      expect(await db.getFacts('did:web:unknown.example.com')).toBeUndefined();
    });

    it('returns the record after insert', async () => {
      await db.insertFacts(testVc);
      const record = await db.getFacts(testVc.credentialSubject.id);
      expect(record?.vc).toEqual(testVc);
      expect(record?.invalidated).toBe(false);
      expect(record?.expiresAt).toBe(FUTURE_DATE);
    });
  });

  describe('insertFacts', () => {
    it('throws ConflictError on duplicate', async () => {
      await db.insertFacts(testVc);
      await expect(db.insertFacts(testVc)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('updateFacts', () => {
    it('updates the VC and clears the invalidation flag', async () => {
      await db.insertFacts(testVc);
      await db.invalidateFacts(testVc.credentialSubject.id);
      const updated = { ...testVc, credentialSubject: { ...testVc.credentialSubject, label: 'Updated' } };
      await db.updateFacts(updated);
      const record = await db.getFacts(testVc.credentialSubject.id);
      expect(record?.vc.credentialSubject.label).toBe('Updated');
      expect(record?.invalidated).toBe(false);
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.updateFacts(testVc)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('invalidateFacts', () => {
    it('sets the invalidated flag', async () => {
      await db.insertFacts(testVc);
      await db.invalidateFacts(testVc.credentialSubject.id);
      expect((await db.getFacts(testVc.credentialSubject.id))?.invalidated).toBe(true);
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.invalidateFacts(testVc.credentialSubject.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('expires_at is derived from vc.validUntil', () => {
    it('stores the expiry from the VC envelope', async () => {
      const expiredVc = makeTestVc('did:web:expired.example.com', PAST_DATE);
      await db.insertFacts(expiredVc);
      const record = await db.getFacts(expiredVc.credentialSubject.id);
      expect(record?.expiresAt).toBe(PAST_DATE);
    });

    it('stores empty string when validUntil is absent', async () => {
      const { validUntil: _vu, ...base } = makeTestVc('did:web:noexpiry.example.com');
      await db.insertFacts(base as VerifiableCredential<AgentFacts>);
      const record = await db.getFacts('did:web:noexpiry.example.com');
      expect(record?.expiresAt).toBe('');
    });
  });
});
