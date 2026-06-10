import type { FastifyPluginAsync } from 'fastify';
import type { ProtocolVersion, ServerStatus } from '@nanda/shared';
import { PROTOCOL_VERSION } from '../app.js';
import type { AgentAddrStorage } from '../db.js';

const STATUS_PING_TIMEOUT_MS = 500;

interface MetadataOptions {
  db: AgentAddrStorage;
}

export const metadataRoutes: FastifyPluginAsync<MetadataOptions> = async (app, opts) => {
  app.get('/version', async (): Promise<ProtocolVersion> => {
    return { version: PROTOCOL_VERSION };
  });

  app.get('/status', async (): Promise<ServerStatus> => {
    try {
      await opts.db.ping(STATUS_PING_TIMEOUT_MS);
      return { status: 'ok' };
    } catch {
      return { status: 'unavailable' };
    }
  });
};
