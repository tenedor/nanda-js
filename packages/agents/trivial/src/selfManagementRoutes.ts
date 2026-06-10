import type { FastifyPluginAsync } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import type { AgentFacts } from '@nanda/agent-facts';

interface SelfManagementOptions {
  manager: AgentIdentityManager;
  facts: AgentFacts;
}

interface MigrateFactsBody {
  primaryFactsServerUrl: string;
  privateFactsServerUrl?: string | null;
}

const migrateFactsSchema = {
  body: {
    type: 'object',
    required: ['primaryFactsServerUrl'],
    properties: {
      primaryFactsServerUrl: { type: 'string' },
      privateFactsServerUrl: { type: ['string', 'null'] },
    },
    additionalProperties: false,
  },
};

// Lifecycle management routes — useful for testing and clean shutdown.
// Production deployments should gate these behind authentication.
export const selfManagementRoutes: FastifyPluginAsync<SelfManagementOptions> = async (
  app,
  { manager, facts },
) => {
  app.post('/self/invalidate-facts', async (_req, reply) => {
    if (!manager.isFactsRegistered) {
      return reply.code(409).send({ message: 'Facts are not currently registered' });
    }
    await manager.invalidateFacts();
    return reply.code(204).send();
  });

  // Uses PUT /facts/:id so the server clears the invalidation flag without a conflict.
  app.post('/self/restore-facts', async (_req, reply) => {
    if (manager.isFactsRegistered) {
      return reply.code(409).send({ message: 'Facts are already registered' });
    }
    await manager.updateFacts(facts);
    manager.isFactsRegistered = true;
    return reply.code(204).send();
  });

  app.post('/self/deregister-index', async (_req, reply) => {
    if (!manager.isIndexRegistered) {
      return reply.code(409).send({ message: 'Not currently registered in lean index' });
    }
    await manager.deregister();
    return reply.code(204).send();
  });

  app.post('/self/register-index', async (_req, reply) => {
    if (manager.isIndexRegistered) {
      return reply.code(409).send({ message: 'Already registered in lean index' });
    }
    await manager.registerIndexOnly();
    return reply.code(204).send();
  });

  // Transitions the agent to a new facts-server configuration.
  // Registers on new servers, invalidates removed servers, and updates lean-index.
  app.post<{ Body: MigrateFactsBody }>(
    '/self/migrate-facts',
    { schema: migrateFactsSchema },
    async (req, reply) => {
      const { primaryFactsServerUrl, privateFactsServerUrl } = req.body;
      await manager.migrateFactsServers(primaryFactsServerUrl, privateFactsServerUrl, facts);
      return reply.code(204).send();
    },
  );
};
