import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Http2SecureServer } from 'node:http2';
import { setGlobalDispatcher, Agent } from 'undici';
import { createDb } from './server/db.js';
import { configureApp, FASTIFY_BASE_OPTIONS, PROTOCOL_VERSION } from './server/app.js';

const PORT = parseInt(process.env.PORT ?? '8444', 10);
const DB_PATH = process.env.DB_PATH ?? '/data/agent-facts.db';
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

// Configure global fetch dispatcher to use HTTP/2 and trust the mkcert CA if provided.
const caCert = process.env.NODE_EXTRA_CA_CERTS ? readFileSync(process.env.NODE_EXTRA_CA_CERTS) : undefined;
setGlobalDispatcher(new Agent({
  allowH2: true,
  connect: caCert ? { ca: caCert } : { rejectUnauthorized: false },
}));

const db = await createDb(DB_PATH);

const app = Fastify<Http2SecureServer>({
  ...FASTIFY_BASE_OPTIONS,
  http2: true,
  https: {
    cert: readFileSync(TLS_CERT),
    key: readFileSync(TLS_KEY),
  },
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await configureApp(app, db);
await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info({ version: PROTOCOL_VERSION }, 'Agent facts server started');
