import {
  AGENT_ID_PATTERN, MAX_AGENT_ID_LENGTH,
  URN_PATTERN, MAX_URN_LENGTH,
  HTTPS_URL_PATTERN, MAX_URL_LENGTH,
  BASE64URL_SIG_PATTERN,
  ISO8601_PATTERN,
} from '@nanda/shared';

// ── Reusable schema fragments ─────────────────────────────────────────────────

const AGENT_ID_SCHEMA = { type: 'string', pattern: AGENT_ID_PATTERN, maxLength: MAX_AGENT_ID_LENGTH } as const;
const SIG_SCHEMA      = { type: 'string', pattern: BASE64URL_SIG_PATTERN                           } as const;
const URL_SCHEMA      = { type: 'string', pattern: HTTPS_URL_PATTERN, maxLength: MAX_URL_LENGTH     } as const;
const DATE_SCHEMA     = { type: 'string', pattern: ISO8601_PATTERN                                  } as const;

// ── AgentFacts content schema (credentialSubject) ─────────────────────────────
// Validates the AgentFacts fields — no proof here; proof lives in the VC envelope.

export const agentFactsContentSchema = {
  type: 'object',
  required: [
    '@context', 'id', 'agentName', 'label', 'description',
    'version', 'provider', 'endpoints', 'capabilities', 'certification',
  ],
  additionalProperties: true, // AgentFacts has open-ended extension fields
  properties: {
    '@context': { type: 'array', items: { type: 'string' }, minItems: 1 },
    id:          AGENT_ID_SCHEMA,
    agentName:   { type: 'string', pattern: URN_PATTERN, maxLength: MAX_URN_LENGTH },
    label:       { type: 'string', maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    version:     { type: 'string', maxLength: 50 },
    jurisdiction: { type: 'string', maxLength: 100 },
    provider: {
      type: 'object',
      required: ['name', 'url'],
      properties: {
        name: { type: 'string', maxLength: 200 },
        url:  URL_SCHEMA,
        did:  AGENT_ID_SCHEMA,
      },
    },
    endpoints:    { type: 'object' },
    capabilities: { type: 'object' },
    skills:       { type: 'array' },
    evaluations:  { type: 'object' },
    telemetry:    { type: 'object' },
    certification: {
      type: 'object',
      required: ['level', 'issuer', 'issuanceDate', 'expirationDate', 'statusListUrl'],
      properties: {
        level:          { type: 'string', maxLength: 50 },
        issuer:         { type: 'string', maxLength: MAX_AGENT_ID_LENGTH },
        issuanceDate:   DATE_SCHEMA,
        expirationDate: DATE_SCHEMA,
        statusListUrl:  URL_SCHEMA,
      },
    },
  },
} as const;

// ── W3C VC v2 envelope schema ─────────────────────────────────────────────────

const dataIntegrityProofSchema = {
  type: 'object',
  required: ['type', 'cryptosuite', 'created', 'verificationMethod', 'proofPurpose', 'proofValue'],
  additionalProperties: false,
  properties: {
    type:               { type: 'string', const: 'DataIntegrityProof' },
    cryptosuite:        { type: 'string', const: 'eddsa-jcs-2022' },
    created:            DATE_SCHEMA,
    // DID URL with key fragment — slightly longer than MAX_AGENT_ID_LENGTH
    verificationMethod: { type: 'string', maxLength: MAX_AGENT_ID_LENGTH + 100 },
    proofPurpose:       { type: 'string', const: 'assertionMethod' },
    proofValue:         SIG_SCHEMA,
  },
} as const;

export const agentFactsVcSchema = {
  type: 'object',
  required: ['@context', 'type', 'issuer', 'validFrom', 'validUntil', 'credentialSubject', 'proof'],
  additionalProperties: false,
  properties: {
    '@context':        { type: 'array', items: { type: 'string' }, minItems: 1 },
    type:              { type: 'array', items: { type: 'string' }, minItems: 1 },
    issuer:            AGENT_ID_SCHEMA,
    validFrom:         DATE_SCHEMA,
    validUntil:        DATE_SCHEMA,
    credentialSubject: agentFactsContentSchema,
    proof:             dataIntegrityProofSchema,
  },
} as const;

// ── Invalidation attestation schema ───────────────────────────────────────────

export const invalidateFactsSchema = {
  type: 'object',
  required: ['agentId', 'action', 'issuedAt', 'signature'],
  additionalProperties: false,
  properties: {
    agentId:   AGENT_ID_SCHEMA,
    action:    { type: 'string', const: 'invalidate-facts' },
    issuedAt:  DATE_SCHEMA,
    signature: SIG_SCHEMA,
  },
} as const;
