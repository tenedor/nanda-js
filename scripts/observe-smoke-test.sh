#!/usr/bin/env bash
set -euo pipefail

CF="./scripts/curl-formatted.sh"

# ── Health & version ──────────────────────────────────────────────────────────

echo "=== lean-index status ==="
$CF https://localhost:8443/status
echo "=== lean-index version ==="
$CF https://localhost:8443/version

echo "=== agent-facts-1 status ==="
$CF https://localhost:8444/status
echo "=== agent-facts-1 version ==="
$CF https://localhost:8444/version

echo "=== agent-facts-2 status ==="
$CF https://localhost:8447/status
echo "=== agent-facts-2 version ==="
$CF https://localhost:8447/version

echo "=== agent-facts-private-1 status ==="
$CF https://localhost:8448/status
echo "=== agent-facts-private-1 version ==="
$CF https://localhost:8448/version

echo "=== trivial-agent-1 status ==="
$CF https://localhost:8445/status
echo "=== trivial-agent-1 version ==="
$CF https://localhost:8445/version

echo "=== trivial-agent-2 status ==="
$CF https://localhost:8446/status
echo "=== trivial-agent-2 version ==="
$CF https://localhost:8446/version

# ── DID documents ─────────────────────────────────────────────────────────────

echo "=== trivial-agent-1 DID document ==="
$CF https://localhost:8445/.well-known/did.json

echo "=== trivial-agent-2 DID document ==="
$CF https://localhost:8446/.well-known/did.json

# ── Lean-index AgentAddr ──────────────────────────────────────────────────────

echo "=== lean-index AgentAddr: trivial-agent-1 ==="
$CF "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-1%253A8445"

echo "=== lean-index AgentAddr: trivial-agent-2 ==="
$CF "https://localhost:8443/agents/did%3Aweb%3Atrivial-agent-2%253A8446"

# ── Agent facts ───────────────────────────────────────────────────────────────

echo "=== agent-facts-1 facts: trivial-agent-1 ==="
$CF "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-1%253A8445"

echo "=== agent-facts-1 facts: trivial-agent-2 ==="
$CF "https://localhost:8444/facts/did%3Aweb%3Atrivial-agent-2%253A8446"

echo "=== agent-facts-2 facts: trivial-agent-1 ==="
$CF "https://localhost:8447/facts/did%3Aweb%3Atrivial-agent-1%253A8445"

echo "=== agent-facts-2 facts: trivial-agent-2 ==="
$CF "https://localhost:8447/facts/did%3Aweb%3Atrivial-agent-2%253A8446"

echo "=== agent-facts-private-1 facts: trivial-agent-1 ==="
$CF "https://localhost:8448/facts/did%3Aweb%3Atrivial-agent-1%253A8445"

echo "=== agent-facts-private-1 facts: trivial-agent-2 ==="
$CF "https://localhost:8448/facts/did%3Aweb%3Atrivial-agent-2%253A8446"
