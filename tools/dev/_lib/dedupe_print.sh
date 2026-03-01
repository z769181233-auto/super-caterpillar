#!/usr/bin/env bash
set -euo pipefail

# Dedupe strategy:
# 1) Collapse consecutive identical lines
# 2) Additionally, collapse repeated large blocks using a rolling hash window (simple and safe)
#
# This is a LAST-LINE DEFENSE for evidence/log output so upstream accidental re-dumps
# do not pollute audit logs.

python3 -c "$(
cat <<'PY'
import sys, hashlib

data = sys.stdin.read().splitlines(True)  # keep line endings
if not data:
    sys.exit(0)

# 1) collapse consecutive identical lines
collapsed = []
prev = None
for line in data:
    if line == prev:
        continue
    collapsed.append(line)
    prev = line

# 2) collapse repeated blocks: detect repeated chunks by exact hash of block between blank-line separators
# split by 2+ newlines as blocks
text = "".join(collapsed)
blocks = []
buf = []
nl_run = 0
for ch in text:
    buf.append(ch)
    if ch == "\\n":
        nl_run += 1
    else:
        nl_run = 0
    if nl_run >= 2:
        blocks.append("".join(buf))
        buf = []
        nl_run = 0
if buf:
    blocks.append("".join(buf))

seen = set()
out = []
for b in blocks:
    h = hashlib.sha256(b.encode("utf-8", errors="replace")).hexdigest()
    if h in seen:
        continue
    seen.add(h)
    out.append(b)

sys.stdout.write("".join(out))
PY
)"
