# NANDA Prototype

## Prerequisites

- Node.js 22+
- Docker Desktop (`brew install --cask docker`)
- mkcert (`brew install mkcert`)

## Setup (once per machine)

> **Note:** `gen-certs.sh` installs a local CA into your system trust store and Firefox. This modifies host-level certificate configuration and requires sudo access.

```bash
./scripts/gen-certs.sh
```

## Running

```bash
docker compose up --build
```

Wait for both `Trivial agent registered` log lines before testing.

## Stopping

```bash
docker compose down -v
```

The `-v` flag removes the SQLite volumes for a clean slate on next start.
Omit `-v` only if you intentionally want to resume persisted state.

## Rebuilding after code changes

```bash
docker compose down -v && docker compose up --build
```

## Smoke test

With services running, from the repo root:

```bash
pip install -r scripts/requirements.txt
python scripts/smoke_test.py
```

The test covers:
- Health checks on all six services
- DID document validity on both agents
- Lean-index resolution (AgentAddr with signature)
- Agent-facts retrieval (full VerifiableCredential with DataIntegrityProof)
- Facts server migration: trivial-agent-1 moves primary from agent-facts-1 → agent-facts-2
- Adding a private facts server: trivial-agent-2 gains a private registration on agent-facts-private-1
- Invalidation lifecycle: invalidate facts → verify 410 → restore → verify 200
- Deregistration lifecycle: deregister from index → verify 404 → re-register → verify 200

## Agent self-management routes

Each trivial agent exposes these routes for lifecycle management and testing.
Production deployments should gate them behind authentication.

| Route | Body | Effect |
|---|---|---|
| `POST /self/invalidate-facts` | — | Invalidates this agent's facts on its current primary facts server |
| `POST /self/restore-facts` | — | Re-publishes facts (clears invalidation) via PUT |
| `POST /self/deregister-index` | — | Removes this agent from the lean index |
| `POST /self/register-index` | — | Re-registers this agent in the lean index |
| `POST /self/migrate-facts` | `{"primaryFactsServerUrl": "...", "privateFactsServerUrl": "..."}` | Migrates to a new facts-server configuration: registers on new servers, invalidates removed servers, and updates the lean-index entry. `privateFactsServerUrl` is optional; pass `null` to remove the current private server. |

Example — migrate trivial-agent-1 to agent-facts-2:
```bash
curl -sk -X POST https://localhost:8445/self/migrate-facts \
  -H 'Content-Type: application/json' \
  -d '{"primaryFactsServerUrl":"https://agent-facts-2:8447"}'
```

## Observing

```bash
# Service health
./scripts/curl-formatted.sh https://localhost:8443/status
./scripts/curl-formatted.sh https://localhost:8444/status
./scripts/curl-formatted.sh https://localhost:8447/status
./scripts/curl-formatted.sh https://localhost:8448/status

# DID documents
./scripts/curl-formatted.sh https://localhost:8445/.well-known/did.json
./scripts/curl-formatted.sh https://localhost:8446/.well-known/did.json

# Lean index entries
./scripts/curl-formatted.sh "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-1%253A8445"
./scripts/curl-formatted.sh "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-2%253A8446"

# Agent facts (agent-facts-1 is default at startup)
./scripts/curl-formatted.sh "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-1%253A8445"
./scripts/curl-formatted.sh "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-2%253A8446"
```
