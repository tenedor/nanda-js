#!/usr/bin/env python3
"""NANDA prototype smoke test.

Tests the full agent lifecycle: resolution, facts retrieval, invalidation,
and deregistration using the self-management endpoints on trivial agents.

Usage (from repo root, with services running):
  pip install -r scripts/requirements.txt
  python scripts/smoke_test.py
"""

import sys
import requests
from urllib.parse import quote

# ── Config ────────────────────────────────────────────────────────────────────

# Path to the mkcert root CA — run from repo root.
CA_CERT = "certs/rootCA.pem"

LEAN_INDEX  = "https://localhost:8443"
AGENT_FACTS = "https://localhost:8444"
AGENT_1     = "https://localhost:8445"
AGENT_2     = "https://localhost:8446"

# Raw DID values as stored in the database (from AGENT_DID env vars in docker-compose.yml).
# The port colon is percent-encoded as %3A within the DID itself.
DID_1 = "did:web:trivial-agent-1%3A8445"
DID_2 = "did:web:trivial-agent-2%3A8446"

# ── Helpers ───────────────────────────────────────────────────────────────────

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    _results.append((name, ok, detail))
    suffix = f": {detail}" if detail else ""
    print(f"  [{status}] {name}{suffix}")
    return ok


def get(url: str, expected_status: int = 200) -> tuple[bool, dict]:
    try:
        r = requests.get(url, verify=CA_CERT, timeout=10)
        ok = r.status_code == expected_status
        body: dict = {}
        try:
            body = r.json()
        except Exception:
            pass
        return ok, body
    except Exception as e:
        return False, {"error": str(e)}


def post(url: str, expected_status: int = 204) -> tuple[bool, dict]:
    try:
        r = requests.post(url, verify=CA_CERT, timeout=10)
        ok = r.status_code == expected_status
        body: dict = {}
        try:
            body = r.json()
        except Exception:
            pass
        return ok, body
    except Exception as e:
        return False, {"error": str(e)}


def agent_url(did: str) -> str:
    """URL for GET /agents/:id — the DID is percent-encoded for the path parameter."""
    return f"{LEAN_INDEX}/agents/{quote(did, safe='')}"


def facts_url(did: str) -> str:
    """URL for GET /facts/:id — the DID is percent-encoded for the path parameter."""
    return f"{AGENT_FACTS}/facts/{quote(did, safe='')}"


# ── Test sections ─────────────────────────────────────────────────────────────

def test_health() -> None:
    print("\n# Service health")
    services = [
        ("lean-index",     f"{LEAN_INDEX}/status"),
        ("agent-facts-1",  f"{AGENT_FACTS}/status"),
        ("trivial-agent-1", f"{AGENT_1}/status"),
        ("trivial-agent-2", f"{AGENT_2}/status"),
    ]
    for label, url in services:
        ok, body = get(url)
        check(f"{label} /status → 200", ok and "status" in body)


def test_did_documents() -> None:
    print("\n# DID documents")
    agents = [
        ("trivial-agent-1", f"{AGENT_1}/.well-known/did.json", DID_1),
        ("trivial-agent-2", f"{AGENT_2}/.well-known/did.json", DID_2),
    ]
    for label, url, expected_did in agents:
        ok, body = get(url)
        has_key = (
            ok
            and body.get("id") == expected_did
            and len(body.get("verificationMethod", [])) > 0
        )
        check(f"{label} DID document has id + verificationMethod", has_key, body.get("id", ""))


def test_lean_index_resolution() -> None:
    print("\n# Lean-index resolution")
    for label, did in [("trivial-agent-1", DID_1), ("trivial-agent-2", DID_2)]:
        ok, body = get(agent_url(did))
        valid = (
            ok
            and body.get("agentId") == did
            and "signature" in body
            and "primaryFactsUrl" in body
            and isinstance(body.get("ttl"), int)
        )
        check(f"{label} AgentAddr in lean-index", valid, body.get("agentId", ""))


def test_agent_facts_retrieval() -> None:
    print("\n# Agent facts retrieval")
    for label, did in [("trivial-agent-1", DID_1), ("trivial-agent-2", DID_2)]:
        ok, body = get(facts_url(did))
        proof = body.get("proof", {})
        subject = body.get("credentialSubject", {})
        valid = (
            ok
            and proof.get("type") == "DataIntegrityProof"
            and proof.get("cryptosuite") == "eddsa-jcs-2022"
            and subject.get("id") == did
        )
        check(f"{label} AgentFacts VC with valid proof", valid, subject.get("id", ""))


def test_invalidation_lifecycle() -> None:
    print("\n# Invalidation lifecycle (trivial-agent-1)")

    ok, _ = post(f"{AGENT_1}/self/invalidate-facts")
    check("POST /self/invalidate-facts → 204", ok)

    ok, _ = get(facts_url(DID_1), expected_status=410)
    check("GET facts → 410 after invalidation", ok)

    ok, _ = post(f"{AGENT_1}/self/restore-facts")
    check("POST /self/restore-facts → 204", ok)

    ok, body = get(facts_url(DID_1))
    check(
        "GET facts → 200 with valid proof after restore",
        ok and body.get("proof", {}).get("type") == "DataIntegrityProof",
    )


def test_deregistration_lifecycle() -> None:
    print("\n# Deregistration lifecycle (trivial-agent-1)")

    ok, _ = post(f"{AGENT_1}/self/deregister-index")
    check("POST /self/deregister-index → 204", ok)

    ok, _ = get(agent_url(DID_1), expected_status=404)
    check("GET agent → 404 after deregister", ok)

    ok, _ = post(f"{AGENT_1}/self/register-index")
    check("POST /self/register-index → 204", ok)

    ok, body = get(agent_url(DID_1))
    check(
        "GET agent → 200 with correct agentId after re-register",
        ok and body.get("agentId") == DID_1,
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("NANDA prototype smoke test")
    print("=" * 44)

    test_health()
    test_did_documents()
    test_lean_index_resolution()
    test_agent_facts_retrieval()
    test_invalidation_lifecycle()
    test_deregistration_lifecycle()

    total = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed

    print(f"\n{'=' * 44}")
    print(f"Results: {passed}/{total} passed")

    if failed:
        print("\nFailed:")
        for name, ok, detail in _results:
            if not ok:
                suffix = f": {detail}" if detail else ""
                print(f"  - {name}{suffix}")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
