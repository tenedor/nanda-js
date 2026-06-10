import { describe, it, expect, vi } from 'vitest';
import { issueCredential, verifyCredential } from '../src/identity/vc.js';
import { generateKeyPair, publicKeyToBase64url } from '../src/crypto/keys.js';
import { ValidationError } from '../src/utils/errors.js';
import type { DIDDocument } from '../src/identity/DIDDocument.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DID = 'did:web:issuer.example.com';
const VM_ID = `${DID}#key-1`;

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

type Subject = { id: string; name: string };

function makeVc(privateKey: Uint8Array, overrides: Partial<Subject> = {}) {
  return issueCredential<Subject>(
    { id: DID, name: 'Test Agent', ...overrides },
    {
      issuerDid: DID,
      verificationMethodId: VM_ID,
      privateKey,
      validFrom: '2025-01-01T00:00:00Z',
      validUntil: '2099-01-01T00:00:00Z',
    },
  );
}

// ── issueCredential ───────────────────────────────────────────────────────────

describe('issueCredential', () => {
  it('produces a VC with the correct envelope structure', () => {
    const { privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    expect(vc['@context']).toContain('https://www.w3.org/ns/credentials/v2');
    expect(vc.type).toContain('VerifiableCredential');
    expect(vc.issuer).toBe(DID);
    expect(vc.validFrom).toBe('2025-01-01T00:00:00Z');
    expect(vc.validUntil).toBe('2099-01-01T00:00:00Z');
    expect(vc.credentialSubject).toEqual({ id: DID, name: 'Test Agent' });
  });

  it('produces a DataIntegrityProof with the correct metadata', () => {
    const { privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    expect(vc.proof.type).toBe('DataIntegrityProof');
    expect(vc.proof.cryptosuite).toBe('eddsa-jcs-2022');
    expect(vc.proof.verificationMethod).toBe(VM_ID);
    expect(vc.proof.proofPurpose).toBe('assertionMethod');
    expect(vc.proof.proofValue).toMatch(/^[A-Za-z0-9_-]{86}$/);
  });

  it('omits validUntil when not provided', () => {
    const { privateKey } = generateKeyPair();
    const vc = issueCredential({ id: DID }, { issuerDid: DID, verificationMethodId: VM_ID, privateKey });
    expect('validUntil' in vc).toBe(false);
  });
});

// ── verifyCredential ──────────────────────────────────────────────────────────

describe('verifyCredential', () => {
  it('accepts a freshly issued credential', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(vc, resolve)).resolves.toBeUndefined();
  });

  it('rejects when the credentialSubject has been tampered with', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    const tampered = { ...vc, credentialSubject: { ...vc.credentialSubject, name: 'Tampered' } };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(tampered, resolve)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when a top-level envelope field has been tampered with', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    const tampered = { ...vc, issuer: 'did:web:attacker.example.com' };
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(tampered, resolve)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects an expired credential', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = issueCredential(
      { id: DID },
      { issuerDid: DID, verificationMethodId: VM_ID, privateKey, validUntil: '2000-01-01T00:00:00Z' },
    );
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(vc, resolve)).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts a credential with no validUntil', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = issueCredential({ id: DID }, { issuerDid: DID, verificationMethodId: VM_ID, privateKey });
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(vc, resolve)).resolves.toBeUndefined();
  });

  it('rejects when the DID cannot be resolved', async () => {
    const { privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    const resolve = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(verifyCredential(vc, resolve)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when the verificationMethod is not in the DID document', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const vc = makeVc(privateKey);
    const docWithDifferentKeyId = {
      ...makeDIDDoc(DID, publicKey),
      verificationMethod: [{ id: `${DID}#other-key`, type: 'Ed25519VerificationKey2020', controller: DID, publicKeyMultibase: 'u' + publicKeyToBase64url(publicKey) }],
    };
    const resolve = vi.fn().mockResolvedValue(docWithDifferentKeyId);
    await expect(verifyCredential(vc, resolve)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── canonicalize stability ────────────────────────────────────────────────────

describe('issue + verify round-trip with nested subject', () => {
  it('verifies a VC whose subject has nested objects with arbitrary key order', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const subject = { id: DID, z: 'last', a: 'first', nested: { beta: 2, alpha: 1 } };
    const vc = issueCredential(subject, { issuerDid: DID, verificationMethodId: VM_ID, privateKey });
    const resolve = vi.fn().mockResolvedValue(makeDIDDoc(DID, publicKey));
    await expect(verifyCredential(vc, resolve)).resolves.toBeUndefined();
  });
});
