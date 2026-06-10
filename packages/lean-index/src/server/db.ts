import { open, type Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import type { AgentAddr } from '../AgentAddr.js';
import type { AgentID } from '@nanda/shared';

export interface AgentAddrStorage {
  ping(timeoutMillis?: number): Promise<void>;
  getAgent(id: AgentID): Promise<AgentAddr | undefined>;
  insertAgent(record: AgentAddr): Promise<void>;
  updateAgent(record: AgentAddr): Promise<void>;
  deleteAgent(id: AgentID): Promise<void>;
  close(): Promise<void>;
}

interface AgentAddrRow {
  agent_id: string;
  agent_name: string;
  primary_facts_url: string;
  private_facts_url: string | null;
  adaptive_resolver_url: string | null;
  ttl: number;
  signature: string;
}

function rowToRecord(row: AgentAddrRow): AgentAddr {
  return {
    agentId: row.agent_id,
    agentName: row.agent_name,
    primaryFactsUrl: row.primary_facts_url,
    ...(row.private_facts_url != null && { privateFactsUrl: row.private_facts_url }),
    ...(row.adaptive_resolver_url != null && { adaptiveResolverUrl: row.adaptive_resolver_url }),
    ttl: row.ttl,
    signature: row.signature,
  };
}

export async function createDb(filename: string): Promise<AgentAddrStorage> {
  const db: Database = await open({ filename, driver: sqlite3.Database });

  await db.run(`
    CREATE TABLE IF NOT EXISTS agent_addrs (
      agent_id              TEXT PRIMARY KEY,
      agent_name            TEXT NOT NULL,
      primary_facts_url     TEXT NOT NULL,
      private_facts_url     TEXT,
      adaptive_resolver_url TEXT,
      ttl                   INTEGER NOT NULL,
      signature             TEXT NOT NULL
    )
  `);

  return {
    async ping(timeoutMillis = 500) {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ping timeout')), timeoutMillis),
      );
      await Promise.race([db.get('SELECT 1'), timeout]);
    },

    async getAgent(id) {
      const row = await db.get<AgentAddrRow>(
        `SELECT * FROM agent_addrs WHERE agent_id = ?`, id,
      );
      return row ? rowToRecord(row) : undefined;
    },

    async insertAgent(record) {
      try {
        await db.run(
          `INSERT INTO agent_addrs
             (agent_id, agent_name, primary_facts_url, private_facts_url,
              adaptive_resolver_url, ttl, signature)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          record.agentId, record.agentName, record.primaryFactsUrl,
          record.privateFactsUrl ?? null, record.adaptiveResolverUrl ?? null,
          record.ttl, record.signature,
        );
      } catch (e) {
        if ((e as Error).message.includes('UNIQUE constraint failed')) {
          throw new ConflictError(record.agentId);
        }
        throw e;
      }
    },

    async updateAgent(record) {
      const result = await db.run(
        `UPDATE agent_addrs
            SET agent_name = ?, primary_facts_url = ?, private_facts_url = ?,
                adaptive_resolver_url = ?, ttl = ?, signature = ?
          WHERE agent_id = ?`,
        record.agentName, record.primaryFactsUrl,
        record.privateFactsUrl ?? null, record.adaptiveResolverUrl ?? null,
        record.ttl, record.signature, record.agentId,
      );
      if (result.changes === 0) {
        throw new NotFoundError(record.agentId);
      }
    },

    async deleteAgent(id) {
      const result = await db.run(
        `DELETE FROM agent_addrs WHERE agent_id = ?`, id,
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

export class NotFoundError extends Error {
  constructor(public readonly agentId: AgentID) {
    super(`Agent not found: ${agentId}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(public readonly agentId: AgentID) {
    super(`Agent already exists: ${agentId}`);
    this.name = 'ConflictError';
  }
}
