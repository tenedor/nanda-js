// ── Pattern constants ─────────────────────────────────────────────────────────

const DID_PATTERN = '^did:[a-z][a-z0-9]*:.+$';
const URN_PATTERN = '^urn:[a-zA-Z][a-zA-Z0-9+\\-.]{0,31}:.+$';
const HTTPS_URL_PATTERN = '^https://';
// Ed25519 signature: 64 bytes → 86 base64url characters (no padding)
const BASE64URL_SIG_PATTERN = '^[A-Za-z0-9_-]{86}$';
const ISO8601_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$';

// ── Length / range constants ──────────────────────────────────────────────────

const MAX_DID_LENGTH = 500;
const MAX_URN_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_TTL_SECONDS = 2_592_000; // 30 days

// ── Schemas ───────────────────────────────────────────────────────────────────

export const agentAddrSchema = {
  type: 'object',
  required: ['agentId', 'agentName', 'primaryFactsUrl', 'ttl', 'signature'],
  additionalProperties: false,
  properties: {
    agentId:             { type: 'string', pattern: DID_PATTERN,        maxLength: MAX_DID_LENGTH },
    agentName:           { type: 'string', pattern: URN_PATTERN,        maxLength: MAX_URN_LENGTH },
    primaryFactsUrl:     { type: 'string', pattern: HTTPS_URL_PATTERN,  maxLength: MAX_URL_LENGTH },
    privateFactsUrl:     { type: 'string', pattern: HTTPS_URL_PATTERN,  maxLength: MAX_URL_LENGTH },
    adaptiveResolverUrl: { type: 'string', pattern: HTTPS_URL_PATTERN,  maxLength: MAX_URL_LENGTH },
    ttl:                 { type: 'integer', minimum: 1, maximum: MAX_TTL_SECONDS },
    signature:           { type: 'string', pattern: BASE64URL_SIG_PATTERN },
  },
} as const;

export const deleteAgentSchema = {
  type: 'object',
  required: ['agentId', 'action', 'issuedAt', 'signature'],
  additionalProperties: false,
  properties: {
    agentId:   { type: 'string', pattern: DID_PATTERN,           maxLength: MAX_DID_LENGTH },
    action:    { type: 'string', const: 'delete-agent' },
    issuedAt:  { type: 'string', pattern: ISO8601_PATTERN },
    signature: { type: 'string', pattern: BASE64URL_SIG_PATTERN },
  },
} as const;
