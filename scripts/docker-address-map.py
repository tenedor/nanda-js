#!/usr/bin/env python3
"""docker-address-map.py — build an IP→service-name map from a Docker Compose project.

Queries running containers via `docker inspect` and writes a JSON object
whose keys are container IP addresses and whose values are Compose service names.

Usage:
  python3 scripts/docker-address-map.py -f docker-compose.food-truck.yml -o /tmp/addr.json
  python3 scripts/docker-address-map.py -f docker-compose.food-truck.yml   # prints to stdout
"""

import sys
import json
import argparse
import subprocess


def build_address_map(compose_file: str) -> dict[str, str]:
    ids_result = subprocess.run(
        ['docker', 'compose', '-f', compose_file, 'ps', '-q'],
        capture_output=True, text=True, check=True,
    )
    container_ids = [c for c in ids_result.stdout.strip().split('\n') if c]
    if not container_ids:
        return {}

    inspect_result = subprocess.run(
        ['docker', 'inspect', '--format',
         '{{index .Config.Labels "com.docker.compose.service"}} '
         '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}']
        + container_ids,
        capture_output=True, text=True, check=True,
    )

    mapping: dict[str, str] = {}
    for line in inspect_result.stdout.strip().split('\n'):
        parts = line.split()
        if len(parts) >= 2:
            service, ip = parts[0], parts[1]
            if ip:
                mapping[ip] = service
    return mapping


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Build an IP→service-name map from a running Docker Compose project.',
    )
    parser.add_argument('-f', '--compose-file', required=True, metavar='PATH',
                        help='Docker Compose file')
    parser.add_argument('-o', '--output', metavar='PATH',
                        help='Write JSON to PATH (default: stdout)')
    args = parser.parse_args()

    try:
        mapping = build_address_map(args.compose_file)
    except subprocess.CalledProcessError as e:
        print(f"error: docker command failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not mapping:
        print("warning: no running containers found", file=sys.stderr)

    text = json.dumps(mapping, indent=2)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(text + '\n')
    else:
        print(text)


if __name__ == '__main__':
    main()
