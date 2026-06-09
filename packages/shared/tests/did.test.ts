import { describe, it, expect, vi, beforeEach } from 'vitest';
import { didWebToUrl, extractPublicKey, resolveDid } from '../src/identity/resolution.js';
import { generateKeyPair, publicKeyToBase64url } from '../src/crypto/index.js';
import type { DIDDocument } from '../src/identity/DIDDocument.js';

describe('didWebToUrl', () => {
  it('converts a root domain DID to .well-known path', () => {
    expect(didWebToUrl('did:web:example.com')).toBe(
      'https://example.com/.well-known/did.json',
    );
  });

  it('converts a DID with path segments', () => {
    expect(didWebToUrl('did:web:example.com:agents:translator')).toBe(
      'https://example.com/agents/translator/did.json',
    );
  });

  it('throws on non-did:web input', () => {
    expect(() => didWebToUrl('did:key:abc')).toThrow('Not a did:web DID');
  });
});

describe('extractPublicKey', () => {
  it('extracts key from assertionMethod', () => {
    const { publicKey } = generateKeyPair();
    const encoded = 'u' + publicKeyToBase64url(publicKey);
    const doc: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:web:example.com',
      verificationMethod: [
        { id: 'did:web:example.com#key-1', type: 'Ed25519VerificationKey2020',
          controller: 'did:web:example.com', publicKeyMultibase: encoded },
      ],
      assertionMethod: ['did:web:example.com#key-1'],
    };
    expect(extractPublicKey(doc)).toEqual(publicKey);
  });

  it('falls back to authentication if assertionMethod absent', () => {
    const { publicKey } = generateKeyPair();
    const encoded = 'u' + publicKeyToBase64url(publicKey);
    const doc: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:web:example.com',
      verificationMethod: [
        { id: 'did:web:example.com#key-1', type: 'Ed25519VerificationKey2020',
          controller: 'did:web:example.com', publicKeyMultibase: encoded },
      ],
      authentication: ['did:web:example.com#key-1'],
    };
    expect(extractPublicKey(doc)).toEqual(publicKey);
  });

  it('throws when no verification method is found', () => {
    const doc: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:web:example.com',
    };
    expect(() => extractPublicKey(doc)).toThrow('No usable verification method');
  });

  it('throws on unsupported multibase prefix', () => {
    const doc: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:web:example.com',
      verificationMethod: [
        { id: 'did:web:example.com#key-1', type: 'Ed25519VerificationKey2020',
          controller: 'did:web:example.com', publicKeyMultibase: 'zBase58Key' },
      ],
      assertionMethod: ['did:web:example.com#key-1'],
    };
    expect(() => extractPublicKey(doc)).toThrow("Unsupported multibase prefix 'z'");
  });
});

describe('resolveDid', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('fetches the DID document from the correct URL', async () => {
    const { publicKey } = generateKeyPair();
    const doc: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: 'did:web:example.com',
      verificationMethod: [
        { id: 'did:web:example.com#key-1', type: 'Ed25519VerificationKey2020',
          controller: 'did:web:example.com',
          publicKeyMultibase: 'u' + publicKeyToBase64url(publicKey) },
      ],
      assertionMethod: ['did:web:example.com#key-1'],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(doc),
    }));

    const result = await resolveDid('did:web:example.com');
    expect(result).toEqual(doc);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/.well-known/did.json',
      expect.objectContaining({}),
    );
  });
});
