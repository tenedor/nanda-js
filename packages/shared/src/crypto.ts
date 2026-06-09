import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// @noble/ed25519 v2 requires a SHA-512 implementation to be set explicitly
ed.etc.sha512Sync = (...msgs) => sha512(ed.etc.concatBytes(...msgs));

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

// Returns the canonical JSON string of an object with the given field omitted and keys sorted.
// Used to produce a stable byte representation for signing.
export function canonicalize(obj: Record<string, unknown>, omitField: string): string {
  const copy = Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => k !== omitField)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return JSON.stringify(copy);
}

export function sign(privateKey: Uint8Array, payload: string): string {
  const bytes = new TextEncoder().encode(payload);
  const sig = ed.sign(bytes, privateKey);
  return bytesToBase64url(sig);
}

export function verify(publicKey: Uint8Array, payload: string, signature: string): boolean {
  try {
    const bytes = new TextEncoder().encode(payload);
    const sig = base64urlToBytes(signature);
    return ed.verify(sig, bytes, publicKey);
  } catch {
    return false;
  }
}

export function publicKeyToBase64url(publicKey: Uint8Array): string {
  return bytesToBase64url(publicKey);
}

export function base64urlToPublicKey(encoded: string): Uint8Array {
  return base64urlToBytes(encoded);
}

function bytesToBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64urlToBytes(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64url'));
}
