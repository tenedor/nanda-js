import type { AgentID, AgentName, Endpoint } from '@nanda/shared';
import type { AgentFacts } from './AgentFacts.js';

export interface BuildAgentFactsOptions {
  id: AgentID;
  agentName: AgentName;
  label: string;
  description: string;
  /** Agent version string — callers typically pass their protocol version constant. */
  version: string;
  providerName: string;
  providerUrl: Endpoint;
  /** Static endpoint URLs the agent is reachable at. */
  endpoints: Endpoint[];
  jurisdiction?: string;
}

/**
 * Builds a minimal but schema-valid AgentFacts object suitable for prototype use.
 * Certification is self-attested with a one-year expiry; callers can replace it
 * with a real third-party certification later.
 */
export function buildAgentFacts(opts: BuildAgentFactsOptions): AgentFacts {
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: opts.id,
    agentName: opts.agentName,
    label: opts.label,
    description: opts.description,
    version: opts.version,
    ...(opts.jurisdiction !== undefined && { jurisdiction: opts.jurisdiction }),
    provider: {
      name: opts.providerName,
      url: opts.providerUrl,
    },
    endpoints: {
      static: opts.endpoints,
    },
    capabilities: {
      modalities: ['text'],
    },
    certification: {
      level: 'self-attested',
      issuer: opts.id,
      issuanceDate: now.toISOString(),
      expirationDate: oneYearLater.toISOString(),
      statusListUrl: `${opts.providerUrl}/status`,
    },
  };
}
