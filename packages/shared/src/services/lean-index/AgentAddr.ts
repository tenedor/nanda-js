// AgentID is always a DID in this prototype, e.g. "did:web:translator.salesforce.com"
export type AgentID = string;

export interface AgentAddr {
  agentId: AgentID;
  agentName: string;             // human-readable URN, e.g. "urn:agent:salesforce:translator"
  primaryFactsUrl: string;
  privateFactsUrl?: string;
  adaptiveResolverUrl?: string;
  ttl: number;                   // seconds
  signature: string;             // base64url-encoded Ed25519 over all other fields, keys sorted
}
