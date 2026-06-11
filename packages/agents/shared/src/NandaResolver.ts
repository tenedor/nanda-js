import { fetchJson, type AgentID, type Endpoint } from '@nanda/shared';
import type { VerifiableCredential } from '@nanda/shared';
import type { AgentFacts } from '@nanda/agent-facts';
import { HttpLeanIndexClient } from './clients/HttpLeanIndexClient.js';

// Resolves a DID to a callable HTTP endpoint via NANDA infrastructure:
// lean-index → AgentAddr.primaryFactsUrl → AgentFacts.endpoints.static[0]
export class NandaResolver {
  private readonly leanIndexClient: HttpLeanIndexClient;

  constructor(leanIndexUrl: Endpoint) {
    this.leanIndexClient = new HttpLeanIndexClient(leanIndexUrl);
  }

  async resolveEndpoint(did: AgentID): Promise<Endpoint> {
    const agentAddr = await this.leanIndexClient.getAgent(did);
    const factsVc = await fetchJson<VerifiableCredential<AgentFacts>>(agentAddr.primaryFactsUrl);
    const staticEndpoints = factsVc.credentialSubject.endpoints?.static;
    if (!staticEndpoints || staticEndpoints.length === 0) {
      throw new Error(`No static endpoints in AgentFacts for ${did}`);
    }
    return staticEndpoints[0];
  }
}
