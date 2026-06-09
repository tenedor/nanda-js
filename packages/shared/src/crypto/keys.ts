import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

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

export function publicKeyToBase64url(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString('base64url');
}

export function base64urlToPublicKey(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64url'));
}
