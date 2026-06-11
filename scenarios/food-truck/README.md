# Food Truck Scenario

A citizen asks their personal representative agent to set up a food truck business. The personal rep starts with a single contact — the government local business support agent — and discovers all others through NANDA resolution (lean index → AgentFacts → endpoint). It autonomously acquires credentials in dependency order: business registration → provisional restaurant license → food truck rental → health inspection approval → final restaurant license → street vending permit. Each credential is issued as a W3C VerifiableCredential and verified by the receiving agent before proceeding.

For the complete API definitions and step-by-step interaction sequence, see [agent-apis.md](agent-apis.md) and [scenario-script.md](scenario-script.md).

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

Stream pretty-printed logs from all services:

```bash
docker compose -f docker-compose.food-truck.yml logs -f \
  | python3 scripts/pretty-logs.py --color
```

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
