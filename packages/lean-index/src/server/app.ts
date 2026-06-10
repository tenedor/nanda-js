import Fastify, { type FastifyInstance } from 'fastify';
import { metadataRoutes } from './routes/metadata.js';
import { agentIndexRoutes } from './routes/agent-index.js';
import type { AgentAddrStorage } from './db.js';

export const PROTOCOL_VERSION = 'nanda-0.0.0-index';

export interface AppOptions {
  logger?: boolean;
}

export async function createApp(
  db: AgentAddrStorage,
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger !== false ? { level: 'info' } : false,
    ajv: {
      customOptions: { removeAdditional: false },
    },
    schemaErrorFormatter: (errors) => {
      const message = errors.map((e) => `${e.instancePath || 'body'}: ${e.message}`).join('; ');
      return new Error(message);
    },
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    void reply.code(error.statusCode ?? 500).send({ message: error.message });
  });

  await app.register(metadataRoutes, { db });
  await app.register(agentIndexRoutes, { db });

  return app;
}
