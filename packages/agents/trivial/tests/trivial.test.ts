import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTrivialApp } from '../src/trivialApp.js';
import { AgentIdentityManager, PROTOCOL_VERSION } from '@nanda/agent';
import { generateKeyPair } from '@nanda/shared';

const DID = 'did:web:trivial.example.com';
const AGENT_NAME = 'urn:agent:example:trivial';

function makeManager() {
  return new AgentIdentityManager({
    did: DID,
    keyPair: generateKeyPair(),
    agentName: AGENT_NAME,
    leanIndexUrl: 'https://index.example.com',
    primaryFactsServerUrl: 'https://facts.example.com',
  });
}

describe('createTrivialApp', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTrivialApp(makeManager());
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it('GET /name returns the agent name', async () => {
    const res = await app.inject({ method: 'GET', url: '/name' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ agentName: AGENT_NAME });
  });

  it('GET /.well-known/did.json is served by the identity routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/did.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(DID);
  });

  it('GET /version returns the agent protocol version', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: PROTOCOL_VERSION });
  });

  it('GET /status returns ok by default', async () => {
    const res = await app.inject({ method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('forwards a custom getStatus function', async () => {
    const customApp = await createTrivialApp(makeManager(), {
      getStatus: () => ({ status: 'degraded' }),
    });
    await customApp.ready();
    const res = await customApp.inject({ method: 'GET', url: '/status' });
    expect(res.json()).toEqual({ status: 'degraded' });
    await customApp.close();
  });
});
