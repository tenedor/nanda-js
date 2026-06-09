import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  sign,
  verify,
  canonicalize,
  publicKeyToBase64url,
  base64urlToPublicKey,
} from '../src/crypto/index.js';

describe('generateKeyPair', () => {
  it('produces a 32-byte private key and 32-byte public key', () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(privateKey).toHaveLength(32);
    expect(publicKey).toHaveLength(32);
  });

  it('produces unique keypairs', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    expect(a.privateKey).not.toEqual(b.privateKey);
  });
});

describe('sign / verify', () => {
  it('verifies a valid signature', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const payload = 'hello world';
    const sig = sign(privateKey, payload);
    expect(verify(publicKey, payload, sig)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const sig = sign(privateKey, 'original');
    expect(verify(publicKey, 'tampered', sig)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const { privateKey } = generateKeyPair();
    const { publicKey: otherPublicKey } = generateKeyPair();
    const sig = sign(privateKey, 'hello');
    expect(verify(otherPublicKey, 'hello', sig)).toBe(false);
  });

  it('rejects a malformed signature', () => {
    const { publicKey } = generateKeyPair();
    expect(verify(publicKey, 'hello', 'not-a-valid-sig')).toBe(false);
  });
});

describe('canonicalize', () => {
  it('omits the specified field', () => {
    const obj = { a: 1, signature: 'sig', b: 2 };
    const result = canonicalize(obj as Record<string, unknown>, 'signature');
    expect(result).not.toContain('signature');
  });

  it('sorts keys alphabetically', () => {
    const obj = { z: 1, a: 2, m: 3 };
    const result = canonicalize(obj as Record<string, unknown>, '');
    expect(Object.keys(JSON.parse(result))).toEqual(['a', 'm', 'z']);
  });

  it('produces identical output for same content regardless of insertion order', () => {
    const a = canonicalize({ b: 2, a: 1 } as Record<string, unknown>, '');
    const b = canonicalize({ a: 1, b: 2 } as Record<string, unknown>, '');
    expect(a).toBe(b);
  });
});

describe('publicKeyToBase64url / base64urlToPublicKey', () => {
  it('round-trips a public key', () => {
    const { publicKey } = generateKeyPair();
    const encoded = publicKeyToBase64url(publicKey);
    const decoded = base64urlToPublicKey(encoded);
    expect(decoded).toEqual(publicKey);
  });
});
