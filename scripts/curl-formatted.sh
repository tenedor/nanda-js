#!/usr/bin/env bash
set -euo pipefail
curl -sk "$1" | python3 -m json.tool
