import type { AgentID, AgentName } from '@nanda/shared';

export interface AgentAddr {
  agentId: AgentID;
  agentName: AgentName;
  primaryFactsUrl: string;
  privateFactsUrl?: string;
  adaptiveResolverUrl?: string;
  ttl: number;       // seconds
  signature: string; // base64url-encoded Ed25519 over all other fields, keys sorted
}
