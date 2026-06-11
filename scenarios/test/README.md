# Smoke Test Scenario

Validates the core NANDA infrastructure using two minimal "trivial" agents. Covers DID documents, lean-index registration and resolution, agent-facts issuance and retrieval (W3C VerifiableCredential with Ed25519 DataIntegrityProof), and the full agent lifecycle: facts invalidation, restoration, migration between facts servers, and index deregistration/re-registration.

## Services (ports 8443–8448)

| Service | Port | Role |
|---|---|---|
| lean-index | 8443 | NANDA lean index |
| agent-facts-1 | 8444 | Agent facts registry (primary) |
| trivial-agent-1 | 8445 | Trivial agent alpha |
| trivial-agent-2 | 8446 | Trivial agent beta |
| agent-facts-2 | 8447 | Agent facts registry (migration target) |
| agent-facts-private-1 | 8448 | Agent facts registry (private) |

## Running

```bash
docker compose -f docker-compose.smoke-test.yml up --build
```

Wait for both `Trivial agent registered` log lines, then run the smoke test:

```bash
python3 scripts/smoke_test.py
```

## Observing

Run all checks at once (health, DIDs, lean-index entries, facts on all three registries):

```bash
./scripts/observe-smoke-test.sh           # full output
./scripts/observe-smoke-test.sh --short   # truncate agent facts to 15 lines each
```

Or query individual endpoints:

```bash
./scripts/curl-formatted.sh https://localhost:8443/status
./scripts/curl-formatted.sh https://localhost:8445/.well-known/did.json
./scripts/curl-formatted.sh "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-1%253A8445"
./scripts/curl-formatted.sh "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-1%253A8445"
```

## Agent self-management routes

Each trivial agent exposes lifecycle management routes. Production deployments should gate these behind authentication.

| Route | Body | Effect |
|---|---|---|
| `POST /self/invalidate-facts` | — | Invalidates facts on the current primary facts server |
| `POST /self/restore-facts` | — | Re-publishes facts (clears invalidation) via PUT |
| `POST /self/deregister-index` | — | Removes agent from the lean index |
| `POST /self/register-index` | — | Re-registers agent in the lean index |
| `POST /self/migrate-facts` | `{"primaryFactsServerUrl":"...","privateFactsServerUrl":"..."}` | Migrates to a new facts-server config; `privateFactsServerUrl` is optional, pass `null` to remove |

```bash
# Example: migrate trivial-agent-1 to agent-facts-2
curl -sk -X POST https://localhost:8445/self/migrate-facts \
  -H 'Content-Type: application/json' \
  -d '{"primaryFactsServerUrl":"https://agent-facts-2:8447"}'
```
