# NANDA Registry Prototype Design

This prototype makes various simplifications compared to the scale and rigor expected by the paper, but aims to make core design choices that align to long-term needs.

## Top-Level Components

- Lean Index
- Agent Facts Registry
- Agent
- Client (some Agents are also Clients, but there are also non-Agent Clients)

The Lean Index is a singleton, the rest are not.

These will coordinate across a single common Network. (For now, don't worry about heterogeneous or otherwise complicated network topologies.)

For now, we'll skip adaptive resolution.

## Workflows

Lean Index
- startup: join the network
- handle a write request: validate, then write
- serve a read request
- (for now, don't worry about caching, DoS attack defense, or other resilience)

Agent Facts Registry
- startup: join the network
- handle a write request: validate, then write
- handle a invalidate-agent-facts request
- serve a read request: check VC status, then serve
- (for now, don't worry about caching, DoS attack defense, or other resilience)

Agent
- acquire a network address
- acquire a secure identity (for now, this always means generate a DID and publish it at a controlled web URL)
- register agent facts
- register with lean index
- update agent facts
- invalidate agent facts
- update lean index
- handle interactions initiated by clients

Client
- read index: fetch, validate, and manage TTL
- read agent facts: fetch, validate, and manage TTL
- interact with agent
- timeout TTL and re-resolve

## Security

- Ed25519 root-of-trust: Each agent generates a keypair at identity creation time.
- DID-based identity: Agents publish a `did:web` DID document at a controlled HTTPS URL. This binds the agent's public key to a verifiable identity. The lean index and AgentFacts registry both verify submitted records against the DID document before accepting a write.
- Signed records: AgentAddr records are Ed25519-signed by the agent. AgentFacts documents are signed as W3C VCs. Readers verify signatures on fetch; an unverifiable signature is rejected.
- Revocation: AgentFacts VCs include an expiry and a status-list reference. The AgentFacts registry checks VC status before serving. Agents can invalidate credentials immediately via the invalidate-agent-facts workflow.

For now, skip things like transport-layer mutual auth, trust zone federation or cross-signing, and defending against attacks on the DID document host.

## Prototype Environment

Docker Compose on a Mac (Apple Silicon). All services run as `linux/arm64` containers on a shared Docker network. Services find each other by Compose service name. TLS uses locally-trusted self-signed certs via `mkcert`. The lean index uses embedded SQLite for durable storage.

Services that accept inbound requests (lean index, agent facts registry, agents) expose ports to localhost for direct access by test scripts.

## Service Orchestration

Startup order is enforced via Compose `depends_on` with `condition: service_healthy`. Each service exposes a `/status` HTTP endpoint. This is used to ensure no Agent is started until the lean index and agent facts registry it will depend on are available.

Test scripts drive scenario execution by making HTTP requests directly to exposed localhost ports.

## Observability

All containers emit structured JSON-line logs to stdout. Use docker compose to access logs.

## Prototype Scenario

Easy Government Service Access: Food truck paperwork management
- who: personal representative agent, various government representative agents
- what: personal rep navigates government reps to acquire a business license and permit for a food truck
- bonus: could add in a private food truck vendor agent who rents the truck after paperwork is complete

The details of each agent's capabilities and interaction flows will be filled in later.

For the basic scenario, make two Agent Facts registries: a government server and a personal agents server. For the bonus scenario, add a third server representing the company.

## Service APIs

All APIs are REST over HTTP/2 with TLS. Request and response bodies are JSON. Upgrade to higher performance later.

**Lean Index**
- `GET /agents/:id` — resolve an AgentAddr by agent ID
- `POST /agents` — register a new AgentAddr record (validated against DID before writing)
- `PUT /agents/:id` — update an existing AgentAddr record
- `DELETE /agents/:id` — remove an agent from the index
- `GET /version` — protocol version
- `GET /status` — health and status check

**Agent Facts Registry**
- `GET /facts/:id` — fetch AgentFacts for an agent (checks VC status before serving)
- `POST /facts` — register new AgentFacts (validated against DID before writing)
- `PUT /facts/:id` — update AgentFacts
- `POST /facts/:id/invalidate` — immediately revoke AgentFacts VC
- `GET /version` — protocol version
- `GET /status` — health and status check

**Agent**
- `GET /.well-known/did.json` — serve the agent's DID document
- `GET /version` — protocol version
- `GET /status` — health and status check
- `<agent-specific endpoints>`

Scenario-specific agent APIs will be defined later.

## Data Types

**`ProtocolVersion`**
```typescript
{
  version: string                 // for now, the version is always "nanda-0.0.0-<type>", where <type> is "index", "facts", and/or "agent", optionally concatenated with "|"
}
```

**`AgentID`**
```typescript
string                            // for now, always a DID, e.g. "did:web:translator.salesforce.com"
```

**`AgentAddr`**
```typescript
{
  agentId: AgentID                // unique, machine-readable ID
  agentName: string               // human-readable URN
  primaryFactsUrl: string         // URL of hosted AgentFacts
  privateFactsUrl?: string        // optional privacy-preserving AgentFacts URL
  adaptive_resolver_url?: string  // optional dynamic routing endpoint
  ttl: number                     // in seconds
  signature: string               // base64url-encoded Ed25519 signature bytes
}
```

**`AgentFacts`**
See appendix in NANDA paper.

**`ServerStatus`**
```typescript
{
  status: "ok" | "degraded" | "unavailable"
}
```

**`ErrorResponse`**
```typescript
{
  error: string                   // machine-readable code
  message: string                 // human-readable description
}
```

## Implementation Notes & Errata

- Prototype in Typescript. (Would later rewrite performance-critical components in Rust or Go.) Use python for test scripts.
- For now, implement the index as a single server. Don't worry about caching layers/etc.
- For now, implement every agent as living on its own server. Later, co-host some agents on their matching AgentFacts servers.
- Initially, just use public facts. Later, add a scenario involving private facts.
