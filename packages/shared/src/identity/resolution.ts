import type { DIDDocument, DIDVerificationMethod } from './DIDDocument.js';
import { fetchJson } from '../network/index.js';
import { base64urlToPublicKey } from '../crypto/keys.js';

// Converts a did:web DID to the HTTPS URL of its DID document.
// did:web:example.com          → https://example.com/.well-known/did.json
// did:web:example.com:path:sub → https://example.com/path/sub/did.json
export function didWebToUrl(did: string): string {
  if (!did.startsWith('did:web:')) {
    throw new Error(`Not a did:web DID: ${did}`);
  }
  const rest = did.slice('did:web:'.length);
  const [host, ...pathParts] = rest.split(':');
  const decodedHost = decodeURIComponent(host);
  if (pathParts.length === 0) {
    return `https://${decodedHost}/.well-known/did.json`;
  }
  return `https://${decodedHost}/${pathParts.map(decodeURIComponent).join('/')}/did.json`;
}

export async function resolveDid(did: string): Promise<DIDDocument> {
  const url = didWebToUrl(did);
  return fetchJson<DIDDocument>(url);
}

// Extracts the Ed25519 public key from a DID document.
// Prefers assertionMethod (used for signing VCs), falls back to authentication.
export function extractPublicKey(didDoc: DIDDocument): Uint8Array {
  const methods = didDoc.verificationMethod ?? [];

  const findInList = (
    list: (string | DIDVerificationMethod)[] | undefined,
  ): DIDVerificationMethod | undefined => {
    for (const entry of list ?? []) {
      if (typeof entry === 'string') {
        return methods.find((m) => m.id === entry);
      }
      return entry;
    }
  };

  const method = findInList(didDoc.assertionMethod) ?? findInList(didDoc.authentication);
  if (!method) {
    throw new Error(`No usable verification method found in DID document for ${didDoc.id}`);
  }
  if (!method.publicKeyMultibase) {
    throw new Error(`Verification method ${method.id} has no publicKeyMultibase`);
  }

  // publicKeyMultibase uses 'u' prefix for base64url in this prototype
  const encoded = method.publicKeyMultibase;
  if (encoded[0] !== 'u') {
    throw new Error(
      `Unsupported multibase prefix '${encoded[0]}' in ${method.id}; expected 'u' (base64url)`,
    );
  }
  return base64urlToPublicKey(encoded.slice(1));
}
