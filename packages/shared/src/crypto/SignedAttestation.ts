import type { AgentID } from '../identity/identifiers.js';
import type { Signature } from './Signature.js';

export interface SignedAttestation<TAction extends string> {
  agentId: AgentID;
  action: TAction;
  // ISO 8601 timestamp. Server rejects if outside a short validity window to
  // prevent replay attacks. Production should use a shorter window or a nonce.
  issuedAt: string;
  signature: Signature; // Ed25519 over canonical JSON of other fields, keys sorted
}
