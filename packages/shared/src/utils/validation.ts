// ── String patterns ───────────────────────────────────────────────────────────

export const DID_PATTERN = '^did:[a-z][a-z0-9]*:.+$';
export const URN_PATTERN = '^urn:[a-zA-Z][a-zA-Z0-9+\\-.]{0,31}:.+$';
export const HTTPS_URL_PATTERN = '^https://';
// Ed25519 signature: 64 bytes → 86 base64url characters (no padding)
export const BASE64URL_SIG_PATTERN = '^[A-Za-z0-9_-]{86}$';
export const ISO8601_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$';

// ── Length constants ──────────────────────────────────────────────────────────

export const MAX_DID_LENGTH = 500;
export const MAX_URN_LENGTH = 500;
export const MAX_URL_LENGTH = 2048;
