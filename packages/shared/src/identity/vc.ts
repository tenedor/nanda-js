import { canonicalize, sign, verify } from '../crypto/signing.js';
import { base64urlToPublicKey } from '../crypto/keys.js';
import { resolveDid as defaultResolveDid } from './resolution.js';
import type { DIDDocument, DIDVerificationMethod } from './DIDDocument.js';
import { ValidationError } from '../utils/errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: 'eddsa-jcs-2022';
  created: string;            // ISO 8601
  verificationMethod: string; // DID URL, e.g. did:web:example.com#key-1
  proofPurpose: 'assertionMethod';
  proofValue: string;         // base64url Ed25519 signature
}

export interface VerifiableCredential<T> {
  '@context': string[];
  type: ['VerifiableCredential', ...string[]];
  issuer: string;       // issuer DID
  validFrom: string;    // ISO 8601
  validUntil?: string;  // ISO 8601 — if absent, credential does not expire
  credentialSubject: T;
  proof: DataIntegrityProof;
}

// ── Issuance ──────────────────────────────────────────────────────────────────

export interface IssueCredentialOptions {
  issuerDid: string;
  verificationMethodId: string; // full DID URL including key fragment
  privateKey: Uint8Array;
  validFrom?: string;   // defaults to now
  validUntil?: string;
  additionalTypes?: string[];
  additionalContexts?: string[];
}

export function issueCredential<T extends object>(
  subject: T,
  options: IssueCredentialOptions,
): VerifiableCredential<T> {
  const {
    issuerDid, verificationMethodId, privateKey,
    validFrom = new Date().toISOString(),
    validUntil,
    additionalTypes = [],
    additionalContexts = [],
  } = options;

  const envelope: Omit<VerifiableCredential<T>, 'proof'> = {
    '@context': ['https://www.w3.org/ns/credentials/v2', ...additionalContexts],
    type: ['VerifiableCredential', ...additionalTypes],
    issuer: issuerDid,
    validFrom,
    ...(validUntil !== undefined && { validUntil }),
    credentialSubject: subject,
  };

  // Sign the envelope (no proof field present yet) using JCS.
  const payload = canonicalize(envelope as Record<string, unknown>);
  const proofValue = sign(privateKey, payload);

  return {
    ...envelope,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      created: new Date().toISOString(),
      verificationMethod: verificationMethodId,
      proofPurpose: 'assertionMethod',
      proofValue,
    },
  };
}

// ── Verification ──────────────────────────────────────────────────────────────

type ResolveDid = (did: string) => Promise<DIDDocument>;

function findVerificationMethod(
  doc: DIDDocument,
  vmId: string,
): DIDVerificationMethod | undefined {
  return (doc.verificationMethod ?? []).find((m) => m.id === vmId);
}

function publicKeyFromMethod(method: DIDVerificationMethod): Uint8Array {
  if (!method.publicKeyMultibase) {
    throw new Error(`Verification method ${method.id} has no publicKeyMultibase`);
  }
  if (method.publicKeyMultibase[0] !== 'u') {
    throw new Error(
      `Unsupported multibase prefix '${method.publicKeyMultibase[0]}' in ${method.id}; expected 'u' (base64url)`,
    );
  }
  return base64urlToPublicKey(method.publicKeyMultibase.slice(1));
}

export async function verifyCredential<T>(
  vc: VerifiableCredential<T>,
  resolve: ResolveDid = defaultResolveDid,
): Promise<void> {
  if (vc.validUntil !== undefined && vc.validUntil < new Date().toISOString()) {
    throw new ValidationError('Credential has expired', 400);
  }

  const { proof } = vc;
  if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') {
    throw new ValidationError(
      `Unsupported proof: ${proof.type}/${proof.cryptosuite}`, 400,
    );
  }

  const did = proof.verificationMethod.split('#')[0];
  if (!did) {
    throw new ValidationError('Invalid verificationMethod in proof', 400);
  }

  let doc: DIDDocument;
  try {
    doc = await resolve(did);
  } catch {
    throw new ValidationError(`Could not resolve DID: ${did}`, 400);
  }

  const method = findVerificationMethod(doc, proof.verificationMethod);
  if (!method) {
    throw new ValidationError(
      `Verification method not found: ${proof.verificationMethod}`, 400,
    );
  }

  let publicKey: Uint8Array;
  try {
    publicKey = publicKeyFromMethod(method);
  } catch (e) {
    throw new ValidationError(`Invalid verification method: ${(e as Error).message}`, 400);
  }

  // Verify against the VC content minus the proof — matches what issueCredential signed.
  const payload = canonicalize(vc as unknown as Record<string, unknown>, 'proof');
  if (!verify(publicKey, payload, proof.proofValue)) {
    throw new ValidationError('Invalid credential proof', 401);
  }
}
