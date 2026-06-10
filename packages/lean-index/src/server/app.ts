import Fastify, { type FastifyInstance } from 'fastify';
import { metadataRoutes } from './routes/metadata.js';
import { agentIndexRoutes } from './routes/agent-index.js';
import type { AgentAddrStorage } from './db.js';

export const PROTOCOL_VERSION = 'nanda-0.0.0-index';

// Shared Fastify constructor options — used by both createApp (tests) and server-entry (production).
export const FASTIFY_BASE_OPTIONS = {
  ajv: { customOptions: { removeAdditional: false } },
  schemaErrorFormatter: (errors: Array<{ instancePath: string; message?: string }>) => {
    const message = errors.map((e) => `${e.instancePath || 'body'}: ${e.message}`).join('; ');
    return new Error(message);
  },
} as const;

// Registers routes and error handling onto any Fastify instance.
// Used by createApp (tests) and server-entry (production HTTP/2).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function configureApp(app: FastifyInstance<any, any, any>, db: AgentAddrStorage): Promise<void> {
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    void reply.code(error.statusCode ?? 500).send({ message: error.message });
  });

  await app.register(metadataRoutes, { db });
  await app.register(agentIndexRoutes, { db });
}

// Plain HTTP factory for tests — no TLS, no HTTP/2 needed.
export async function createApp(
  db: AgentAddrStorage,
  options: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    ...FASTIFY_BASE_OPTIONS,
    logger: options.logger ? { level: 'info' } : false,
  });
  await configureApp(app, db);
  return app;
}
