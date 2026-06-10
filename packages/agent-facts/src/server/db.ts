import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { AgentFacts } from '../AgentFacts.js';
import type { AgentID } from '@nanda/shared';
import { NotFoundError, ConflictError } from '@nanda/shared';

const DEFAULT_PING_TIMEOUT_MS = 30_000;

export interface FactsRecord {
  facts: AgentFacts;
  invalidated: boolean;
  expiresAt: string; // ISO 8601 — derived from facts.certification.expirationDate at write time
}

export interface AgentFactsStorage {
  ping(timeoutMillis?: number): Promise<void>;
  getFacts(id: AgentID): Promise<FactsRecord | undefined>;
  insertFacts(facts: AgentFacts): Promise<void>;
  updateFacts(facts: AgentFacts): Promise<void>;
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
    facts: JSON.parse(row.facts_json) as AgentFacts,
    invalidated: row.invalidated === 1,
    expiresAt: row.expires_at,
  };
}

export async function createDb(filename: string): Promise<AgentFactsStorage> {
  const db: Database = await open({ filename, driver: sqlite3.Database });

  await db.run(`
    CREATE TABLE IF NOT EXISTS agent_facts (
      agent_id   TEXT PRIMARY KEY,
      facts_json TEXT NOT NULL,
      invalidated INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL
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

    async insertFacts(facts) {
      try {
        await db.run(
          `INSERT INTO agent_facts (agent_id, facts_json, invalidated, expires_at)
           VALUES (?, ?, 0, ?)`,
          facts.id,
          JSON.stringify(facts),
          facts.certification.expirationDate,
        );
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE constraint failed')) {
          throw new ConflictError(facts.id);
        }
        throw e;
      }
    },

    async updateFacts(facts) {
      // Re-publishing clears the invalidation flag — valid facts replace revoked ones.
      const result = await db.run(
        `UPDATE agent_facts
            SET facts_json = ?, invalidated = 0, expires_at = ?
          WHERE agent_id = ?`,
        JSON.stringify(facts),
        facts.certification.expirationDate,
        facts.id,
      );
      if (result.changes === 0) {
        throw new NotFoundError(facts.id);
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
