import type { AgentFactsClient, AgentFacts } from '@nanda/agent-facts';
import {
  fetchJson,
  type AgentID,
  type Endpoint,
  type ProtocolVersion,
  type ServerStatus,
  type SignedAttestation,
  type VerifiableCredential,
} from '@nanda/shared';

export class HttpAgentFactsClient implements AgentFactsClient {
  constructor(private readonly baseUrl: Endpoint) {}

  async getFacts(id: AgentID): Promise<VerifiableCredential<AgentFacts>> {
    return fetchJson<VerifiableCredential<AgentFacts>>(`${this.baseUrl}/facts/${encodeURIComponent(id)}`);
  }

  async registerFacts(vc: VerifiableCredential<AgentFacts>): Promise<void> {
    await fetchJson<void>(`${this.baseUrl}/facts`, {
      method: 'POST',
      body: JSON.stringify(vc),
    });
  }

  async updateFacts(vc: VerifiableCredential<AgentFacts>): Promise<void> {
    const id = vc.credentialSubject.id;
    await fetchJson<void>(`${this.baseUrl}/facts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(vc),
    });
  }

  async invalidateFacts(id: AgentID, attestation: SignedAttestation<'invalidate-facts'>): Promise<void> {
    await fetchJson<void>(`${this.baseUrl}/facts/${encodeURIComponent(id)}/invalidate`, {
      method: 'POST',
      body: JSON.stringify(attestation),
    });
  }

  async getVersion(): Promise<ProtocolVersion> {
    return fetchJson<ProtocolVersion>(`${this.baseUrl}/version`);
  }

  async getStatus(): Promise<ServerStatus> {
    return fetchJson<ServerStatus>(`${this.baseUrl}/status`);
  }
}
