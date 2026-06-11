import type { FastifyInstance } from 'fastify';
import type { AgentIdentityManager } from '@nanda/agent';
import { runWorkflow, INITIAL_STATE, type WorkflowState } from './workflow.js';

export function registerRoutes(
  app: FastifyInstance,
  manager: AgentIdentityManager,
  leanIndexUrl: string,
): void {
  let state: WorkflowState = { ...INITIAL_STATE };

  const setState = (update: Partial<WorkflowState>) => {
    state = { ...state, ...update };
    if (update.statusUpdate !== undefined) {
      app.log.info({ statusUpdate: update.statusUpdate }, 'Personal rep status update');
    }
  };

  app.post<{
    Body: { objective: string; contextDIDs: { role: string; did: string }[] };
  }>(
    '/objective',
    {
      schema: {
        body: {
          type: 'object',
          required: ['objective', 'contextDIDs'],
          properties: {
            objective: { type: 'string' },
            contextDIDs: {
              type: 'array',
              items: {
                type: 'object',
                required: ['role', 'did'],
                properties: { role: { type: 'string' }, did: { type: 'string' } },
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      if (state.pendingGoals.length > 0 && !state.isFailed && !state.isComplete) {
        return reply.code(409).send({ message: 'A workflow is already in progress' });
      }

      const { contextDIDs } = req.body;
      const localSupportEntry = contextDIDs.find((e) => e.role === 'local-government-support');
      if (!localSupportEntry) {
        return reply.code(400).send({ message: 'contextDIDs must include a local-government-support entry' });
      }

      state = { ...INITIAL_STATE };

      runWorkflow(localSupportEntry.did, manager, leanIndexUrl, setState).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        app.log.error({ err }, 'Workflow failed');
        setState({ isFailed: true, statusUpdate: `Workflow halted: ${message}` });
      });

      return { acknowledgement: 'Understood. I have one contact to start with. I will research requirements and proceed on your behalf.' };
    },
  );

  app.get('/status', async () => ({ ...state }));
}
