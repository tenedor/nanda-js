import { describe, it, expect, vi } from 'vitest';
import { verifyAgentAddrSignature, verifyAttestation, ValidationError } from '../src/server/validation.js';
import { generateKeyPair, sign, canonicalize, publicKeyToBase64url } from '@nanda/shared';
import type { AgentAddr } from '../src/AgentAddr.js';
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

function signRecord(record: Omit<AgentAddr, 'signature'>, privateKey: Uint8Array): AgentAddr {
  const payload = canonicalize(record as Record<string, unknown>, 'signature');
  return { ...record, signature: sign(privateKey, payload) };
}

const baseRecord: Omit<AgentAddr, 'signature'> = {
  agentId: 'did:web:agent.example.com',
  agentName: 'urn:agent:example:test',
  primaryFactsUrl: 'https://agent.example.com/.well-known/agent-facts',
  ttl: 3600,
};

describe('verifyAgentAddrSignature', () => {
  it('accepts a valid signature', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const record = signRecord(baseRecord, privateKey);
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(record.agentId, publicKey));
    await expect(verifyAgentAddrSignature(record, resolve)).resolves.toBeUndefined();
  });

  it('rejects a tampered record', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const record = signRecord(baseRecord, privateKey);
    const tampered = { ...record, ttl: 9999 };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(record.agentId, publicKey));
    await expect(verifyAgentAddrSignature(tampered, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when DID resolution fails', async () => {
    const { privateKey } = generateKeyPair();
    const record = signRecord(baseRecord, privateKey);
    const resolve = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(verifyAgentAddrSignature(record, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('verifyAttestation', () => {
  it('accepts a valid attestation within the time window', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'delete-agent' as const, issuedAt: new Date().toISOString() };
    const payload = canonicalize(base as Record<string, unknown>, 'signature');
    const attestation = { ...base, signature: sign(privateKey, payload) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'delete-agent', did, resolve))
      .resolves.toBeUndefined();
  });

  it('rejects an expired attestation', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'delete-agent' as const, issuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
    const payload = canonicalize(base as Record<string, unknown>, 'signature');
    const attestation = { ...base, signature: sign(privateKey, payload) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'delete-agent', did, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects wrong action', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'delete-agent' as const, issuedAt: new Date().toISOString() };
    const payload = canonicalize(base as Record<string, unknown>, 'signature');
    const attestation = { ...base, signature: sign(privateKey, payload) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'invalidate-facts' as never, did, resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects agentId mismatch', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const did = 'did:web:agent.example.com';
    const base = { agentId: did, action: 'delete-agent' as const, issuedAt: new Date().toISOString() };
    const payload = canonicalize(base as Record<string, unknown>, 'signature');
    const attestation = { ...base, signature: sign(privateKey, payload) };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(did, publicKey));
    await expect(verifyAttestation(attestation, 'delete-agent', 'did:web:other.example.com', resolve))
      .rejects.toBeInstanceOf(ValidationError);
  });
});
