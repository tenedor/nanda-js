# NANDA Prototype

A working prototype of the [NANDA](https://arxiv.org/abs/2507.14263) agent registry system. Implements the three-layer architecture from the paper: a lean index, agent facts registries, and agents that register, discover, and interact with each other using W3C Verifiable Credentials and `did:web` identities.

Two runnable scenarios are included, each with its own Docker Compose file:

| Scenario | Compose file | Description |
|---|---|---|
| [Smoke test](scenarios/test/README.md) | `docker-compose.smoke-test.yml` | Infrastructure validation with two minimal agents |
| [Food truck](scenarios/food-truck/README.md) | `docker-compose.food-truck.yml` | Multi-agent coordination: a personal rep navigates government and vendor agents to set up a food truck business |

## Approach

- [NANDA paper](https://arxiv.org/abs/2507.14263) — the architecture this prototype implements
- [design.md](design.md) — prototype-specific design decisions and simplifications

## Prerequisites

- Docker (with Compose)
- mkcert
- Python 3.10+ and pip

## First-time setup

> `gen-certs.sh` installs a local CA into your system trust store and requires sudo.

```bash
./scripts/gen-certs.sh
pip install -r scripts/requirements.txt
```

Re-run `gen-certs.sh` if you clone on a new machine. Both scenarios share the same cert file.

## Stopping a scenario

```bash
docker compose -f docker-compose.<scenario>.yml down -v
```

The `-v` flag removes SQLite volumes for a clean slate.

## Utilities

| Script | Purpose |
|---|---|
| `scripts/pretty-logs.py` | Pretty-prints Docker Compose JSON log output. Pass `--color` for terminal coloring. |
| `scripts/curl-formatted.sh` | Curls a URL and pretty-prints the JSON response. Helpful for interacting with services manually. |

```bash
# Stream and pretty-print all logs for a running scenario:
docker compose -f docker-compose.<scenario>.yml logs -f \
  | python3 scripts/pretty-logs.py --color
```

## Source code

Source code (ignoring scripts) is organized into packages in the ./packages/ folder.

## Package layout

```
packages/
  shared/              # Crypto, DID resolution, VC issuance/verification
  lean-index/          # Lean index server
  agent-facts/         # Agent facts registry server
  agents/
    shared/            # AgentIdentityManager, NandaResolver — shared agent infrastructure
    trivial/           # Minimal agent used in the smoke test
    gov-local-support/ # \
    gov-business-licensing/ # |
    gov-health-dept/   #  > Food truck scenario agents
    gov-parking-dept/  # |
    food-truck-vendor/ # |
    personal-rep/      # /
```

## Limitations and natural next steps

**Single-node only.** The lean index is a single SQLite-backed server with no replication, sharding, or federation. A production system would distribute index shards and support cross-shard resolution.

**Hardcoded scenario logic.** The food truck agents auto-approve every application. A realistic implementation would encode actual business rules, validate form content, and integrate with external systems.

**No adaptive resolution.** The paper's third layer — the AdaptiveResolver for ephemeral, geo-aware, or load-balanced endpoints — is not implemented. AgentFacts currently only carries static endpoints.

**No name-based lookup.** The lean index only supports resolution by agent ID (DID). The paper describes resolution by human-readable agent name (URN); that lookup path is not yet implemented.

**No TTL enforcement or failure-driven re-resolution.** AgentAddr records carry a `ttl` field but clients never expire cached entries. A correct client implementation would treat TTLs as validity windows and trigger fresh lean-index lookups on endpoint failure, rather than failing hard.

**Each agent runs on its own server.** The prototype gives every agent a dedicated process and port. A more efficient deployment would co-host agents on their matching AgentFacts servers, reducing the number of independent services.

**TypeScript is not the right language for production.** The lean index and agent-facts registry are on the critical path for every agent interaction. At scale these need to be rewritten in a systems language (Rust or Go) to meet latency and throughput requirements.

**Uncharacterized performance.** There is no caching at any layer and no load testing has been done. Worthwhile next steps: stress-test the system, measure latency and throughput under realistic agent-swarm sizes and request rates, and identify where the prototype degrades first. The REST-over-HTTP/2 transport is a starting point; hot paths would eventually migrate to gRPC or a binary protocol, and performance-critical components would be rewritten in Rust or Go.

## Development approach

Developed with Claude Code.