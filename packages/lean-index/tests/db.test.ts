import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb, NotFoundError, type AgentAddrStorage } from '../src/server/db.js';
import type { AgentAddr } from '../src/AgentAddr.js';

const testRecord: AgentAddr = {
  agentId: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  primaryFactsUrl: 'https://agent.example.com/.well-known/agent-facts',
  ttl: 3600,
  signature: 'dGVzdHNpZ25hdHVyZQ',
};

describe('AgentAddrStorage', () => {
  let db: AgentAddrStorage;

  beforeEach(async () => {
    db = await createDb(':memory:');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('getAgent', () => {
    it('returns undefined for unknown agent', async () => {
      expect(await db.getAgent('did:web:unknown.example.com')).toBeUndefined();
    });

    it('returns the agent after insert', async () => {
      await db.insertAgent(testRecord);
      expect(await db.getAgent(testRecord.agentId)).toEqual(testRecord);
    });

    it('preserves optional fields', async () => {
      const withOptional: AgentAddr = {
        ...testRecord,
        privateFactsUrl: 'https://private.example.com/facts',
        adaptiveResolverUrl: 'https://resolver.example.com/dispatch',
      };
      await db.insertAgent(withOptional);
      expect(await db.getAgent(withOptional.agentId)).toEqual(withOptional);
    });
  });

  describe('insertAgent', () => {
    it('throws on duplicate agentId', async () => {
      await db.insertAgent(testRecord);
      await expect(db.insertAgent(testRecord)).rejects.toThrow();
    });
  });

  describe('updateAgent', () => {
    it('updates an existing agent', async () => {
      await db.insertAgent(testRecord);
      const updated = { ...testRecord, ttl: 7200, signature: 'bmV3c2ln' };
      await db.updateAgent(updated);
      expect(await db.getAgent(testRecord.agentId)).toEqual(updated);
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.updateAgent(testRecord)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('deleteAgent', () => {
    it('deletes an existing agent', async () => {
      await db.insertAgent(testRecord);
      await db.deleteAgent(testRecord.agentId);
      expect(await db.getAgent(testRecord.agentId)).toBeUndefined();
    });

    it('throws NotFoundError for unknown agent', async () => {
      await expect(db.deleteAgent(testRecord.agentId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
