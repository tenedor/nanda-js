import type { FastifyPluginAsync } from 'fastify';
import type { AgentFactsStorage } from '../db.js';
import { NotFoundError, ConflictError, ValidationError, type VerifiableCredential } from '@nanda/shared';
import { verifyAgentFactsVc, verifyAttestation } from '../validation.js';
import type { AgentFacts } from '../../AgentFacts.js';
import type { InvalidateFactsRequest } from '../../AgentFactsClient.js';
import { agentFactsVcSchema, invalidateFactsSchema } from '../schemas.js';

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
    if (record.expiresAt !== '' && record.expiresAt < new Date().toISOString()) {
      return reply.code(410).send({ message: `Agent facts have expired: ${id}` });
    }
    return record.vc;
  });

  app.post<{ Body: VerifiableCredential<AgentFacts> }>(
      '/facts',
      { schema: { body: agentFactsVcSchema } },
      async (req, reply) => {
    const vc = req.body;
    try {
      await verifyAgentFactsVc(vc);
    } catch (e) {
      const err = e as ValidationError;
      return reply.code(err.statusCode).send({ message: err.message });
    }
    try {
      await db.insertFacts(vc);
    } catch (e) {
      if (e instanceof ConflictError) {
        return reply.code(409).send({ message: e.message });
      }
      throw e;
    }
    return reply.code(201).send();
  });

  app.put<{ Params: { id: string }; Body: VerifiableCredential<AgentFacts> }>(
      '/facts/:id',
      { schema: { body: agentFactsVcSchema } },
      async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const vc = req.body;
    if (vc.credentialSubject.id !== id) {
      return reply.code(400).send({ message: 'credentialSubject.id in body does not match path' });
    }
    try {
      await verifyAgentFactsVc(vc);
    } catch (e) {
      const err = e as ValidationError;
      return reply.code(err.statusCode).send({ message: err.message });
    }
    try {
      await db.updateFacts(vc);
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
