# Food Truck Scenario

This scenario shows a citizen getting their personal representative agent's help setting up a food truck business. Starting from a single government support contact, the citizen's agent discovers agents representing the various government and commercial services it needs to coordinate with and it researches, plans, and executes the steps to acquire the necessary licenses and permits to open the business. This demo illustrates key technologies like finding agents using a NANDA index and requiring cryptographically verifiable evidence of stakeholder approvals. That said, the demo skips details like confirming user permission for sensitive actions or waiting for a real-world health inspection to occur.

## The Scenario Play-By-Play

The citizen sends a single message: start a food truck business. The personal rep immediately acknowledges and gets to work.

First, it resolves the one contact it was given — the local government support agent — by querying the NANDA lean index, fetching the agent's verifiable facts, then calling the agent directly to ask what agencies are involved.

With three new contacts in hand — business licensing, the parking department, and a food truck vendor — it fans out to research requirements from each, building up a complete picture of the dependency chain.

Then it executes. Business registration first — no prerequisites. Provisional license next, presenting the registration credential. Truck rental in parallel, also using that registration. Health inspection, presenting the rental. Final license, presenting the provisional license and inspection approval. Street vending permit last, presenting the final license and rental together.

To go deeper:
- [agent-apis.md](agent-apis.md) shows the complete API definitions.
- [scenario-script.md](scenario-script.md) describes the exact step-by-step interaction sequence.
- [logs/](logs/) contains full logs from a run of the simulation, including pre-rendered pretty-printed views. `cat` the colored personal rep log or open the no-color version in an editor.
- Or run it yourself! See below.

## Services (ports 8460–8469)

| Service | Port | Role |
|---|---|---|
| lean-index | 8460 | NANDA lean index |
| government-facts | 8461 | Agent facts for government agents |
| personal-agents-facts | 8462 | Agent facts for the personal rep |
| vendor-facts | 8463 | Agent facts for the vendor |
| gov-local-support | 8464 | Government local business support |
| gov-business-licensing | 8465 | Business licensing office |
| gov-health-dept | 8466 | Health department |
| gov-parking-dept | 8467 | Parking department |
| food-truck-vendor | 8468 | Food truck vendor |
| personal-rep | 8469 | Citizen's personal representative |

## Running

```bash
docker compose -f docker-compose.food-truck.yml up --build
```

Wait for `personal-rep registered` in the logs — this confirms all services are up and registered in the lean index. Then in a second terminal:

```bash
python3 scripts/food_truck_citizen.py
```

The citizen script posts the objective and polls for status every 3 seconds. The full workflow completes in 1–2 seconds; you'll see incremental status messages as the personal rep progresses through each step.

## Observing

**Warning:** The most reliable way to ensure logs remain in order is to run these commands before running the python script, not after-the-fact.

Stream pretty-printed logs from all services:

```bash
python3 scripts/docker-address-map.py -f docker-compose.food-truck.yml -o /tmp/addr.json
docker compose -f docker-compose.food-truck.yml logs -f \
  | python3 scripts/pretty-logs.py --color --address-map /tmp/addr.json
```

The address map step resolves internal container IPs to service names in the log output. Run it once after the containers are up; re-run it after a `down -v` restart.

Watch just the personal rep (status updates + incoming requests):

```bash
docker compose -f docker-compose.food-truck.yml logs -f personal-rep \
  | python3 scripts/pretty-logs.py --color
```

Query the personal rep's current task state at any time:

```bash
./scripts/curl-formatted.sh https://localhost:8469/task-status
```

Look up any agent in the lean index (replace the DID as needed):

```bash
./scripts/curl-formatted.sh "https://localhost:8460/agents/did%3Aweb%3Apersonal-rep%253A8469"
./scripts/curl-formatted.sh "https://localhost:8460/agents/did%3Aweb%3Agov-business-licensing%253A8465"
```
