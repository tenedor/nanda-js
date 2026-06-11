# Food Truck Scenario

A citizen wants to start a food truck business and asks their personal representative agent to handle all the paperwork. The personal rep begins with only a single contact — the local government business support agent — and discovers all other required agents through NANDA resolution. It autonomously navigates the dependency chain: business registration → provisional restaurant license → food truck rental → health inspection → final restaurant license → street vending permit. The scenario demonstrates multi-agent coordination with cross-agent credential dependencies, NANDA discovery (lean index → AgentFacts → endpoint), and W3C Verifiable Credential issuance and verification across six agents running on three separate agent-facts registries. The citizen interacts only with the personal rep, polling for status updates while the rep drives the workflow to completion.

## Services

| Service | Port | Role |
|---|---|---|
| lean-index | 8460 | NANDA lean index |
| government-facts | 8461 | Agent facts registry for government agents |
| personal-agents-facts | 8462 | Agent facts registry for personal agents |
| vendor-facts | 8463 | Agent facts registry for vendor agents |
| gov-local-support | 8464 | Government local business support agent |
| gov-business-licensing | 8465 | Government business licensing office agent |
| gov-health-dept | 8466 | Government health department agent |
| gov-parking-dept | 8467 | Government parking department agent |
| food-truck-vendor | 8468 | Private food truck vendor agent |
| personal-rep | 8469 | Citizen's personal representative agent |

## Citizen script

The script `scripts/food_truck_citizen.py` sends the citizen's objective to the personal rep, kicking off this scenario. The script then polls for status every 3 seconds until the personal rep agent achieves the objective or gets blocked.

## Setup

```bash
pip install -r scripts/requirements.txt
```

## Running

For the best visibility, run this scenario with 3 terminals:

1. **Terminal 1:** `docker compose -f docker-compose.food-truck.yml up --build`
  - Note: If you're worried about overwhelming the machine resources with parallel build, run this command instead: `COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.food-truck.yml up --build`
2. **Terminal 2:** `docker compose -f docker-compose.food-truck.yml logs -f personal-rep`
3. Wait for `personal-rep registered` in the logs before continuing. This is the signal that all services have built and come online.
4. **Terminal 3:** `python3 scripts/food_truck_citizen.py`
5. The food truck scenario will now play out. Logs from all services and from just the personal-rep agent will stream in terminals 1 and 2, respectively.
6. When done, ctrl-C the active sessions and run `docker compose -f docker-compose.food-truck.yml down -v`
