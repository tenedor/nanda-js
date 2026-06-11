# Test Scenario

The test scenario validates the core NANDA infrastructure — lean index, agent facts registry, DID documents, verifiable credentials, and agent lifecycle operations — using two minimal "trivial" agents.

## Services

| Service | Port | Role |
|---|---|---|
| lean-index | 8443 | NANDA lean index |
| agent-facts-1 | 8444 | Agent facts registry (primary) |
| agent-facts-2 | 8447 | Agent facts registry (migration target) |
| agent-facts-private-1 | 8448 | Agent facts registry (private) |
| trivial-agent-1 | 8445 | Trivial agent alpha |
| trivial-agent-2 | 8446 | Trivial agent beta |

## Running

```bash
docker compose -f docker-compose.smoke-test.yml up --build
```

## Smoke test

```bash
pip install -r scripts/requirements.txt
python3 scripts/smoke_test.py
```

The test covers: health checks on all six services, DID document validity, lean-index resolution (AgentAddr with signature), agent-facts retrieval (VerifiableCredential with DataIntegrityProof), facts server migration, invalidation lifecycle, and deregistration lifecycle.
