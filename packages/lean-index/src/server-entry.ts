import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import { metadataRoutes } from './server/routes/metadata.js';
import { agentIndexRoutes } from './server/routes/agent-index.js';
import { createDb } from './server/db.js';
import { PROTOCOL_VERSION } from './server/app.js';

const PORT = parseInt(process.env.PORT ?? '8443', 10);
const DB_PATH = process.env.DB_PATH ?? '/data/lean-index.db';
const TLS_CERT = process.env.TLS_CERT_PATH ?? '/certs/cert.pem';
const TLS_KEY = process.env.TLS_KEY_PATH ?? '/certs/key.pem';

const db = await createDb(DB_PATH);

const app = Fastify({
  http2: true,
  https: {
    cert: readFileSync(TLS_CERT),
    key: readFileSync(TLS_KEY),
  },
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  void reply.code(500).send({ message: 'Internal server error' });
});

await app.register(metadataRoutes, { db });
await app.register(agentIndexRoutes, { db });

await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info({ version: PROTOCOL_VERSION }, 'Lean index server started');
