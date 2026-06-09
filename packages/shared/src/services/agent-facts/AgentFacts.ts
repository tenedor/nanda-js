import type { AgentID } from '../lean-index/AgentAddr.js';

export interface ServiceEndpoint {
  url: string;
  ttl: number; // seconds
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
  issuanceDate: string;  // ISO 8601
  expirationDate: string; // ISO 8601
  statusListUrl: string;
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
  proof: string; // base64url-encoded Ed25519 over all other fields, keys sorted
}
