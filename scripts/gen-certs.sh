#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERTS_DIR="$REPO_ROOT/certs"

mkdir -p "$CERTS_DIR"

# Unset JAVA_HOME to prevent mkcert from attempting the Java keystore,
# which fails when no JDK is configured and causes mkcert to abort.
JAVA_HOME="" mkcert -install

JAVA_HOME="" mkcert \
  -cert-file "$CERTS_DIR/cert.pem" \
  -key-file  "$CERTS_DIR/key.pem" \
  lean-index \
  agent-facts-1 \
  agent-facts-2 \
  agent-facts-private-1 \
  trivial-agent-1 \
  trivial-agent-2 \
  localhost \
  127.0.0.1

[[ -f "$CERTS_DIR/cert.pem" ]] || { echo "ERROR: cert.pem was not created" >&2; exit 1; }

cp "$(mkcert -CAROOT)/rootCA.pem" "$CERTS_DIR/rootCA.pem"

echo "Certs written to $CERTS_DIR/"
