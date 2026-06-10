import type { FastifyPluginAsync } from 'fastify';
import type { ProtocolVersion, ServerStatus } from '@nanda/shared';
import { PROTOCOL_VERSION } from '../app.js';

export type GetStatus = () => ServerStatus | Promise<ServerStatus>;

interface MetadataOptions {
  getStatus?: GetStatus;
}

export const metadataRoutes: FastifyPluginAsync<MetadataOptions> = async (app, opts) => {
  const getStatus: GetStatus = opts.getStatus ?? (() => ({ status: 'ok' }));

  app.get('/version', async (): Promise<ProtocolVersion> => {
    return { version: PROTOCOL_VERSION };
  });

  app.get('/status', async (): Promise<ServerStatus> => {
    return getStatus();
  });
};
