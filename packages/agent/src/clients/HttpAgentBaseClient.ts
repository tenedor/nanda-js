import type { AgentBaseClient } from '../AgentBaseClient.js';
import {
  fetchJson,
  type DIDDocument,
  type Endpoint,
  type ProtocolVersion,
  type ServerStatus,
} from '@nanda/shared';

export class HttpAgentBaseClient implements AgentBaseClient {
  constructor(private readonly baseUrl: Endpoint) {}

  async getDIDDocument(): Promise<DIDDocument> {
    return fetchJson<DIDDocument>(`${this.baseUrl}/.well-known/did.json`);
  }

  async getVersion(): Promise<ProtocolVersion> {
    return fetchJson<ProtocolVersion>(`${this.baseUrl}/version`);
  }

  async getStatus(): Promise<ServerStatus> {
    return fetchJson<ServerStatus>(`${this.baseUrl}/status`);
  }
}
