import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Http2SecureServer } from 'node:http2';
import { AgentIdentityManager, FASTIFY_BASE_OPTIONS, configureApp } from '@nanda/agent';
import { generateKeyPair, publicKeyToBase64url } from '@nanda/shared';

const PORT = parseInt(process.env.PORT ?? '8445', 10);
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

const did = process.env.AGENT_DID;
const agentName = process.env.AGENT_NAME;
const leanIndexUrl = process.env.LEAN_INDEX_URL;
const primaryFactsServerUrl = process.env.PRIMARY_FACTS_SERVER_URL;

if (!did) throw new Error('AGENT_DID is required');
if (!agentName) throw new Error('AGENT_NAME is required');
if (!leanIndexUrl) throw new Error('LEAN_INDEX_URL is required');
if (!primaryFactsServerUrl) throw new Error('PRIMARY_FACTS_SERVER_URL is required');

const keyPair = generateKeyPair();

const manager = new AgentIdentityManager({
  did,
  keyPair,
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
