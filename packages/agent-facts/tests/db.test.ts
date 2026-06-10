import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb, type AgentFactsStorage } from '../src/server/db.js';
import { NotFoundError, ConflictError } from '@nanda/shared';
import type { AgentFacts } from '../src/AgentFacts.js';

const FUTURE_DATE = '2099-01-01T00:00:00Z';
const PAST_DATE   = '2000-01-01T00:00:00Z';

function makeTestFacts(id = 'did:web:agent.example.com'): AgentFacts {
  return {
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
    proof: 'A'.repeat(86),
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
  const testFacts = makeTestFacts();

  beforeEach(async () => { db = await createDb(':memory:'); });
  afterEach(async () => { await db.close(); });

  describe('getFacts', () => {
    it('returns undefined for an unknown agent', async () => {
      expect(await db.getFacts('did:web:unknown.example.com')).toBeUndefined();
    });

    it('returns the record after insert', async () => {
      await db.insertFacts(testFacts);
      const record = await db.getFacts(testFacts.id);
      expect(record?.facts).toEqual(testFacts);
      expect(record?.invalidated).toBe(false);
      expect(record?.expiresAt).toBe(FUTURE_DATE);
    });
  });

  describe('insertFacts', () => {
    it('throws ConflictError on duplicate', async () => {
      await db.insertFacts(testFacts);
      await expect(db.insertFacts(testFacts)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('updateFacts', () => {
    it('updates facts and clears invalidation flag', async () => {
      await db.insertFacts(testFacts);
      await db.invalidateFacts(testFacts.id);
      const updated = { ...testFacts, label: 'Updated' };
      await db.updateFacts(updated);
      const record = await db.getFacts(testFacts.id);
      expect(record?.facts.label).toBe('Updated');
      expect(record?.invalidated).toBe(false);
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.updateFacts(testFacts)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('invalidateFacts', () => {
    it('sets the invalidated flag', async () => {
      await db.insertFacts(testFacts);
      await db.invalidateFacts(testFacts.id);
      expect((await db.getFacts(testFacts.id))?.invalidated).toBe(true);
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.invalidateFacts(testFacts.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('expires_at is derived from certification.expirationDate', () => {
    it('stores the expiration date from the facts document', async () => {
      const expiredFacts = makeTestFacts('did:web:expired.example.com');
      expiredFacts.certification.expirationDate = PAST_DATE;
      await db.insertFacts(expiredFacts);
      const record = await db.getFacts(expiredFacts.id);
      expect(record?.expiresAt).toBe(PAST_DATE);
    });
  });
});
