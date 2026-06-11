#!/usr/bin/env python3
"""Food truck scenario — citizen script.

Sends the citizen's objective to the personal representative agent, then polls
for status updates every 3 seconds until the workflow completes or fails.

Usage (from repo root, with the food-truck scenario running):
  pip install -r scripts/requirements.txt
  python3 scripts/food_truck_citizen.py
"""

import sys
import time
import httpx

# ── Config ────────────────────────────────────────────────────────────────────

CA_CERT       = "certs/rootCA.pem"
PERSONAL_REP  = "https://localhost:8469"
DID_LOCAL_SUPPORT = "did:web:gov-local-support%3A8464"

OBJECTIVE = (
    "I want to start a food truck business. "
    "Please figure out what I need and complete the process."
)

POLL_INTERVAL = 3  # seconds

# ── HTTP client ───────────────────────────────────────────────────────────────

client = httpx.Client(http2=True, verify=CA_CERT, timeout=15)

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Food truck scenario — citizen")
    print("=" * 44)
    print(f"Personal rep: {PERSONAL_REP}")
    print(f"Objective: {OBJECTIVE}")
    print()

    # Send objective
    print("Sending objective to personal representative...")
    try:
        r = client.post(
            f"{PERSONAL_REP}/objective",
            json={
                "objective": OBJECTIVE,
                "contextDIDs": [
                    {"role": "local-government-support", "did": DID_LOCAL_SUPPORT}
                ],
            },
        )
        r.raise_for_status()
        ack = r.json().get("acknowledgement", "")
        print(f"Acknowledgement: {ack}")
    except Exception as e:
        print(f"ERROR sending objective: {e}")
        sys.exit(1)

    print()
    print("Polling for status updates (every 3s)...")
    print("-" * 44)

    last_status = ""
    while True:
        time.sleep(POLL_INTERVAL)
        try:
            r = client.get(f"{PERSONAL_REP}/status")
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"ERROR polling status: {e}")
            continue

        status = data.get("statusUpdate", "")
        is_complete = data.get("isComplete", False)
        is_failed = data.get("isFailed", False)
        completed = data.get("completedGoals", [])
        pending = data.get("pendingGoals", [])

        if status != last_status:
            print(f"Status: {status}")
            if completed:
                print(f"  Completed: {', '.join(completed)}")
            if pending:
                print(f"  Pending:   {', '.join(pending)}")
            last_status = status

        if is_complete:
            print()
            print("=" * 44)
            print("Workflow complete.")
            client.close()
            sys.exit(0)

        if is_failed:
            print()
            print("=" * 44)
            print("Workflow FAILED.")
            client.close()
            sys.exit(1)


if __name__ == "__main__":
    main()
