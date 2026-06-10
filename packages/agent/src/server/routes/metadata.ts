import type { FastifyPluginAsync } from 'fastify';
import type { ProtocolVersion, ServerStatus } from '@nanda/shared';
import { PROTOCOL_VERSION } from '../app.js';

export const metadataRoutes: FastifyPluginAsync = async (app) => {
  app.get('/version', async (): Promise<ProtocolVersion> => {
    return { version: PROTOCOL_VERSION };
  });

  // No database to ping — status reflects process liveness only.
  app.get('/status', async (): Promise<ServerStatus> => {
    return { status: 'ok' };
  });
};
