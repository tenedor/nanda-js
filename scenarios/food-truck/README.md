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

## Running

```bash
docker compose -f docker-compose.food-truck.yml up --build
```

## Citizen script

```bash
pip install -r scripts/requirements.txt
python3 scripts/food_truck_citizen.py
```

The script sends the citizen's objective to the personal rep and polls for status every 3 seconds until complete.
