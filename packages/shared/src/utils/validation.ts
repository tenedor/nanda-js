// ── String patterns ───────────────────────────────────────────────────────────

// Warning: These patterns are overapproximations of the valid values. They may
// allow some invalid values.

export const DID_PATTERN = '^did:[a-z][a-z0-9]*:.+$';
export const URN_PATTERN = '^urn:[a-zA-Z][a-zA-Z0-9+\\-.]{0,31}:.+$';

// The paper defines agent IDs as any URI-like scheme:value identifier —
// NANDA-native IDs (nanda:<uuid>), DIDs, and other registered schemes are all valid.
// Uncomment this general pattern when the prototype is extended beyond DID-only agents:
// export const AGENT_ID_PATTERN = '^[a-zA-Z][a-zA-Z0-9+\\-.]*:.+$';

// Current constraint: agent IDs are restricted to DID-based identifiers, since the
// current implementation uses did:web for key material and DID document resolution.
export const AGENT_ID_PATTERN = DID_PATTERN;

export const HTTPS_URL_PATTERN = '^https://';
// Ed25519 signature: 64 bytes → 86 base64url characters (no padding)
export const BASE64URL_SIG_PATTERN = '^[A-Za-z0-9_-]{86}$';
export const ISO8601_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$';

// ── Length constants ──────────────────────────────────────────────────────────

export const MAX_AGENT_ID_LENGTH = 500;
export const MAX_URN_LENGTH = 500;
export const MAX_URL_LENGTH = 2048;
