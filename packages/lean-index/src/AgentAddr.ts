import type { AgentID, AgentName, Endpoint, Signature } from '@nanda/shared';

export interface AgentAddr {
  agentId: AgentID;
  agentName: AgentName;
  primaryFactsUrl: Endpoint;
  privateFactsUrl?: Endpoint;
  adaptiveResolverUrl?: Endpoint;
  ttl: number;           // seconds
  signature: Signature;  // Ed25519 over all other fields, keys sorted
}
