# Scripts

| Script | Purpose |
|---|---|
| `gen-certs.sh` | Generate TLS certs for all services using mkcert (run once per machine, requires sudo) |
| `build-all.sh` | Build all TypeScript packages in dependency order |
| `test-all.sh` | Run tests across all packages |
| `smoke_test.py` | End-to-end smoke test for the test scenario (28 checks covering resolution, VCs, and lifecycle) |
| `food_truck_citizen.py` | Citizen entry point for the food truck scenario — posts objective, polls for status |
| `observe-smoke-test.sh` | Query health, DIDs, lean-index entries, and agent facts for all smoke-test services; pass `--short` to truncate facts output |
| `pretty-logs.py` | Pretty-print Docker Compose JSON log output; pass `--color` for terminal coloring |
| `curl-formatted.sh` | Curl a URL and pretty-print the JSON response |
| `requirements.txt` | Python dependencies for the scripts (`httpx[http2]`) |
