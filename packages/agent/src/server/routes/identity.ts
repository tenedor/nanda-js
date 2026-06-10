import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '../../AgentIdentityManager.js';

interface IdentityOptions {
  manager: AgentIdentityManager;
}

export const identityRoutes: FastifyPluginAsync<IdentityOptions> = async (app, opts) => {
  app.get('/.well-known/did.json', async (_req, reply) => {
    return reply.send(opts.manager.getDIDDocument());
  });
};
