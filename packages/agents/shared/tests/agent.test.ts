import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentIdentityManager, type AgentIdentityManagerOptions } from '../src/AgentIdentityManager.js';
import {
  generateKeyPair,
  publicKeyToBase64url,
  verify,
  canonicalize,
  ValidationError,
  type SignedAttestation,
} from '@nanda/shared';
import type { LeanIndexClient, AgentAddr } from '@nanda/lean-index';
import type { AgentFactsClient, AgentFacts } from '@nanda/agent-facts';
import type { VerifiableCredential } from '@nanda/shared';

// ── Mock client factories ─────────────────────────────────────────────────────

function mockLeanIndexClient(): LeanIndexClient {
  return {
    getAgent: vi.fn(),
    registerAgent: vi.fn().mockResolvedValue(undefined),
    updateAgent: vi.fn().mockResolvedValue(undefined),
    deleteAgent: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn(),
    getStatus: vi.fn(),
  };
}

function mockAgentFactsClient(): AgentFactsClient {
  return {
    getFacts: vi.fn(),
    registerFacts: vi.fn().mockResolvedValue(undefined),
    updateFacts: vi.fn().mockResolvedValue(undefined),
    invalidateFacts: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn(),
    getStatus: vi.fn(),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DID = 'did:web:agent.example.com';
const AGENT_NAME = 'urn:agent:example:test';
const LEAN_URL = 'https://index.example.com';
const FACTS_URL = 'https://facts.example.com';
const PRIVATE_FACTS_URL = 'https://private.example.com';
const keyPair = generateKeyPair();

function makeOpts(overrides: Partial<AgentIdentityManagerOptions> = {}): AgentIdentityManagerOptions {
  return {
    did: DID,
    keyPair,
    agentName: AGENT_NAME,
    leanIndexUrl: LEAN_URL,
    primaryFactsServerUrl: FACTS_URL,
    ...overrides,
  };
}

function makeFacts(overrides: Partial<AgentFacts> = {}): AgentFacts {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: DID,
    agentName: AGENT_NAME,
    label: 'Test Agent',
    description: 'A test agent',
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
    ...overrides,
  };
}

// ── getDIDDocument ────────────────────────────────────────────────────────────

describe('getDIDDocument', () => {
  it('returns a well-formed did:web document', () => {
    const mgr = AgentIdentityManager._build(makeOpts(), mockLeanIndexClient(), mockAgentFactsClient());
    const doc = mgr.getDIDDocument();

    expect(doc.id).toBe(DID);
    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(doc.verificationMethod).toHaveLength(1);
    expect(doc.verificationMethod![0].id).toBe(`${DID}#key-1`);
    expect(doc.verificationMethod![0].publicKeyMultibase).toBe('u' + publicKeyToBase64url(keyPair.publicKey));
    expect(doc.assertionMethod).toContain(`${DID}#key-1`);
  });
});

// ── registerFactsAndIndex ─────────────────────────────────────────────────────

describe('registerFactsAndIndex', () => {
  let lean: LeanIndexClient;
  let facts: AgentFactsClient;
  let mgr: AgentIdentityManager;

  beforeEach(() => {
    lean = mockLeanIndexClient();
    facts = mockAgentFactsClient();
    mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
  });

  it('issues a VC and posts to facts server, then registers AgentAddr with lean index', async () => {
    await mgr.registerFactsAndIndex(makeFacts());

    expect(facts.registerFacts).toHaveBeenCalledOnce();
    const vc = (facts.registerFacts as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential<AgentFacts>;
    expect(vc.credentialSubject.id).toBe(DID);
    expect(vc.issuer).toBe(DID);
    expect(vc.proof.verificationMethod).toBe(`${DID}#key-1`);

    expect(lean.registerAgent).toHaveBeenCalledOnce();
    const addr = (lean.registerAgent as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAddr;
    expect(addr.agentId).toBe(DID);
    expect(addr.agentName).toBe(AGENT_NAME);
    expect(addr.primaryFactsUrl).toBe(`${FACTS_URL}/facts/${encodeURIComponent(DID)}`);
    expect(addr.ttl).toBe(3600);
  });

  it('AgentAddr signature is a valid Ed25519 sig over the unsigned fields', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    const addr = (lean.registerAgent as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAddr;
    const { signature, ...unsigned } = addr;
    expect(verify(keyPair.publicKey, canonicalize(unsigned as Record<string, unknown>), signature)).toBe(true);
  });

  it('includes primaryFactsUrl in AgentAddr, no privateFactsUrl by default', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    const addr = (lean.registerAgent as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAddr;
    expect(addr.privateFactsUrl).toBeUndefined();
  });

  it('includes privateFactsUrl when configured', async () => {
    const m = AgentIdentityManager._build(makeOpts({ privateFactsServerUrl: PRIVATE_FACTS_URL }), lean, facts);
    await m.registerFactsAndIndex(makeFacts());
    const addr = (lean.registerAgent as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAddr;
    expect(addr.privateFactsUrl).toBe(`${PRIVATE_FACTS_URL}/facts/${encodeURIComponent(DID)}`);
  });

  it('passes validUntil through to the issued VC', async () => {
    await mgr.registerFactsAndIndex(makeFacts(), { validUntil: '2099-01-01T00:00:00Z' });
    const vc = (facts.registerFacts as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential<AgentFacts>;
    expect(vc.validUntil).toBe('2099-01-01T00:00:00Z');
  });

  it('rejects facts whose id does not match the agent DID', async () => {
    await expect(mgr.registerFactsAndIndex(makeFacts({ id: 'did:web:other.example.com' }))).rejects.toBeInstanceOf(ValidationError);
    expect(facts.registerFacts).not.toHaveBeenCalled();
  });

  it('rejects facts whose agentName does not match', async () => {
    await expect(mgr.registerFactsAndIndex(makeFacts({ agentName: 'urn:agent:other' }))).rejects.toBeInstanceOf(ValidationError);
    expect(facts.registerFacts).not.toHaveBeenCalled();
  });
});

// ── updateFacts ───────────────────────────────────────────────────────────────

describe('updateFacts', () => {
  it('issues a new VC and calls updateFacts on the facts client', async () => {
    const lean = mockLeanIndexClient();
    const facts = mockAgentFactsClient();
    const mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
    await mgr.updateFacts(makeFacts({ label: 'Updated' }));

    expect(facts.updateFacts).toHaveBeenCalledOnce();
    const vc = (facts.updateFacts as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential<AgentFacts>;
    expect(vc.credentialSubject.label).toBe('Updated');
    expect(lean.updateAgent).not.toHaveBeenCalled();
  });
});

// ── invalidateFacts ───────────────────────────────────────────────────────────

describe('invalidateFacts', () => {
  it('signs and sends an invalidate-facts attestation', async () => {
    const lean = mockLeanIndexClient();
    const facts = mockAgentFactsClient();
    const mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
    await mgr.invalidateFacts();

    expect(facts.invalidateFacts).toHaveBeenCalledOnce();
    const [id, attestation] = (facts.invalidateFacts as ReturnType<typeof vi.fn>).mock.calls[0] as [string, SignedAttestation<'invalidate-facts'>];
    expect(id).toBe(DID);
    expect(attestation.action).toBe('invalidate-facts');
    const { signature, ...base } = attestation;
    expect(verify(keyPair.publicKey, canonicalize(base as Record<string, unknown>), signature)).toBe(true);
  });
});

// ── deregister ────────────────────────────────────────────────────────────────

describe('deregister', () => {
  it('signs and sends a delete-agent attestation to the lean index', async () => {
    const lean = mockLeanIndexClient();
    const facts = mockAgentFactsClient();
    const mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
    await mgr.deregister();

    expect(lean.deleteAgent).toHaveBeenCalledOnce();
    const [id, attestation] = (lean.deleteAgent as ReturnType<typeof vi.fn>).mock.calls[0] as [string, SignedAttestation<'delete-agent'>];
    expect(id).toBe(DID);
    expect(attestation.action).toBe('delete-agent');
    const { signature, ...base } = attestation;
    expect(verify(keyPair.publicKey, canonicalize(base as Record<string, unknown>), signature)).toBe(true);
  });
});

// ── updateIndexRegistration ───────────────────────────────────────────────────

describe('updateIndexRegistration', () => {
  it('calls updateAgent on the lean index with current AgentAddr state', async () => {
    const lean = mockLeanIndexClient();
    const mgr = AgentIdentityManager._build(makeOpts(), lean, mockAgentFactsClient());
    await mgr.updateIndexRegistration();

    expect(lean.updateAgent).toHaveBeenCalledOnce();
    const [id, addr] = (lean.updateAgent as ReturnType<typeof vi.fn>).mock.calls[0] as [string, AgentAddr];
    expect(id).toBe(DID);
    expect(addr.agentId).toBe(DID);
  });
});

// ── updateAgentAddr ───────────────────────────────────────────────────────────

describe('updateAgentAddr', () => {
  let lean: LeanIndexClient;
  let facts: AgentFactsClient;
  let mgr: AgentIdentityManager;

  beforeEach(() => {
    lean = mockLeanIndexClient();
    facts = mockAgentFactsClient();
    mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
  });

  it('mutates instance properties and syncs by default', async () => {
    await mgr.updateAgentAddr({ agentName: 'urn:agent:example:updated', ttl: 7200 });
    expect(mgr.agentName).toBe('urn:agent:example:updated');
    expect(mgr.ttl).toBe(7200);
    expect(lean.updateAgent).toHaveBeenCalledOnce();
  });

  it('skips sync when dontSyncIndex=true', async () => {
    await mgr.updateAgentAddr({ agentName: 'urn:agent:example:updated' }, { dontSyncIndex: true });
    expect(lean.updateAgent).not.toHaveBeenCalled();
  });

  it('updates primaryFactsServerUrl and swaps the injected facts client', async () => {
    const newFactsClient = mockAgentFactsClient();
    const newUrl = 'https://new-facts.example.com';
    await mgr.updateAgentAddr({ primaryFactsServerUrl: newUrl }, {}, newFactsClient);
    expect(mgr.primaryFactsServerUrl).toBe(newUrl);
    await mgr.updateFacts(makeFacts());
    expect(newFactsClient.updateFacts).toHaveBeenCalledOnce();
    expect(facts.updateFacts).not.toHaveBeenCalled();
  });

  it('clears privateFactsServerUrl when set to null', async () => {
    const m = AgentIdentityManager._build(makeOpts({ privateFactsServerUrl: PRIVATE_FACTS_URL }), lean, facts);
    await m.updateAgentAddr({ privateFactsServerUrl: null });
    expect(m.privateFactsServerUrl).toBeUndefined();
    await m.updateIndexRegistration();
    const addr = (lean.updateAgent as ReturnType<typeof vi.fn>).mock.calls[1][1] as AgentAddr;
    expect(addr.privateFactsUrl).toBeUndefined();
  });

  it('clears adaptiveResolverUrl when set to null', async () => {
    const m = AgentIdentityManager._build(
      makeOpts({ adaptiveResolverUrl: 'https://resolver.example.com' }), lean, facts,
    );
    await m.updateAgentAddr({ adaptiveResolverUrl: null });
    expect(m.adaptiveResolverUrl).toBeUndefined();
  });

  it('AgentAddr in sync call reflects updated state', async () => {
    await mgr.updateAgentAddr({ ttl: 900 });
    const addr = (lean.updateAgent as ReturnType<typeof vi.fn>).mock.calls[0][1] as AgentAddr;
    expect(addr.ttl).toBe(900);
  });
});

// ── registration tracking ─────────────────────────────────────────────────────

describe('registration tracking', () => {
  let lean: LeanIndexClient;
  let facts: AgentFactsClient;
  let mgr: AgentIdentityManager;

  beforeEach(() => {
    lean = mockLeanIndexClient();
    facts = mockAgentFactsClient();
    mgr = AgentIdentityManager._build(makeOpts(), lean, facts);
  });

  it('starts unregistered', () => {
    expect(mgr.isFactsRegistered).toBe(false);
    expect(mgr.isIndexRegistered).toBe(false);
  });

  it('registerFactsOnly sets isFactsRegistered', async () => {
    await mgr.registerFactsOnly(makeFacts());
    expect(mgr.isFactsRegistered).toBe(true);
    expect(mgr.isIndexRegistered).toBe(false);
  });

  it('registerIndexOnly sets isIndexRegistered', async () => {
    await mgr.registerIndexOnly();
    expect(mgr.isFactsRegistered).toBe(false);
    expect(mgr.isIndexRegistered).toBe(true);
  });

  it('registerFactsAndIndex sets both flags', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    expect(mgr.isFactsRegistered).toBe(true);
    expect(mgr.isIndexRegistered).toBe(true);
  });

  it('invalidateFacts clears isFactsRegistered', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    await mgr.invalidateFacts();
    expect(mgr.isFactsRegistered).toBe(false);
    expect(mgr.isIndexRegistered).toBe(true);
  });

  it('deregister clears isIndexRegistered', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    await mgr.deregister();
    expect(mgr.isFactsRegistered).toBe(true);
    expect(mgr.isIndexRegistered).toBe(false);
  });

  it('updateFacts does not change registration flags', async () => {
    await mgr.registerFactsAndIndex(makeFacts());
    await mgr.updateFacts(makeFacts({ label: 'Updated' }));
    expect(mgr.isFactsRegistered).toBe(true);
    expect(mgr.isIndexRegistered).toBe(true);
  });
});

// ── static builders ───────────────────────────────────────────────────────────

describe('createWithoutRegistering', () => {
  it('creates an instance with a fresh keypair and no registration', () => {
    const m1 = AgentIdentityManager.createWithoutRegistering(makeOpts());
    const m2 = AgentIdentityManager.createWithoutRegistering(makeOpts());
    expect(m1.publicKey).not.toEqual(m2.publicKey);
    expect(m1.isFactsRegistered).toBe(false);
    expect(m1.isIndexRegistered).toBe(false);
  });
});
