import * as ed from '@noble/ed25519';
import { base64urlToPublicKey } from './keys.js';

// Returns canonical JSON of an object with the given field omitted and keys sorted.
// Used to produce a stable byte representation for signing.
export function canonicalize(obj: Record<string, unknown>, omitField: string): string {
  const copy = Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => k !== omitField)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(copy);
}

export function sign(privateKey: Uint8Array, payload: string): string {
  const bytes = new TextEncoder().encode(payload);
  const sig = ed.sign(bytes, privateKey);
  return Buffer.from(sig).toString('base64url');
}

export function verify(publicKey: Uint8Array, payload: string, signature: string): boolean {
  try {
    const bytes = new TextEncoder().encode(payload);
    const sig = new Uint8Array(Buffer.from(signature, 'base64url'));
    return ed.verify(sig, bytes, publicKey);
  } catch {
    return false;
  }
}

export function verifyWithEncodedKey(
  encodedPublicKey: string,
  payload: string,
  signature: string,
): boolean {
  return verify(base64urlToPublicKey(encodedPublicKey), payload, signature);
}
