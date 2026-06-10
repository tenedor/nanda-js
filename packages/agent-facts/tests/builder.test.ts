import { describe, it, expect } from 'vitest';
import { buildAgentFacts } from '../src/AgentFactsBuilder.js';

const OPTS = {
  id: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  label: 'Test Agent',
  description: 'A test agent',
  version: 'nanda-0.0.0-agent',
  providerName: 'Example Corp',
  providerUrl: 'https://example.com',
  endpoints: ['https://agent.example.com/api'],
};

describe('buildAgentFacts', () => {
  it('produces a schema-valid AgentFacts object', () => {
    const facts = buildAgentFacts(OPTS);
    expect(facts.id).toBe(OPTS.id);
    expect(facts.agentName).toBe(OPTS.agentName);
    expect(facts.label).toBe(OPTS.label);
    expect(facts.description).toBe(OPTS.description);
    expect(facts.version).toBe(OPTS.version);
    expect(facts.provider.name).toBe(OPTS.providerName);
    expect(facts.provider.url).toBe(OPTS.providerUrl);
    expect(facts.endpoints.static).toEqual(OPTS.endpoints);
    expect(facts.capabilities.modalities).toEqual(['text']);
  });

  it('self-attests certification with a one-year expiry', () => {
    const before = new Date();
    const facts = buildAgentFacts(OPTS);
    const after = new Date();

    expect(facts.certification.level).toBe('self-attested');
    expect(facts.certification.issuer).toBe(OPTS.id);

    const issued = new Date(facts.certification.issuanceDate);
    const expires = new Date(facts.certification.expirationDate);
    expect(issued >= before && issued <= after).toBe(true);
    expect(expires.getFullYear()).toBe(issued.getFullYear() + 1);
  });

  it('statusListUrl is derived from providerUrl', () => {
    const facts = buildAgentFacts(OPTS);
    expect(facts.certification.statusListUrl).toBe(`${OPTS.providerUrl}/status`);
  });

  it('omits jurisdiction when not provided', () => {
    const facts = buildAgentFacts(OPTS);
    expect('jurisdiction' in facts).toBe(false);
  });

  it('includes jurisdiction when provided', () => {
    const facts = buildAgentFacts({ ...OPTS, jurisdiction: 'US' });
    expect(facts.jurisdiction).toBe('US');
  });
});
