import Fastify, { type FastifyInstance } from 'fastify';
import type { AgentIdentityManager } from '../AgentIdentityManager.js';
import { metadataRoutes } from './routes/metadata.js';
import { identityRoutes } from './routes/identity.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteRegistrar = (app: FastifyInstance<any, any, any>) => Promise<void>;

export const PROTOCOL_VERSION = 'nanda-0.0.0-agent';

export const FASTIFY_BASE_OPTIONS = {
  ajv: { customOptions: { removeAdditional: false } },
  schemaErrorFormatter: (errors: Array<{ instancePath: string; message?: string }>) => {
    const message = errors.map((e) => `${e.instancePath || 'body'}: ${e.message}`).join('; ');
    return new Error(message);
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function configureApp(
  app: FastifyInstance<any, any, any>,
  manager: AgentIdentityManager,
  registerRoutes?: RouteRegistrar,
): Promise<void> {
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    void reply.code(error.statusCode ?? 500).send({ message: error.message });
  });

  await app.register(metadataRoutes);
  await app.register(identityRoutes, { manager });

  if (registerRoutes) {
    await registerRoutes(app);
  }
}

export async function createApp(
  manager: AgentIdentityManager,
  options: { logger?: boolean; registerRoutes?: RouteRegistrar } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    ...FASTIFY_BASE_OPTIONS,
    logger: options.logger ? { level: 'info' } : false,
  });
  await configureApp(app, manager, options.registerRoutes);
  return app;
}
