import Fastify, { type FastifyInstance } from 'fastify';
import { metadataRoutes } from './routes/metadata.js';

export const PROTOCOL_VERSION = 'nanda-0.0.0-index';

export interface AppOptions {
  logger?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger !== false ? { level: 'info' } : false,
  });

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    void reply.code(500).send({ message: 'Internal server error' });
  });

  await app.register(metadataRoutes);

  return app;
}
