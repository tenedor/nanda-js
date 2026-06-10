import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/server/app.js';
import { AgentIdentityManager } from '../src/AgentIdentityManager.js';
import { generateKeyPair, publicKeyToBase64url } from '@nanda/shared';

const keyPair = generateKeyPair();
const DID = 'did:web:agent.example.com';

function makeManager() {
  return new AgentIdentityManager({
    did: DID,
    keyPair,
    agentName: 'urn:agent:example:test',
    leanIndexUrl: 'https://index.example.com',
    primaryFactsServerUrl: 'https://facts.example.com',
  });
}

describe('DID document server', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp(makeManager());
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it('GET /.well-known/did.json returns the agent DID document', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/did.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.id).toBe(DID);
    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(doc.verificationMethod[0].publicKeyMultibase).toBe('u' + publicKeyToBase64url(keyPair.publicKey));
    expect(doc.assertionMethod).toContain(`${DID}#key-1`);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('custom route registration callback', () => {
  it('routes registered via callback are reachable', async () => {
    const app = await createApp(makeManager(), {
      registerRoutes: async (a) => {
        a.get('/ping', async () => ({ pong: true }));
      },
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pong: true });
    await app.close();
  });

  it('callback routes can access the manager via closure', async () => {
    const manager = makeManager();
    const app = await createApp(manager, {
      registerRoutes: async (a) => {
        a.get('/did', async () => ({ did: manager.did }));
      },
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/did' });
    expect(res.json()).toEqual({ did: DID });
    await app.close();
  });
});
