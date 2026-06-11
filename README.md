# NANDA Prototype

A working prototype of the [NANDA](https://arxiv.org/abs/2507.14263) agent registry system. Implements the three-layer architecture from the paper: a lean index, agent facts registries, and agents that register, discover, and interact with each other using W3C Verifiable Credentials and `did:web` identities.

Two runnable scenarios are included, each with its own Docker Compose file:

| Scenario | Compose file | Description |
|---|---|---|
| [Smoke test](scenarios/test/README.md) | `docker-compose.smoke-test.yml` | Infrastructure validation with two minimal agents |
| [Food truck](scenarios/food-truck/README.md) | `docker-compose.food-truck.yml` | Multi-agent coordination: a personal rep navigates government and vendor agents to set up a food truck business |

## Prerequisites

- Docker (with Compose)
- mkcert (`brew install mkcert`)
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

The `-v` flag removes SQLite volumes for a clean slate. Omit it to resume persisted state.

## Utilities

| Script | Purpose |
|---|---|
| `scripts/pretty-logs.py` | Pretty-prints Docker Compose JSON log output. Pass `--color` for terminal coloring. |
| `scripts/curl-formatted.sh` | Curls a URL and pretty-prints the JSON response. |

```bash
# Stream and pretty-print all logs for a running scenario:
docker compose -f docker-compose.<scenario>.yml logs -f \
  | python3 scripts/pretty-logs.py --color
```

## Background

- [NANDA paper](https://arxiv.org/abs/2507.14263) — the architecture this prototype implements
- [design.md](design.md) — prototype-specific design decisions and simplifications

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
