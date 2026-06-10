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

LEAN_INDEX      = "https://localhost:8443"
AGENT_FACTS     = "https://localhost:8444"  # agent-facts-1
AGENT_FACTS_2   = "https://localhost:8447"  # agent-facts-2
AGENT_FACTS_PVT = "https://localhost:8448"  # agent-facts-private-1
AGENT_1         = "https://localhost:8445"
AGENT_2         = "https://localhost:8446"

# Docker-internal base URLs used in migration request bodies (called from inside Docker).
AF1_DOCKER = "https://agent-facts-1:8444"
AF2_DOCKER = "https://agent-facts-2:8447"
AF_PVT_DOCKER = "https://agent-facts-private-1:8448"

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


def post(url: str, expected_status: int = 204, json_body: dict | None = None) -> tuple[bool, dict]:
    try:
        kwargs: dict = {"verify": CA_CERT, "timeout": 10}
        if json_body is not None:
            kwargs["json"] = json_body
        r = requests.post(url, **kwargs)
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
        ("lean-index",            f"{LEAN_INDEX}/status"),
        ("agent-facts-1",         f"{AGENT_FACTS}/status"),
        ("agent-facts-2",         f"{AGENT_FACTS_2}/status"),
        ("agent-facts-private-1", f"{AGENT_FACTS_PVT}/status"),
        ("trivial-agent-1",       f"{AGENT_1}/status"),
        ("trivial-agent-2",       f"{AGENT_2}/status"),
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


def test_migrate_primary_facts() -> None:
    print("\n# Primary facts server migration (trivial-agent-1: agent-facts-1 → agent-facts-2)")

    ok, _ = post(f"{AGENT_1}/self/migrate-facts", json_body={"primaryFactsServerUrl": AF2_DOCKER})
    check("POST /self/migrate-facts (primary af1 → af2) → 204", ok)

    # Facts should now be on agent-facts-2.
    ok, body = get(f"{AGENT_FACTS_2}/facts/{quote(DID_1, safe='')}")
    check("GET facts from agent-facts-2 → 200 after migration", ok and "proof" in body)

    # Old primary should be invalidated.
    ok, _ = get(f"{AGENT_FACTS}/facts/{quote(DID_1, safe='')}", expected_status=410)
    check("GET facts from agent-facts-1 → 410 after migration", ok)

    # AgentAddr in lean-index should point to agent-facts-2.
    ok, body = get(agent_url(DID_1))
    primary_url = body.get("primaryFactsUrl", "")
    check(
        "lean-index AgentAddr primaryFactsUrl updated to agent-facts-2",
        ok and "agent-facts-2" in primary_url,
        primary_url,
    )


def test_add_private_facts_server() -> None:
    print("\n# Add private facts server (trivial-agent-2: + agent-facts-private-1)")

    ok, _ = post(
        f"{AGENT_2}/self/migrate-facts",
        json_body={
            "primaryFactsServerUrl": AF1_DOCKER,
            "privateFactsServerUrl": AF_PVT_DOCKER,
        },
    )
    check("POST /self/migrate-facts (add private) → 204", ok)

    # Primary facts should remain on agent-facts-1.
    ok, body = get(f"{AGENT_FACTS}/facts/{quote(DID_2, safe='')}")
    check("GET facts from agent-facts-1 still 200 after adding private", ok and "proof" in body)

    # Facts should also be on the private server.
    ok, body = get(f"{AGENT_FACTS_PVT}/facts/{quote(DID_2, safe='')}")
    check("GET facts from agent-facts-private-1 → 200 after adding private", ok and "proof" in body)

    # AgentAddr should now include a privateFactsUrl.
    ok, body = get(agent_url(DID_2))
    private_url = body.get("privateFactsUrl", "")
    check(
        "lean-index AgentAddr has privateFactsUrl pointing to agent-facts-private-1",
        ok and "agent-facts-private-1" in private_url,
        private_url,
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
    test_migrate_primary_facts()
    test_add_private_facts_server()
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
