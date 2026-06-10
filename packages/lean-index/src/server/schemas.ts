import {
  DID_PATTERN, MAX_DID_LENGTH,
  URN_PATTERN, MAX_URN_LENGTH,
  HTTPS_URL_PATTERN, MAX_URL_LENGTH,
  BASE64URL_SIG_PATTERN,
  ISO8601_PATTERN,
} from '@nanda/shared';

// Application-specific range constant (not shared)
const MAX_TTL_SECONDS = 2_592_000; // 30 days

// ── Reusable schema fragments ─────────────────────────────────────────────────

const DID_SCHEMA    = { type: 'string', pattern: DID_PATTERN,         maxLength: MAX_DID_LENGTH } as const;
const SIG_SCHEMA    = { type: 'string', pattern: BASE64URL_SIG_PATTERN                         } as const;
const URL_SCHEMA    = { type: 'string', pattern: HTTPS_URL_PATTERN,   maxLength: MAX_URL_LENGTH } as const;

// ── Schemas ───────────────────────────────────────────────────────────────────

export const agentAddrSchema = {
  type: 'object',
  required: ['agentId', 'agentName', 'primaryFactsUrl', 'ttl', 'signature'],
  additionalProperties: false,
  properties: {
    agentId:             DID_SCHEMA,
    agentName:           { type: 'string', pattern: URN_PATTERN, maxLength: MAX_URN_LENGTH },
    primaryFactsUrl:     URL_SCHEMA,
    privateFactsUrl:     URL_SCHEMA,
    adaptiveResolverUrl: URL_SCHEMA,
    ttl:                 { type: 'integer', minimum: 1, maximum: MAX_TTL_SECONDS },
    signature:           SIG_SCHEMA,
  },
} as const;

export const deleteAgentSchema = {
  type: 'object',
  required: ['agentId', 'action', 'issuedAt', 'signature'],
  additionalProperties: false,
  properties: {
    agentId:   DID_SCHEMA,
    action:    { type: 'string', const: 'delete-agent' },
    issuedAt:  { type: 'string', pattern: ISO8601_PATTERN },
    signature: SIG_SCHEMA,
  },
} as const;
