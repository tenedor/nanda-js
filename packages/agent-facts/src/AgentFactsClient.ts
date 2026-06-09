import type { AgentFacts } from './AgentFacts.js';
import type { AgentID } from '@nanda/shared';
import type { ProtocolVersion, ServerStatus } from '@nanda/shared';

// ── Request / response bodies ────────────────────────────────────────────────

// POST /facts  — body is the signed AgentFacts itself
export type RegisterFactsRequest = AgentFacts;

// PUT /facts/:id  — body is the updated signed AgentFacts
export type UpdateFactsRequest = AgentFacts;

// GET /facts/:id  → AgentFacts
export type GetFactsResponse = AgentFacts;

// POST /facts/:id/invalidate  → 204 No Content

// GET /version  → ProtocolVersion
export type FactsGetVersionResponse = ProtocolVersion;

// GET /status  → ServerStatus
export type FactsGetStatusResponse = ServerStatus;

// ── Client interface ─────────────────────────────────────────────────────────

export interface AgentFactsClient {
  getFacts(id: AgentID): Promise<AgentFacts>;
  registerFacts(facts: AgentFacts): Promise<void>;
  updateFacts(id: AgentID, facts: AgentFacts): Promise<void>;
  invalidateFacts(id: AgentID): Promise<void>;
  getVersion(): Promise<ProtocolVersion>;
  getStatus(): Promise<ServerStatus>;
}
