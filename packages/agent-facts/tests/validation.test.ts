import { describe, it, expect, vi } from 'vitest';
import { verifyAgentFactsProof, verifyAttestation } from '../src/server/validation.js';
import {
  generateKeyPair, sign, canonicalize, publicKeyToBase64url,
  ValidationError,
} from '@nanda/shared';
import type { AgentFacts } from '../src/AgentFacts.js';
import type { DIDDocument } from '@nanda/shared';

function makeDIDDoc(did: string, publicKey: Uint8Array): DIDDocument {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: did,
      publicKeyMultibase: 'u' + publicKeyToBase64url(publicKey),
    }],
    assertionMethod: [`${did}#key-1`],
  };
}

function makeFacts(id: string): Omit<AgentFacts, 'proof'> {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id,
    agentName: 'urn:agent:example:test',
    label: 'Test',
    description: 'Test agent',
    version: '1.0.0',
    provider: { name: 'Example', url: 'https://example.com' },
    endpoints: {},
    capabilities: {},
    certification: {
      level: 'verified',
      issuer: id,
      issuanceDate: '2025-01-01T00:00:00Z',
      expirationDate: '2099-01-01T00:00:00Z',
      statusListUrl: 'https://example.com/status',
    },
  };
}

function signFacts(base: Omit<AgentFacts, 'proof'>, privateKey: Uint8Array): AgentFacts {
  const payload = canonicalize(base as Record<string, unknown>, 'proof');
  return { ...base, proof: sign(privateKey, payload) };
}

describe('verifyAgentFactsProof', () => {
  it('accepts a valid proof', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const facts = signFacts(makeFacts(did), privateKey);
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAgentFactsProof(facts, resolve)).resolves.toBeUndefined();
  });

  it('rejects a tampered facts document', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const facts = signFacts(makeFacts(did), privateKey);
    const tampered = { ...facts, label: 'Tampered' };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAgentFactsProof(tampered, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when DID resolution fails', async () => {
    const { privateKey } = generateKeyPair();
    const facts = signFacts(makeFacts('did:web:agent.example.com'), privateKey);
    const resolve = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(verifyAgentFactsProof(facts, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('verifyAttestation', () => {
  it('accepts a valid attestation within the time window', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'invalidate-facts' as const, issuedAt: new Date().toISOString() };
    const attestation = { ...base, signature: sign(privateKey, canonicalize(base as Record<string, unknown>, 'signature')) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'invalidate-facts', did, resolve))
      .resolves.toBeUndefined();
  });

  it('rejects an expired attestation', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'invalidate-facts' as const, issuedAt: new Date(Date.now() - 10 * 60_000).toISOString() };
    const attestation = { ...base, signature: sign(privateKey, canonicalize(base as Record<string, unknown>, 'signature')) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'invalidate-facts', did, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a wrong action', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'invalidate-facts' as const, issuedAt: new Date().toISOString() };
    const attestation = { ...base, signature: sign(privateKey, canonicalize(base as Record<string, unknown>, 'signature')) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'delete-agent' as never, did, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });
});
