import type { AgentAddr, AgentID, ProtocolVersion, ServerStatus, ErrorResponse } from '../types.js';

// ── Request / response bodies ────────────────────────────────────────────────

// POST /agents  — body is the signed AgentAddr itself
export type RegisterAgentRequest = AgentAddr;

// PUT /agents/:id  — body is the updated signed AgentAddr
export type UpdateAgentRequest = AgentAddr;

// GET /agents/:id  → AgentAddr | ErrorResponse
export type GetAgentResponse = AgentAddr;

// DELETE /agents/:id  → 204 No Content (no body)

// GET /version  → ProtocolVersion
export type IndexGetVersionResponse = ProtocolVersion;

// GET /status  → ServerStatus
export type IndexGetStatusResponse = ServerStatus;

// ── Client interface ─────────────────────────────────────────────────────────

export interface LeanIndexClient {
  getAgent(id: AgentID): Promise<AgentAddr>;
  registerAgent(record: AgentAddr): Promise<void>;
  updateAgent(id: AgentID, record: AgentAddr): Promise<void>;
  deleteAgent(id: AgentID): Promise<void>;
  getVersion(): Promise<ProtocolVersion>;
  getStatus(): Promise<ServerStatus>;
}

// ── Re-export error shape for convenience ───────────────────────────────────
export type { ErrorResponse };
