#!/usr/bin/env bash
# [GATE] gate-infra-health-check.sh
# Purpose: Verify Staging Infrastructure (TLS/HTTPS) before P9.2 Unlock
set -euo pipefail

DOMAIN="${DOMAIN:-staging.scu.app}"
PATH_PROBE="${PATH_PROBE:-/zh}"
HEALTH_URL="https://${DOMAIN}${PATH_PROBE}"
# Default evidence archive if not provided
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_OUT="${EVIDENCE_OUT:-docs/_evidence/p9_release/infra_health_${TIMESTAMP}.txt}"

echo "==== [GATE] Infra Health Check Starting ===="
echo "DOMAIN: ${DOMAIN}"
echo "URL:    ${HEALTH_URL}"

tmp="$(mktemp -t infra_health_XXXXXX)"
trap 'rm -f "$tmp"' EXIT

# Write boot header immediately
echo "[BOOT] $(date -Iseconds) DOMAIN=${DOMAIN} URL=${HEALTH_URL}" >> "$tmp"

function archive_evidence() {
  if [ -n "${EVIDENCE_OUT}" ]; then
    mkdir -p "$(dirname "${EVIDENCE_OUT}")"
    cp "$tmp" "${EVIDENCE_OUT}"
    echo "[INFO] Evidence archived to: ${EVIDENCE_OUT}"
  fi
}

# 0) Dependency Check
command -v openssl >/dev/null 2>&1 || { echo "❌ [ERROR] openssl not found" | tee -a "$tmp"; archive_evidence; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "❌ [ERROR] curl not found" | tee -a "$tmp"; archive_evidence; exit 2; }

# 1) TLS Handshake + ALPN Probe (must produce Protocol/Cipher and no alert)
echo "[1/3] Probing TLS Handshake (SNI + ALPN h2,http/1.1)..."
echo "--- OpenSSL s_client ---" >> "$tmp"
openssl s_client \
  -connect "${DOMAIN}:443" \
  -servername "${DOMAIN}" \
  -alpn "h2,http/1.1" \
  -showcerts </dev/null >>"$tmp" 2>&1 || true

# Hard-fail patterns
if grep -qiE "alert|handshake failure|no peer certificate|wrong version number|unknown protocol" "$tmp"; then
  echo "❌ [ERROR] TLS handshake contains fatal signals:"
  grep -i -C 2 -E "alert|handshake failure|no peer certificate|wrong version number|unknown protocol" "$tmp" || true
  archive_evidence
  exit 1
fi

# Must-have signals
if ! grep -qE "^Protocol *:" "$tmp"; then
  echo "❌ [ERROR] Missing 'Protocol:' in openssl output (handshake not established)."
  archive_evidence
  exit 1
fi
if ! grep -qE "^Cipher *:" "$tmp"; then
  echo "❌ [ERROR] Missing 'Cipher:' in openssl output (handshake not established)."
  archive_evidence
  exit 1
fi

# ALPN is optional but should be visible when negotiated; print any evidence
grep -E "Protocol|Cipher|ALPN protocol" "$tmp" || true

# 2) Certificate Chain Integrity (verify + subject must exist)
echo "[2/3] Checking Certificate Chain..."
if ! grep -qE "Verify return code: 0 \(ok\)" "$tmp"; then
  echo "❌ [ERROR] Certificate verify not OK:"
  grep -iE "Verify return code:" "$tmp" || true
  archive_evidence
  exit 1
fi
if ! grep -qE "^subject=" "$tmp"; then
  echo "❌ [ERROR] Missing certificate subject (likely wrong server block / default_server)."
  archive_evidence
  exit 1
fi
echo "✅ [PASS] TLS handshake + certificate verified."
grep -E "^subject=" "$tmp" | head -n 1 || true

# 3) HTTP Response Status (2xx/3xx only) + timeouts + retries
echo "[3/3] Probing HTTP Response..."
# Add full verbose info to evidence for audit
echo "--- Verbose Curl Info ---" >> "$tmp"
curl -Iv --connect-timeout 5 --max-time 15 "${HEALTH_URL}" 2>&1 >> "$tmp" || true

HTTP_STATUS="$(curl -sS -o /dev/null -w "%{http_code}" \
  --connect-timeout 5 --max-time 15 \
  --retry 2 --retry-delay 1 --retry-connrefused \
  "${HEALTH_URL}" || true)"

if [[ "$HTTP_STATUS" =~ ^2[0-9]{2}$ || "$HTTP_STATUS" =~ ^3[0-9]{2}$ ]]; then
  echo "✅ [PASS] HTTP Response: ${HTTP_STATUS}"
else
  echo "❌ [ERROR] Unusual HTTP Status (or curl failure): ${HTTP_STATUS:-<empty>}"
  archive_evidence
  exit 1
fi

archive_evidence
echo "==== [GATE] SUMMARY: Infra UNLOCK READY ===="
exit 0
