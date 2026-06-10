import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpLeanIndexClient } from '../src/clients/HttpLeanIndexClient.js';
import { HttpAgentFactsClient } from '../src/clients/HttpAgentFactsClient.js';
import { HttpAgentBaseClient } from '../src/clients/HttpAgentBaseClient.js';
import { HttpClientError } from '@nanda/shared';
import type { AgentAddr } from '@nanda/lean-index';
import type { AgentFacts } from '@nanda/agent-facts';
import type { VerifiableCredential } from '@nanda/shared';

// ── Fetch mock helpers ────────────────────────────────────────────────────────

const mockFetch = vi.fn();

function okResponse(body?: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => (body !== undefined ? JSON.stringify(body) : ''),
  };
}

function errorResponse(status: number, message: string) {
  return { ok: false, status, text: async () => JSON.stringify({ message }) };
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DID = 'did:web:agent.example.com';
const ENCODED_DID = encodeURIComponent(DID);
const BASE = 'https://index.example.com';
const SIG = 'A'.repeat(86);

const agentAddr: AgentAddr = {
  agentId: DID,
  agentName: 'urn:agent:example:test',
  primaryFactsUrl: 'https://facts.example.com/facts/did%3Aweb%3Aagent.example.com',
  ttl: 3600,
  signature: SIG,
};

const agentFacts: AgentFacts = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  id: DID,
  agentName: 'urn:agent:example:test',
  label: 'Test',
  description: 'Test agent',
  version: '1.0.0',
  provider: { name: 'Example', url: 'https://example.com' },
  endpoints: { static: ['https://agent.example.com/api'] },
  capabilities: { modalities: ['text'] },
  certification: {
    level: 'verified',
    issuer: DID,
    issuanceDate: '2025-01-01T00:00:00Z',
    expirationDate: '2099-01-01T00:00:00Z',
    statusListUrl: 'https://example.com/status',
  },
};

const vc: VerifiableCredential<AgentFacts> = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential'],
  issuer: DID,
  validFrom: '2025-01-01T00:00:00Z',
  credentialSubject: agentFacts,
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    created: '2025-01-01T00:00:00Z',
    verificationMethod: `${DID}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue: SIG,
  },
};

const attestation = { agentId: DID, action: 'delete-agent' as const, issuedAt: '2025-01-01T00:00:00Z', signature: SIG };

// ── HttpLeanIndexClient ───────────────────────────────────────────────────────

describe('HttpLeanIndexClient', () => {
  let client: HttpLeanIndexClient;
  beforeEach(() => { client = new HttpLeanIndexClient(BASE); });

  it('getAgent — GET /agents/:id with encoded DID', async () => {
    mockFetch.mockResolvedValue(okResponse(agentAddr));
    const result = await client.getAgent(DID);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/agents/${ENCODED_DID}`,
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(result).toEqual(agentAddr);
  });

  it('registerAgent — POST /agents with body', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await client.registerAgent(agentAddr);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/agents`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(agentAddr) }),
    );
  });

  it('updateAgent — PUT /agents/:id with body', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await client.updateAgent(DID, agentAddr);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/agents/${ENCODED_DID}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(agentAddr) }),
    );
  });

  it('deleteAgent — DELETE /agents/:id with attestation body', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await client.deleteAgent(DID, attestation);
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE}/agents/${ENCODED_DID}`,
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify(attestation) }),
    );
  });

  it('getVersion — GET /version', async () => {
    mockFetch.mockResolvedValue(okResponse({ version: 'nanda-0.0.0-index' }));
    const result = await client.getVersion();
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/version`, expect.anything());
    expect(result).toEqual({ version: 'nanda-0.0.0-index' });
  });

  it('getStatus — GET /status', async () => {
    mockFetch.mockResolvedValue(okResponse({ status: 'ok' }));
    await client.getStatus();
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/status`, expect.anything());
  });

  it('throws HttpClientError on non-2xx response', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'not found'));
    await expect(client.getAgent(DID)).rejects.toBeInstanceOf(HttpClientError);
  });
});

// ── HttpAgentFactsClient ──────────────────────────────────────────────────────

describe('HttpAgentFactsClient', () => {
  const FACTS_BASE = 'https://facts.example.com';
  let client: HttpAgentFactsClient;
  beforeEach(() => { client = new HttpAgentFactsClient(FACTS_BASE); });

  it('getFacts — GET /facts/:id', async () => {
    mockFetch.mockResolvedValue(okResponse(vc));
    const result = await client.getFacts(DID);
    expect(mockFetch).toHaveBeenCalledWith(
      `${FACTS_BASE}/facts/${ENCODED_DID}`,
      expect.anything(),
    );
    expect(result).toEqual(vc);
  });

  it('registerFacts — POST /facts with VC body', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await client.registerFacts(vc);
    expect(mockFetch).toHaveBeenCalledWith(
      `${FACTS_BASE}/facts`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(vc) }),
    );
  });

  it('updateFacts — PUT /facts/:id, id derived from credentialSubject', async () => {
    mockFetch.mockResolvedValue(okResponse());
    await client.updateFacts(vc);
    expect(mockFetch).toHaveBeenCalledWith(
      `${FACTS_BASE}/facts/${ENCODED_DID}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(vc) }),
    );
  });

  it('invalidateFacts — POST /facts/:id/invalidate', async () => {
    const inv = { agentId: DID, action: 'invalidate-facts' as const, issuedAt: '2025-01-01T00:00:00Z', signature: SIG };
    mockFetch.mockResolvedValue(okResponse());
    await client.invalidateFacts(DID, inv);
    expect(mockFetch).toHaveBeenCalledWith(
      `${FACTS_BASE}/facts/${ENCODED_DID}/invalidate`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(inv) }),
    );
  });

  it('throws HttpClientError on non-2xx response', async () => {
    mockFetch.mockResolvedValue(errorResponse(409, 'conflict'));
    await expect(client.registerFacts(vc)).rejects.toBeInstanceOf(HttpClientError);
  });
});

// ── HttpAgentBaseClient ───────────────────────────────────────────────────────

describe('HttpAgentBaseClient', () => {
  const AGENT_BASE = 'https://agent.example.com';
  let client: HttpAgentBaseClient;
  beforeEach(() => { client = new HttpAgentBaseClient(AGENT_BASE); });

  it('getDIDDocument — GET /.well-known/did.json', async () => {
    const doc = { '@context': ['https://www.w3.org/ns/did/v1'], id: DID };
    mockFetch.mockResolvedValue(okResponse(doc));
    const result = await client.getDIDDocument();
    expect(mockFetch).toHaveBeenCalledWith(`${AGENT_BASE}/.well-known/did.json`, expect.anything());
    expect(result).toEqual(doc);
  });
});
