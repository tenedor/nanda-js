import type { AgentID, AgentName, Endpoint } from '@nanda/shared';

export interface RotatingEndpoint {
  url: Endpoint;
  ttl: number; // seconds
}

export interface AgentFactsProvider {
  name: string;
  url: Endpoint;
  did?: string;
}

export interface AgentFactsEndpoints {
  static?: Endpoint[];
  rotating?: RotatingEndpoint[];
  adaptiveResolver?: Endpoint;
}

export interface AgentFactsCapabilities {
  modalities?: string[];
  streaming?: boolean;
  batch?: boolean;
  authentication?: {
    methods: string[];
    requiredScopes?: string[];
  };
  [key: string]: unknown; // scenario-specific extensions
}

export interface AgentFactsSkill {
  id: string;
  description: string;
  inputModes?: string[];
  outputModes?: string[];
  [key: string]: unknown; // scenario-specific extensions
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

export interface AgentFactsCertification {
  level: string;
  issuer: string;
  issuanceDate: string;   // ISO 8601
  expirationDate: string; // ISO 8601
  statusListUrl: string;
}

// TODO: The paper (Section V.E) says AgentFacts has "its own ttl value" governing how long
// capabilities and evaluations may be considered fresh by clients, but the appendix schema
// has no top-level ttl field — the paper may be conflating this with certification.expirationDate.
// Add a ttl field (seconds) here once the distinction is clarified; it should govern client-side
// caching of received AgentFacts independently of when the VC credential expires.
export interface AgentFacts {
  '@context': string[];
  id: AgentID;
  agentName: AgentName;
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
}
