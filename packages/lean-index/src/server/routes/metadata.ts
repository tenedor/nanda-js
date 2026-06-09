import type { FastifyInstance } from 'fastify';
import type { ProtocolVersion, ServerStatus } from '@nanda/shared';
import { PROTOCOL_VERSION } from '../app.js';

export async function metadataRoutes(app: FastifyInstance): Promise<void> {
  app.get('/version', async (): Promise<ProtocolVersion> => {
    return { version: PROTOCOL_VERSION };
  });

  app.get('/status', async (): Promise<ServerStatus> => {
    return { status: 'ok' };
  });
}
