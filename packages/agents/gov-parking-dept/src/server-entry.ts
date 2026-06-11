import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Http2SecureServer } from 'node:http2';
import { setGlobalDispatcher, Agent } from 'undici';
import { AgentIdentityManager, FASTIFY_BASE_OPTIONS, configureApp, PROTOCOL_VERSION } from '@nanda/agent';
import { buildAgentFacts } from '@nanda/agent-facts';
import { publicKeyToBase64url } from '@nanda/shared';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env.PORT ?? '8467', 10);
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

const caCert = process.env.NODE_EXTRA_CA_CERTS ? readFileSync(process.env.NODE_EXTRA_CA_CERTS) : undefined;
setGlobalDispatcher(new Agent({
  allowH2: true,
  connect: caCert ? { ca: caCert } : { rejectUnauthorized: false },
}));

const did = process.env.AGENT_DID;
const agentName = process.env.AGENT_NAME;
const leanIndexUrl = process.env.LEAN_INDEX_URL;
const primaryFactsServerUrl = process.env.PRIMARY_FACTS_SERVER_URL;
const agentEndpoint = process.env.AGENT_ENDPOINT;
const businessLicensingDid = process.env.BUSINESS_LICENSING_DID;
const foodTruckVendorDid = process.env.FOOD_TRUCK_VENDOR_DID;

if (!did) throw new Error('AGENT_DID is required');
if (!agentName) throw new Error('AGENT_NAME is required');
if (!leanIndexUrl) throw new Error('LEAN_INDEX_URL is required');
if (!primaryFactsServerUrl) throw new Error('PRIMARY_FACTS_SERVER_URL is required');
if (!agentEndpoint) throw new Error('AGENT_ENDPOINT is required');
if (!businessLicensingDid) throw new Error('BUSINESS_LICENSING_DID is required');
if (!foodTruckVendorDid) throw new Error('FOOD_TRUCK_VENDOR_DID is required');

const facts = buildAgentFacts({
  id: did,
  agentName,
  label: 'Government Parking Department',
  description: 'Issues street vending permits for licensed food truck operators.',
  version: PROTOCOL_VERSION,
  providerName: 'City Government',
  providerUrl: agentEndpoint,
  endpoints: [agentEndpoint],
});

const manager = AgentIdentityManager.createWithoutRegistering({ did, agentName, leanIndexUrl, primaryFactsServerUrl });

const app = Fastify<Http2SecureServer>({
  ...FASTIFY_BASE_OPTIONS,
  http2: true,
  https: { cert: readFileSync(TLS_CERT), key: readFileSync(TLS_KEY) },
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await configureApp(app, manager, async (a) => {
  await a.register(registerRoutes, { manager, businessLicensingDid, foodTruckVendorDid });
});

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info({ did: manager.did, publicKey: publicKeyToBase64url(manager.publicKey) }, 'gov-parking-dept started');

await manager.registerFactsAndIndex(facts);
app.log.info({ did: manager.did }, 'gov-parking-dept registered');
