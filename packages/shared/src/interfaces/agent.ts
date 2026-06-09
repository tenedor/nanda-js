import type { DIDDocument, ProtocolVersion, ServerStatus, ErrorResponse } from '../types.js';

// ── Request / response bodies ────────────────────────────────────────────────

// GET /.well-known/did.json  → DIDDocument
export type GetDIDDocumentResponse = DIDDocument;

// GET /version  → ProtocolVersion
export type AgentGetVersionResponse = ProtocolVersion;

// GET /status  → ServerStatus
export type AgentGetStatusResponse = ServerStatus;

// Scenario-specific endpoints are defined in each agent's own package.

// ── Client interface ─────────────────────────────────────────────────────────

export interface AgentBaseClient {
  getDIDDocument(): Promise<DIDDocument>;
  getVersion(): Promise<ProtocolVersion>;
  getStatus(): Promise<ServerStatus>;
}

// ── Re-export error shape for convenience ───────────────────────────────────
export type { ErrorResponse };
