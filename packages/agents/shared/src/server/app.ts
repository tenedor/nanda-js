import Fastify, { type FastifyInstance } from 'fastify';
import type { AgentIdentityManager } from '../AgentIdentityManager.js';
import { metadataRoutes, type GetStatus } from './routes/metadata.js';
export type { GetStatus };
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
  disableRequestLogging: true,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function configureApp(
  app: FastifyInstance<any, any, any>,
  manager: AgentIdentityManager,
  registerRoutes?: RouteRegistrar,
  getStatus?: GetStatus,
): Promise<void> {
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(error);
    void reply.code(error.statusCode ?? 500).send({ message: error.message });
  });

  app.addHook('preValidation', (request, _reply, done) => {
    request.log.info({
      direction: 'received', kind: 'request',
      method: request.method, url: request.url,
      remoteIp: request.ip, localIp: request.socket.localAddress,
      body: request.body,
    }, 'inbound request');
    done();
  });

  app.addHook('onSend', async (request, reply, payload) => {
    let body: unknown = payload;
    if (typeof payload === 'string') {
      try { body = JSON.parse(payload); } catch { /* leave as string */ }
    }
    request.log.info({
      direction: 'sent', kind: 'response',
      method: request.method, url: request.url,
      remoteIp: request.ip, localIp: request.socket.localAddress,
      statusCode: reply.statusCode, body,
    }, 'inbound response');
    return payload;
  });

  await app.register(metadataRoutes, { getStatus });
  await app.register(identityRoutes, { manager });

  if (registerRoutes) {
    await registerRoutes(app);
  }
}

export async function createApp(
  manager: AgentIdentityManager,
  options: { logger?: boolean; registerRoutes?: RouteRegistrar; getStatus?: GetStatus } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    ...FASTIFY_BASE_OPTIONS,
    logger: options.logger ? { level: 'info' } : false,
  });
  await configureApp(app, manager, options.registerRoutes, options.getStatus);
  return app;
}
