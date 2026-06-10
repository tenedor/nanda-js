import type { LeanIndexClient, AgentAddr } from '@nanda/lean-index';
import {
  fetchJson,
  type AgentID,
  type Endpoint,
  type ProtocolVersion,
  type ServerStatus,
  type SignedAttestation,
} from '@nanda/shared';

export class HttpLeanIndexClient implements LeanIndexClient {
  constructor(private readonly baseUrl: Endpoint) {}

  async getAgent(id: AgentID): Promise<AgentAddr> {
    return fetchJson<AgentAddr>(`${this.baseUrl}/agents/${encodeURIComponent(id)}`);
  }

  async registerAgent(record: AgentAddr): Promise<void> {
    await fetchJson<void>(`${this.baseUrl}/agents`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  async updateAgent(id: AgentID, record: AgentAddr): Promise<void> {
    await fetchJson<void>(`${this.baseUrl}/agents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  }

  async deleteAgent(id: AgentID, attestation: SignedAttestation<'delete-agent'>): Promise<void> {
    await fetchJson<void>(`${this.baseUrl}/agents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
