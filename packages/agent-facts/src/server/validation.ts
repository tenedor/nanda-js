import {
  verifyCredential, resolveDid,
  type VerifiableCredential, type AgentID, type DIDDocument,
  type SignedAttestation,
  canonicalize, verify, extractPublicKey,
  ValidationError,
} from '@nanda/shared';
import type { AgentFacts } from '../AgentFacts.js';

type ResolveDid = (did: string) => Promise<DIDDocument>;

// Production should use a shorter window or a nonce.
const ATTESTATION_VALIDITY_MS = 5 * 60_000;

export async function verifyAgentFactsVc(
  vc: VerifiableCredential<AgentFacts>,
  resolve: ResolveDid = resolveDid,
): Promise<void> {
  await verifyCredential(vc, resolve);
}

async function resolvePublicKey(did: AgentID, resolve: ResolveDid): Promise<Uint8Array> {
  let doc: DIDDocument;
  try {
    doc = await resolve(did);
  } catch {
    throw new ValidationError(`Could not resolve DID: ${did}`, 400);
  }
  try {
    return extractPublicKey(doc);
  } catch (e) {
    throw new ValidationError(
      `Invalid DID document for ${did}: ${(e as Error).message}`, 400,
    );
  }
}

export async function verifyAttestation<TAction extends string>(
  attestation: SignedAttestation<TAction>,
  expectedAction: TAction,
  expectedAgentId: AgentID,
  resolve: ResolveDid = resolveDid,
): Promise<void> {
  if (attestation.agentId !== expectedAgentId) {
    throw new ValidationError(
      `Attestation agentId mismatch: expected ${expectedAgentId}`, 400,
    );
  }
  if (attestation.action !== expectedAction) {
    throw new ValidationError(
      `Attestation action mismatch: expected ${expectedAction}`, 400,
    );
  }

  const issuedAt = new Date(attestation.issuedAt).getTime();
  if (isNaN(issuedAt)) {
    throw new ValidationError(
      'Attestation issuedAt is not a valid ISO 8601 timestamp', 400,
    );
  }
  if (Math.abs(Date.now() - issuedAt) > ATTESTATION_VALIDITY_MS) {
    throw new ValidationError(
      'Attestation timestamp is outside the validity window', 401,
    );
  }

  const publicKey = await resolvePublicKey(attestation.agentId, resolve);
  const payload = canonicalize(
    attestation as unknown as Record<string, unknown>, 'signature',
  );
  if (!verify(publicKey, payload, attestation.signature)) {
    throw new ValidationError('Invalid attestation signature', 401);
  }
}
