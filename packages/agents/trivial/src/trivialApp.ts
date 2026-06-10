import type { FastifyInstance } from 'fastify';
import { createApp, type AgentIdentityManager, type GetStatus } from '@nanda/agent';

export async function createTrivialApp(
  manager: AgentIdentityManager,
  options: { logger?: boolean; getStatus?: GetStatus } = {},
): Promise<FastifyInstance> {
  return createApp(manager, {
    ...options,
    registerRoutes: async (app) => {
      app.get('/name', async () => ({ agentName: manager.agentName }));
    },
  });
}
