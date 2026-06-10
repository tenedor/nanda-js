import Fastify, { type FastifyInstance } from 'fastify';
import { metadataRoutes } from './routes/metadata.js';
import type { AgentFactsStorage } from './db.js';

export const PROTOCOL_VERSION = 'nanda-0.0.0-facts';

export const FASTIFY_BASE_OPTIONS = {
  ajv: { customOptions: { removeAdditional: false } },
  schemaErrorFormatter: (errors: Array<{ instancePath: string; message?: string }>) => {
    const message = errors.map((e) => `${e.instancePath || 'body'}: ${e.message}`).join('; ');
    return new Error(message);
  },
} as const;

export async function configureApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: FastifyInstance<any, any, any>,
  db: AgentFactsStorage,
): Promise<void> {
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    void reply.code(error.statusCode ?? 500).send({ message: error.message });
  });

  await app.register(metadataRoutes, { db });
}

export async function createApp(
  db: AgentFactsStorage,
  options: { logger?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    ...FASTIFY_BASE_OPTIONS,
    logger: options.logger ? { level: 'info' } : false,
  });
  await configureApp(app, db);
  return app;
}
