import type { FastifyPluginAsync } from 'fastify';
import type { AgentAddrStorage } from '../db.js';
import { NotFoundError, ConflictError, ValidationError } from '@nanda/shared';
import { verifyAgentAddrSignature, verifyAttestation } from '../validation.js';
import type { AgentAddr } from '../../AgentAddr.js';
import type { DeleteAgentRequest } from '../../LeanIndexClient.js';
import { agentAddrSchema, deleteAgentSchema } from '../schemas.js';

interface AgentIndexOptions {
  db: AgentAddrStorage;
}

export const agentIndexRoutes: FastifyPluginAsync<AgentIndexOptions> = async (app, opts) => {
  const { db } = opts;

  app.get<{ Params: { id: string } }>('/agents/:id', async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const record = await db.getAgent(id);
    if (!record) {
      return reply.code(404).send({ message: `Agent not found: ${id}` });
    }
    return record;
  });

  app.post<{ Body: AgentAddr }>(
    '/agents',
    { schema: { body: agentAddrSchema } },
    async (req, reply) => {
      const record = req.body;
      try {
        await verifyAgentAddrSignature(record);
      } catch (e) {
        const err = e as ValidationError;
        return reply.code(err.statusCode).send({ message: err.message });
      }
      try {
        await db.insertAgent(record);
      } catch (e) {
        if (e instanceof ConflictError) {
          return reply.code(409).send({ message: e.message });
        }
        throw e;
      }
      return reply.code(201).send();
    },
  );

  app.put<{ Params: { id: string }; Body: AgentAddr }>(
    '/agents/:id',
    { schema: { body: agentAddrSchema } },
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const record = req.body;
      if (record.agentId !== id) {
        return reply.code(400).send({ message: 'agentId in body does not match path' });
      }
      try {
        await verifyAgentAddrSignature(record);
      } catch (e) {
        const err = e as ValidationError;
        return reply.code(err.statusCode).send({ message: err.message });
      }
      try {
        await db.updateAgent(record);
      } catch (e) {
        if (e instanceof NotFoundError) {
          return reply.code(404).send({ message: e.message });
        }
        throw e;
      }
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string }; Body: DeleteAgentRequest }>(
    '/agents/:id',
    { schema: { body: deleteAgentSchema } },
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const attestation = req.body;
      try {
        await verifyAttestation(attestation, 'delete-agent', id);
      } catch (e) {
        const err = e as ValidationError;
        return reply.code(err.statusCode).send({ message: err.message });
      }
      try {
        await db.deleteAgent(id);
      } catch (e) {
        if (e instanceof NotFoundError) {
          return reply.code(404).send({ message: e.message });
        }
        throw e;
      }
      return reply.code(204).send();
    },
  );
};
