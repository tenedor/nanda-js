import type { FastifyPluginAsync } from 'fastify';
import type { AgentFactsStorage } from '../db.js';
import { NotFoundError, ConflictError, ValidationError } from '@nanda/shared';
import { verifyAgentFactsProof, verifyAttestation } from '../validation.js';
import type { AgentFacts } from '../../AgentFacts.js';
import type { InvalidateFactsRequest } from '../../AgentFactsClient.js';
import { agentFactsSchema, invalidateFactsSchema } from '../schemas.js';

interface FactsOptions {
  db: AgentFactsStorage;
}

export const factsRoutes: FastifyPluginAsync<FactsOptions> = async (app, opts) => {
  const { db } = opts;

  app.get<{ Params: { id: string } }>('/facts/:id', async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const record = await db.getFacts(id);
    if (!record) {
      return reply.code(404).send({ message: `Agent facts not found: ${id}` });
    }
    if (record.invalidated) {
      return reply.code(410).send({ message: `Agent facts have been revoked: ${id}` });
    }
    if (record.expiresAt < new Date().toISOString()) {
      return reply.code(410).send({ message: `Agent facts have expired: ${id}` });
    }
    return record.facts;
  });

  app.post<{ Body: AgentFacts }>(
      '/facts',
      { schema: { body: agentFactsSchema } },
      async (req, reply) => {
    const facts = req.body;
    try {
      await verifyAgentFactsProof(facts);
    } catch (e) {
      const err = e as ValidationError;
      return reply.code(err.statusCode).send({ message: err.message });
    }
    try {
      await db.insertFacts(facts);
    } catch (e) {
      if (e instanceof ConflictError) {
        return reply.code(409).send({ message: e.message });
      }
      throw e;
    }
    return reply.code(201).send();
  });

  app.put<{ Params: { id: string }; Body: AgentFacts }>(
      '/facts/:id',
      { schema: { body: agentFactsSchema } },
      async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const facts = req.body;
    if (facts.id !== id) {
      return reply.code(400).send({ message: 'id in body does not match path' });
    }
    try {
      await verifyAgentFactsProof(facts);
    } catch (e) {
      const err = e as ValidationError;
      return reply.code(err.statusCode).send({ message: err.message });
    }
    try {
      await db.updateFacts(facts);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return reply.code(404).send({ message: e.message });
      }
      throw e;
    }
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: InvalidateFactsRequest }>(
      '/facts/:id/invalidate',
      { schema: { body: invalidateFactsSchema } },
      async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const attestation = req.body;
    try {
      await verifyAttestation(attestation, 'invalidate-facts', id);
    } catch (e) {
      const err = e as ValidationError;
      return reply.code(err.statusCode).send({ message: err.message });
    }
    try {
      await db.invalidateFacts(id);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return reply.code(404).send({ message: e.message });
      }
      throw e;
    }
    return reply.code(204).send();
  });
};
