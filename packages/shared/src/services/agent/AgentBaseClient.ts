import type { DIDDocument } from '../../identity/DIDDocument.js';
import type { ProtocolVersion, ServerStatus } from '../common/types.js';

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
