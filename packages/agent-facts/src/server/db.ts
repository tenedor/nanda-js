import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { AgentFacts } from '../AgentFacts.js';
import type { AgentID, VerifiableCredential } from '@nanda/shared';
import { NotFoundError, ConflictError } from '@nanda/shared';

const DEFAULT_PING_TIMEOUT_MS = 30_000;

export interface FactsRecord {
  vc: VerifiableCredential<AgentFacts>;
  invalidated: boolean;
  // Derived from vc.validUntil at write time. Empty string means no expiry.
  expiresAt: string;
}

export interface AgentFactsStorage {
  ping(timeoutMillis?: number): Promise<void>;
  getFacts(id: AgentID): Promise<FactsRecord | undefined>;
  insertFacts(vc: VerifiableCredential<AgentFacts>): Promise<void>;
  updateFacts(vc: VerifiableCredential<AgentFacts>): Promise<void>;
  invalidateFacts(id: AgentID): Promise<void>;
  close(): Promise<void>;
}

interface FactsRow {
  agent_id: string;
  facts_json: string;
  invalidated: number; // SQLite stores booleans as 0/1
  expires_at: string;
}

function rowToRecord(row: FactsRow): FactsRecord {
  return {
    vc: JSON.parse(row.facts_json) as VerifiableCredential<AgentFacts>,
    invalidated: row.invalidated === 1,
    expiresAt: row.expires_at,
  };
}

export async function createDb(filename: string): Promise<AgentFactsStorage> {
  const db: Database = await open({ filename, driver: sqlite3.Database });

  await db.run(`
    CREATE TABLE IF NOT EXISTS agent_facts (
      agent_id    TEXT PRIMARY KEY,
      facts_json  TEXT NOT NULL,
      invalidated INTEGER NOT NULL DEFAULT 0,
      expires_at  TEXT NOT NULL
    )
  `);

  return {
    async ping(timeoutMillis = DEFAULT_PING_TIMEOUT_MS) {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ping timeout')), timeoutMillis),
      );
      await Promise.race([db.get('SELECT 1'), timeout]);
    },

    async getFacts(id) {
      const row = await db.get<FactsRow>(
        `SELECT * FROM agent_facts WHERE agent_id = ?`, id,
      );
      return row ? rowToRecord(row) : undefined;
    },

    async insertFacts(vc) {
      try {
        await db.run(
          `INSERT INTO agent_facts (agent_id, facts_json, invalidated, expires_at)
           VALUES (?, ?, 0, ?)`,
          vc.credentialSubject.id,
          JSON.stringify(vc),
          vc.validUntil ?? '',
        );
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE constraint failed')) {
          throw new ConflictError(vc.credentialSubject.id);
        }
        throw e;
      }
    },

    async updateFacts(vc) {
      // Re-publishing clears the invalidation flag — valid facts replace revoked ones.
      const result = await db.run(
        `UPDATE agent_facts
            SET facts_json = ?, invalidated = 0, expires_at = ?
          WHERE agent_id = ?`,
        JSON.stringify(vc),
        vc.validUntil ?? '',
        vc.credentialSubject.id,
      );
      if (result.changes === 0) {
        throw new NotFoundError(vc.credentialSubject.id);
      }
    },

    async invalidateFacts(id) {
      const result = await db.run(
        `UPDATE agent_facts SET invalidated = 1 WHERE agent_id = ?`, id,
      );
      if (result.changes === 0) {
        throw new NotFoundError(id);
      }
    },

    async close() {
      await db.close();
    },
  };
}
