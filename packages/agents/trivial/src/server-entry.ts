import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Http2SecureServer } from 'node:http2';
import { setGlobalDispatcher, Agent } from 'undici';
import { AgentIdentityManager, FASTIFY_BASE_OPTIONS, configureApp, PROTOCOL_VERSION } from '@nanda/agent';
import { buildAgentFacts } from '@nanda/agent-facts';
import { publicKeyToBase64url } from '@nanda/shared';

const PORT = parseInt(process.env.PORT ?? '8445', 10);
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

// Configure global fetch dispatcher to use HTTP/2 and trust the mkcert CA if provided.
const caCert = process.env.NODE_EXTRA_CA_CERTS ? readFileSync(process.env.NODE_EXTRA_CA_CERTS) : undefined;
setGlobalDispatcher(new Agent({
  allowH2: true,
  connect: caCert ? { ca: caCert } : { rejectUnauthorized: false },
}));

const did = process.env.AGENT_DID;
const agentName = process.env.AGENT_NAME;
const leanIndexUrl = process.env.LEAN_INDEX_URL;
const primaryFactsServerUrl = process.env.PRIMARY_FACTS_SERVER_URL;
const providerName = process.env.PROVIDER_NAME ?? 'NANDA Prototype';
const providerUrl = process.env.PROVIDER_URL ?? 'https://nanda.example';
const agentLabel = process.env.AGENT_LABEL ?? 'Trivial Agent';
const agentDescription = process.env.AGENT_DESCRIPTION ?? 'A trivial NANDA agent';
const agentEndpoint = process.env.AGENT_ENDPOINT;

if (!did) throw new Error('AGENT_DID is required');
if (!agentName) throw new Error('AGENT_NAME is required');
if (!leanIndexUrl) throw new Error('LEAN_INDEX_URL is required');
if (!primaryFactsServerUrl) throw new Error('PRIMARY_FACTS_SERVER_URL is required');
if (!agentEndpoint) throw new Error('AGENT_ENDPOINT is required');

const facts = buildAgentFacts({
  id: did,
  agentName,
  label: agentLabel,
  description: agentDescription,
  version: PROTOCOL_VERSION,
  providerName,
  providerUrl,
  endpoints: [agentEndpoint],
});

const manager = AgentIdentityManager.createWithoutRegistering({
  did,
  agentName,
  leanIndexUrl,
  primaryFactsServerUrl,
  privateFactsServerUrl: process.env.PRIVATE_FACTS_SERVER_URL,
  adaptiveResolverUrl: process.env.ADAPTIVE_RESOLVER_URL,
  ttl: parseInt(process.env.AGENT_TTL ?? '3600', 10),
});

const app = Fastify<Http2SecureServer>({
  ...FASTIFY_BASE_OPTIONS,
  http2: true,
  https: {
    cert: readFileSync(TLS_CERT),
    key: readFileSync(TLS_KEY),
  },
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await configureApp(app, manager, async (a) => {
  a.get('/name', async () => ({ agentName: manager.agentName }));
});

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(
  { did: manager.did, publicKey: publicKeyToBase64url(manager.publicKey) },
  'Trivial agent started',
);

// Register only after the server is listening: the agent-facts server resolves
// this agent's DID during VC verification, which requires /.well-known/did.json
// to be reachable at the DID endpoint before registration is attempted.
await manager.registerFactsAndIndex(facts);
app.log.info({ did: manager.did }, 'Trivial agent registered');
