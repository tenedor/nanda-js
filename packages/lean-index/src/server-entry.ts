import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { Http2SecureServer } from 'node:http2';
import { createDb } from './server/db.js';
import { configureApp, FASTIFY_BASE_OPTIONS, PROTOCOL_VERSION } from './server/app.js';

const PORT = parseInt(process.env.PORT ?? '8443', 10);
const DB_PATH = process.env.DB_PATH ?? '/data/lean-index.db';
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

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
app.log.info({ version: PROTOCOL_VERSION }, 'Lean index server started');
