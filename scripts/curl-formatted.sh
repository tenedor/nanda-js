#!/usr/bin/env bash
set -euo pipefail
curl -k "$1" | python3 -m json.tool
