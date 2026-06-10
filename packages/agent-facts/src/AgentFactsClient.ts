import type { AgentFacts } from './AgentFacts.js';
import type { AgentID, ProtocolVersion, ServerStatus, SignedAttestation, VerifiableCredential } from '@nanda/shared';

// ── Request / response bodies ────────────────────────────────────────────────

// POST /facts  — body is a VC whose credentialSubject is the AgentFacts content
export type RegisterFactsRequest = VerifiableCredential<AgentFacts>;

// PUT /facts/:id  — body is an updated VC<AgentFacts>
export type UpdateFactsRequest = VerifiableCredential<AgentFacts>;

// GET /facts/:id  → VC<AgentFacts>
export type GetFactsResponse = VerifiableCredential<AgentFacts>;

// POST /facts/:id/invalidate  — body is a signed attestation
export type InvalidateFactsRequest = SignedAttestation<'invalidate-facts'>;

// GET /version  → ProtocolVersion
export type FactsGetVersionResponse = ProtocolVersion;

// GET /status  → ServerStatus
export type FactsGetStatusResponse = ServerStatus;

// ── Client interface ─────────────────────────────────────────────────────────

export interface AgentFactsClient {
  getFacts(id: AgentID): Promise<VerifiableCredential<AgentFacts>>;
  registerFacts(vc: VerifiableCredential<AgentFacts>): Promise<void>;
  updateFacts(vc: VerifiableCredential<AgentFacts>): Promise<void>;
  invalidateFacts(id: AgentID, attestation: SignedAttestation<'invalidate-facts'>): Promise<void>;
  getVersion(): Promise<ProtocolVersion>;
  getStatus(): Promise<ServerStatus>;
}
