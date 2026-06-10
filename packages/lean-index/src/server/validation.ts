import {
  canonicalize, verify,
  extractPublicKey, resolveDid,
  type SignedAttestation,
} from '@nanda/shared';
import type { AgentAddr } from '../AgentAddr.js';
import type { AgentID } from '@nanda/shared';
import type { DIDDocument } from '@nanda/shared';

type ResolveDid = (did: string) => Promise<DIDDocument>;

// Production should use a shorter window or a nonce.
const ATTESTATION_VALIDITY_MS = 5 * 60_000;

export class ValidationError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
  }
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
    throw new ValidationError(`Invalid DID document for ${did}: ${(e as Error).message}`, 400);
  }
}

export async function verifyAgentAddrSignature(
  record: AgentAddr,
  resolve: ResolveDid = resolveDid,
): Promise<void> {
  const publicKey = await resolvePublicKey(record.agentId, resolve);
  const payload = canonicalize(record as unknown as Record<string, unknown>, 'signature');
  if (!verify(publicKey, payload, record.signature)) {
    throw new ValidationError('Invalid AgentAddr signature', 401);
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
    throw new ValidationError('Attestation issuedAt is not a valid ISO 8601 timestamp', 400);
  }
  const age = Math.abs(Date.now() - issuedAt);
  if (age > ATTESTATION_VALIDITY_MS) {
    throw new ValidationError('Attestation timestamp is outside the validity window', 401);
  }

  const publicKey = await resolvePublicKey(attestation.agentId, resolve);
  const payload = canonicalize(
    attestation as unknown as Record<string, unknown>, 'signature',
  );
  if (!verify(publicKey, payload, attestation.signature)) {
    throw new ValidationError('Invalid attestation signature', 401);
  }
}
