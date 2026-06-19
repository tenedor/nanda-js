#!/usr/bin/env python3
"""pretty-logs.py — pretty-printer for NANDA Docker Compose logs.

Handles all line types in multi-service compose output:
  - Container health state lines  (Waiting / Healthy / Starting / ...)
  - JSON structured log lines     (pino/fastify format)
  - Plain text service lines      (node warnings, etc.)

Usage:
  docker compose -f docker-compose.food-truck.yml logs -f \
    | python3 scripts/pretty-logs.py --color

  python3 scripts/pretty-logs.py -i raw.log [-o pretty.log] [--color]
"""

import re
import sys
import json
import argparse
from datetime import datetime, timezone
from urllib.parse import urlparse, unquote

# ── Constants ─────────────────────────────────────────────────────────────────

LEVELS = {10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL'}

# Fields handled explicitly; excluded from the generic extra-field block.
CORE_FIELDS = {
    'level', 'time', 'pid', 'hostname', 'msg', 'reqId',
    'req', 'res', 'responseTime', 'statusUpdate', 'version',
    'direction', 'kind', 'url', 'method', 'body',
    'remoteIp', 'localIp', 'statusCode', 'status',
}

# ── ANSI helpers ──────────────────────────────────────────────────────────────

RESET         = '\033[0m'
BOLD          = '\033[1m'
DIM           = '\033[2m'
CYAN          = '\033[36m'
GREEN         = '\033[32m'
YELLOW        = '\033[33m'
RED           = '\033[31m'
BRIGHT_RED    = '\033[91m'
BRIGHT_GREEN  = '\033[92m'
BRIGHT_YELLOW = '\033[93m'
BRIGHT_CYAN   = '\033[96m'
BRIGHT_MAGENTA = '\033[95m'

LEVEL_COLOR = {
    'TRACE': DIM, 'DEBUG': DIM, 'INFO': GREEN,
    'WARN': YELLOW, 'ERROR': RED, 'FATAL': BRIGHT_RED,
}

HEALTH_COLOR = {
    'Healthy': BRIGHT_GREEN, 'Waiting': YELLOW,
    'Starting': YELLOW, 'Unhealthy': BRIGHT_RED,
}


def c(text, *codes, use_color=False):
    if not use_color or not codes:
        return text
    return ''.join(codes) + str(text) + RESET


def status_code_color(code, use_color):
    s = str(code)
    if not use_color:
        return s
    if isinstance(code, int):
        if code < 300:
            return c(s, BRIGHT_GREEN, use_color=True)
        if code < 500:
            return c(s, BRIGHT_YELLOW, use_color=True)
        return c(s, BRIGHT_RED, use_color=True)
    return s


# ── Timestamp ─────────────────────────────────────────────────────────────────

def fmt_ts(ts_ms):
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime('%H:%M:%S.%f')[:-3]


# ── URL helpers ───────────────────────────────────────────────────────────────

def split_url(url):
    """Split 'https://host:port/path' into ('host:port', '/path')."""
    parsed = urlparse(url)
    peer = parsed.netloc
    path = parsed.path or '/'
    if parsed.query:
        path += '?' + parsed.query
    return peer, path


def trim_path(path):
    """Decode percent-encoding in a path for readability; trim if very long."""
    decoded = unquote(path)
    return decoded[:100] + '…' if len(decoded) > 100 else decoded


# ── Line classifiers ─────────────────────────────────────────────────────────

CONTAINER_RE = re.compile(r'^Container\s+(\S+)\s+(\S+)\s*$')
SERVICE_RE   = re.compile(r'^(\S+?)\s+\|\s(.*)$')


def classify(raw):
    """Return ('container', name, state) | ('service', name, payload) | ('other', raw)."""
    m = CONTAINER_RE.match(raw)
    if m:
        return ('container', m.group(1), m.group(2))
    m = SERVICE_RE.match(raw)
    if m:
        name = re.sub(r'-\d+$', '', m.group(1))
        return ('service', name, m.group(2).strip())
    return ('other', raw, '')


# ── Formatters ────────────────────────────────────────────────────────────────

def fmt_container(name, state, use_color):
    state_color = HEALTH_COLOR.get(state, '')
    label  = c('[container]', DIM, use_color=use_color)
    name_s = c(name, DIM, use_color=use_color)
    state_s = c(state, state_color, use_color=use_color) if use_color and state_color else state
    return f"{label} {name_s}  {state_s}"


def fmt_plain(service, text, use_color):
    svc    = c(f"[{service}]", DIM, use_color=use_color) if service else ''
    text_s = c(text, DIM, use_color=use_color)
    prefix = f"{svc} " if svc else ''
    return f"{prefix}{text_s}"


def fmt_network(obj, ts_s, svc_s, use_color):
    """Format an inbound or outbound network request/response log entry."""
    direction = obj['direction']   # 'sent' | 'received'
    kind      = obj['kind']        # 'request' | 'response'
    method    = obj.get('method', '?')
    body      = obj.get('body')
    req_id    = obj.get('reqId', '')
    id_s      = (' ' + c(f"[{req_id}]", DIM, use_color=use_color)) if req_id else ''

    if direction == 'sent' and kind == 'request':
        # This service is sending an outbound request.
        label_s  = c('OUT/REQ', CYAN, use_color=use_color)
        arrow_s  = c('→', CYAN, use_color=use_color)
        peer, path = split_url(obj.get('url', ''))
        peer_s   = c(peer, DIM, use_color=use_color)
        status_s = ''

    elif direction == 'received' and kind == 'response':
        # This service received a response to an outbound request.
        label_s  = c('OUT/REPLY', DIM, use_color=use_color)
        arrow_s  = c('←', DIM, use_color=use_color)
        peer, path = split_url(obj.get('url', ''))
        peer_s   = c(peer, DIM, use_color=use_color)
        status   = obj.get('status')
        status_s = ('  ' + status_code_color(status, use_color)) if status is not None else ''

    elif direction == 'received' and kind == 'request':
        # This service received an inbound request.
        label_s  = c('IN/REQ', BRIGHT_MAGENTA, use_color=use_color)
        arrow_s  = c('←', BRIGHT_MAGENTA, use_color=use_color)
        peer_s   = c(obj.get('remoteIp', '?'), DIM, use_color=use_color)
        path     = obj.get('url', '?')
        status_s = ''

    else:
        # direction == 'sent' and kind == 'response'
        # This service is sending a reply to an inbound request.
        label_s  = c('IN/REPLY', GREEN, use_color=use_color)
        arrow_s  = c('→', GREEN, use_color=use_color)
        peer_s   = c(obj.get('remoteIp', '?'), DIM, use_color=use_color)
        path     = obj.get('url', '?')
        status   = obj.get('statusCode')
        status_s = ('  ' + status_code_color(status, use_color)) if status is not None else ''

    method_s = c(method, CYAN, use_color=use_color)
    path_s   = c(trim_path(path), BRIGHT_CYAN, use_color=use_color)
    header   = f"{ts_s} {svc_s}{label_s} {arrow_s} {peer_s}{id_s}{status_s}  {method_s} {path_s}"

    lines = [header]
    if body is not None:
        body_s = json.dumps(body, separators=(',', ':')) if isinstance(body, (dict, list)) else str(body)
        key_s  = c('  body:', DIM, use_color=use_color)
        lines.append(f"{key_s} {body_s}")

    return '\n'.join(lines)


def fmt_json(obj, service, use_color):
    ts_ms      = obj.get('time', 0)
    ts         = fmt_ts(ts_ms) if ts_ms else '??:??:??.???'
    level_name = LEVELS.get(obj.get('level', 30), str(obj.get('level', '?')))
    msg        = obj.get('msg', '')

    ts_s  = c(f"[{ts}]", DIM, use_color=use_color)
    svc_s = (c(f"[{service}]", BOLD, use_color=use_color) + ' ') if service else ''

    # ── Network request/response logs ─────────────────────────────────────────
    if obj.get('direction') and obj.get('kind'):
        return fmt_network(obj, ts_s, svc_s, use_color)

    # ── Status update (personal-rep workflow progress) ────────────────────────
    if 'statusUpdate' in obj:
        level_s  = c(f"{level_name:<5}", LEVEL_COLOR.get(level_name, ''), use_color=use_color)
        msg_s    = c(msg, BOLD, use_color=use_color)
        update_s = c(obj['statusUpdate'], BOLD, '\033[34m', use_color=use_color)
        return f"{ts_s} {svc_s}{level_s} {msg_s}\n  {update_s}"

    # ── Generic JSON entry ────────────────────────────────────────────────────
    req_id  = obj.get('reqId', '')
    id_s    = (' ' + c(f"[{req_id}]", DIM, use_color=use_color)) if req_id else ''
    level_s = c(f"{level_name:<5}", LEVEL_COLOR.get(level_name, ''), use_color=use_color)
    msg_s   = c(msg, BOLD, use_color=use_color)
    version = obj.get('version', '')
    ver_s   = (' ' + c(f"({version})", DIM, use_color=use_color)) if version else ''
    lines   = [f"{ts_s} {svc_s}{level_s} {msg_s}{ver_s}{id_s}"]

    for key, value in obj.items():
        if key in CORE_FIELDS:
            continue
        key_s = c(f"  {key}:", DIM, use_color=use_color)
        if isinstance(value, str) and len(value) > 80:
            lines.append(f"{key_s} {value[:80]}…")
        elif isinstance(value, (dict, list)):
            lines.append(f"{key_s} {json.dumps(value)}")
        else:
            lines.append(f"{key_s} {value}")

    return '\n'.join(lines)


# ── Main processing ───────────────────────────────────────────────────────────

def process(lines, out, use_color=False):
    for raw in lines:
        raw = raw.rstrip('\n')
        if not raw.strip():
            continue

        line_type, name, payload = classify(raw)

        if line_type == 'container':
            out.write(fmt_container(name, payload, use_color) + '\n')

        elif line_type == 'service':
            try:
                obj = json.loads(payload)
                out.write(fmt_json(obj, name, use_color) + '\n\n')
            except json.JSONDecodeError:
                out.write(fmt_plain(name, payload, use_color) + '\n')

        else:
            out.write(c(raw, DIM, use_color=use_color) + '\n')


def main():
    parser = argparse.ArgumentParser(description='Pretty-print NANDA JSON logs.')
    parser.add_argument('-i', '--input',  help='Input file (default: stdin)')
    parser.add_argument('-o', '--output', help='Output file (default: stdout)')
    parser.add_argument('--color', action='store_true', help='Colorize output with ANSI codes')
    args = parser.parse_args()

    in_s  = open(args.input,  'r') if args.input  else sys.stdin
    out_s = open(args.output, 'w') if args.output else sys.stdout

    try:
        process(in_s, out_s, use_color=args.color)
    finally:
        if args.input:
            in_s.close()
        if args.output:
            out_s.close()


if __name__ == '__main__':
    main()
