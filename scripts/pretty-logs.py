#!/usr/bin/env python3
"""Pretty-print structured JSON logs from NANDA services.

Reads log lines (optionally prefixed with Docker Compose's "service  | " format),
parses each JSON object, and writes formatted human-readable entries to a file.

Usage:
  # Live stream with color:
  docker compose -f docker-compose.food-truck.yml logs personal-rep \
    | python3 scripts/pretty-logs.py --color

  # Save to file (no color codes in output):
  docker compose -f docker-compose.food-truck.yml logs personal-rep \
    | python3 scripts/pretty-logs.py -o personal-rep.log

  # From a saved log file:
  python3 scripts/pretty-logs.py -i raw.log -o pretty.log
"""

import sys
import json
import argparse
from datetime import datetime, timezone

LEVELS = {10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL'}

HANDLED = {'level', 'time', 'pid', 'hostname', 'msg', 'reqId', 'req', 'res', 'responseTime'}

# ── ANSI color codes ──────────────────────────────────────────────────────────

RESET  = '\033[0m'
BOLD   = '\033[1m'
DIM    = '\033[2m'
CYAN   = '\033[36m'
GREEN  = '\033[32m'
YELLOW = '\033[33m'
RED    = '\033[31m'
BRIGHT_RED    = '\033[91m'
BRIGHT_GREEN  = '\033[92m'
BRIGHT_YELLOW = '\033[93m'
BRIGHT_CYAN   = '\033[96m'

LEVEL_COLOR = {
    'TRACE': DIM,
    'DEBUG': DIM,
    'INFO':  GREEN,
    'WARN':  YELLOW,
    'ERROR': RED,
    'FATAL': BRIGHT_RED,
}


def c(text: str, *codes: str, use_color: bool = False) -> str:
    if not use_color or not codes:
        return text
    return ''.join(codes) + text + RESET


def status_color(code: int, use_color: bool) -> str:
    if not use_color:
        return str(code)
    if code < 300:
        return c(str(code), BRIGHT_GREEN, use_color=True)
    if code < 500:
        return c(str(code), BRIGHT_YELLOW, use_color=True)
    return c(str(code), BRIGHT_RED, use_color=True)


def format_entry(obj: dict, use_color: bool = False) -> str:
    ts_ms = obj.get('time', 0)
    ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime('%H:%M:%S.%f')[:-3]
    level_name = LEVELS.get(obj.get('level', 30), str(obj.get('level', '?')))
    msg = obj.get('msg', '')
    req_id = obj.get('reqId', '')

    ts_str    = c(f"[{ts}]", DIM, use_color=use_color)
    level_str = c(f"{level_name:<5}", LEVEL_COLOR.get(level_name, ''), use_color=use_color)
    msg_str   = c(msg, BOLD, use_color=use_color)
    id_str    = c(f"  [{req_id}]", DIM, use_color=use_color) if req_id else ''

    lines = [f"{ts_str} {level_str} {msg_str}{id_str}"]

    req = obj.get('req')
    if req:
        method = c(req.get('method', '?'), CYAN, use_color=use_color)
        url    = c(req.get('url', '?'), BRIGHT_CYAN, use_color=use_color)
        addr   = c(f"({req.get('remoteAddress', '?')}:{req.get('remotePort', '?')})", DIM, use_color=use_color)
        arrow  = c('→', CYAN, use_color=use_color)
        lines.append(f"  {arrow} {method} {url}  {addr}")

    res = obj.get('res')
    if res:
        code = res.get('statusCode', '?')
        code_str = status_color(code, use_color) if isinstance(code, int) else str(code)
        rt = obj.get('responseTime', '')
        rt_str = c(f"  {rt:.1f}ms", DIM, use_color=use_color) if isinstance(rt, (int, float)) else ''
        arrow = c('←', DIM, use_color=use_color)
        lines.append(f"  {arrow} {code_str}{rt_str}")

    for key, value in obj.items():
        if key in HANDLED:
            continue
        key_str = c(f"  {key}:", DIM, use_color=use_color)
        if isinstance(value, str) and '\n' not in value and len(value) > 100:
            lines.append(f"{key_str} {value[:100]}…")
        elif isinstance(value, (dict, list)):
            lines.append(f"{key_str} {json.dumps(value)}")
        else:
            lines.append(f"{key_str} {value}")

    return '\n'.join(lines)


def process(lines, out, use_color: bool = False):
    for raw in lines:
        raw = raw.rstrip('\n')
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
        out.write(format_entry(obj, use_color=use_color) + '\n\n')


def main():
    parser = argparse.ArgumentParser(description='Pretty-print NANDA JSON logs.')
    parser.add_argument('-i', '--input',  help='Input file (default: stdin)')
    parser.add_argument('-o', '--output', help='Output file (default: stdout)')
    parser.add_argument('--color', action='store_true', help='Colorize output using ANSI codes')
    args = parser.parse_args()

    in_stream  = open(args.input,  'r') if args.input  else sys.stdin
    out_stream = open(args.output, 'w') if args.output else sys.stdout

    try:
        process(in_stream, out_stream, use_color=args.color)
    finally:
        if args.input:
            in_stream.close()
        if args.output:
            out_stream.close()


if __name__ == '__main__':
    main()
