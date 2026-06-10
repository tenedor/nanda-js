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

## Observing

```bash
# Service health
curl -k https://localhost:8443/status   # lean-index
curl -k https://localhost:8444/status   # agent-facts-1

# DID documents
curl -k https://localhost:8445/.well-known/did.json   # trivial-agent-1
curl -k https://localhost:8446/.well-known/did.json   # trivial-agent-2

# Lean index entries
curl -k "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-1%253A8445"
curl -k "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-2%253A8446"

# Agent facts
curl -k "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-1%253A8445"
curl -k "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-2%253A8446"
```
