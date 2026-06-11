#!/usr/bin/env python3
"""Pretty-print structured JSON logs from NANDA services.

Reads log lines (optionally prefixed with Docker Compose's "service  | " format),
parses each JSON object, and writes formatted human-readable entries to a file.

Usage:
  # From docker compose logs output:
  docker compose -f docker-compose.food-truck.yml logs personal-rep \
    | python3 scripts/pretty-logs.py -o personal-rep.log

  # From a saved log file:
  python3 scripts/pretty-logs.py -i raw.log -o pretty.log

  # To stdout (omit -o):
  docker compose -f docker-compose.food-truck.yml logs personal-rep \
    | python3 scripts/pretty-logs.py
"""

import sys
import json
import argparse
from datetime import datetime, timezone

LEVELS = {10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL'}

# Fields handled explicitly — omitted from the generic "extra fields" block.
HANDLED = {'level', 'time', 'pid', 'hostname', 'msg', 'reqId', 'req', 'res', 'responseTime'}


def format_entry(obj: dict) -> str:
    ts_ms = obj.get('time', 0)
    ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime('%H:%M:%S.%f')[:-3]
    level = LEVELS.get(obj.get('level', 30), str(obj.get('level', '?')))
    msg = obj.get('msg', '')
    req_id = obj.get('reqId', '')

    header = f"[{ts}] {level:<5} {msg}"
    if req_id:
        header += f"  [{req_id}]"

    lines = [header]

    req = obj.get('req')
    if req:
        lines.append(f"  → {req.get('method', '?')} {req.get('url', '?')}  ({req.get('remoteAddress', '?')}:{req.get('remotePort', '?')})")

    res = obj.get('res')
    if res:
        rt = obj.get('responseTime', '')
        rt_str = f"  {rt:.1f}ms" if isinstance(rt, (int, float)) else ''
        lines.append(f"  ← {res.get('statusCode', '?')}{rt_str}")

    for key, value in obj.items():
        if key in HANDLED:
            continue
        if isinstance(value, str) and '\n' not in value and len(value) > 100:
            lines.append(f"  {key}: {value[:100]}…")
        elif isinstance(value, (dict, list)):
            lines.append(f"  {key}: {json.dumps(value)}")
        else:
            lines.append(f"  {key}: {value}")

    return '\n'.join(lines)


def process(lines, out):
    for raw in lines:
        raw = raw.rstrip('\n')
        # Strip Docker Compose "service-name  | " prefix if present.
        if '  | ' in raw:
            raw = raw.split('  | ', 1)[1]
        raw = raw.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            out.write(raw + '\n\n')
            continue
        out.write(format_entry(obj) + '\n\n')


def main():
    parser = argparse.ArgumentParser(description='Pretty-print NANDA JSON logs.')
    parser.add_argument('-i', '--input',  help='Input file (default: stdin)')
    parser.add_argument('-o', '--output', help='Output file (default: stdout)')
    args = parser.parse_args()

    in_stream  = open(args.input,  'r') if args.input  else sys.stdin
    out_stream = open(args.output, 'w') if args.output else sys.stdout

    try:
        process(in_stream, out_stream)
    finally:
        if args.input:
            in_stream.close()
        if args.output:
            out_stream.close()


if __name__ == '__main__':
    main()
