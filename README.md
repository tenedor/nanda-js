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

## Observing

```bash
# Service health
./scripts/curl-formatted.sh https://localhost:8443/status
./scripts/curl-formatted.sh https://localhost:8444/status

# DID documents
./scripts/curl-formatted.sh https://localhost:8445/.well-known/did.json
./scripts/curl-formatted.sh https://localhost:8446/.well-known/did.json

# Lean index entries
./scripts/curl-formatted.sh "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-1%253A8445"
./scripts/curl-formatted.sh "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-2%253A8446"

# Agent facts
./scripts/curl-formatted.sh "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-1%253A8445"
./scripts/curl-formatted.sh "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-2%253A8446"
```
