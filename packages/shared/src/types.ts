// AgentID is always a DID in this prototype, e.g. "did:web:translator.salesforce.com"
export type AgentID = string;

export interface ProtocolVersion {
  version: string; // e.g. "nanda-0.0.0-index", "nanda-0.0.0-facts|agent"
}

export interface AgentAddr {
  agentId: AgentID;
  agentName: string;              // human-readable URN, e.g. "urn:agent:salesforce:translator"
  primaryFactsUrl: string;
  privateFactsUrl?: string;
  adaptiveResolverUrl?: string;
  ttl: number;                    // seconds
  signature: string;              // base64url-encoded Ed25519 over all other fields, keys sorted
}

// AgentFacts per paper appendix (NANDA paper §Appendix).
// capabilities and skills are left open for scenario-specific extension.
export interface ServiceEndpoint {
  url: string;
  ttl: number; // seconds
}

export interface AgentFactsCertification {
  level: string;
  issuer: string;
  issuanceDate: string;           // ISO 8601
  expirationDate: string;         // ISO 8601
  statusListUrl: string;
}

export interface AgentFactsProvider {
  name: string;
  url: string;
  did?: string;
}

export interface AgentFactsEndpoints {
  static?: string[];
  rotating?: ServiceEndpoint[];
  adaptiveResolver?: string;
}

export interface AgentFactsCapabilities {
  modalities?: string[];
  streaming?: boolean;
  batch?: boolean;
  authentication?: {
    methods: string[];
    requiredScopes?: string[];
  };
  [key: string]: unknown;         // scenario-specific extensions
}

export interface AgentFactsSkill {
  id: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
  [key: string]: unknown;         // scenario-specific extensions
}

export interface AgentFactsEvaluations {
  performanceScore?: number;
  availability90d?: string;
  lastAudited?: string;
  auditTrail?: string;
  auditorID?: string;
}

export interface AgentFactsTelemetry {
  enabled: boolean;
  retention?: string;
  sampling?: number;
  metrics?: Record<string, unknown>;
}

export interface AgentFacts {
  '@context': string[];
  id: AgentID;
  agentName: string;
  label: string;
  description: string;
  version: string;
  jurisdiction?: string;
  provider: AgentFactsProvider;
  endpoints: AgentFactsEndpoints;
  capabilities: AgentFactsCapabilities;
  skills?: AgentFactsSkill[];
  evaluations?: AgentFactsEvaluations;
  telemetry?: AgentFactsTelemetry;
  certification: AgentFactsCertification;
  proof: string;                  // base64url-encoded Ed25519 over all other fields, keys sorted
}

export interface ServerStatus {
  status: 'ok' | 'degraded' | 'unavailable';
}

export interface ErrorResponse {
  error: string;    // machine-readable code
  message: string;  // human-readable description
}

// W3C DID Document (minimal subset needed for did:web resolution)
export interface DIDVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

export interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod?: DIDVerificationMethod[];
  authentication?: (string | DIDVerificationMethod)[];
  assertionMethod?: (string | DIDVerificationMethod)[];
}
