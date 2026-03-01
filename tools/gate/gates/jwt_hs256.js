#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHS256(secret, headerB64, payloadB64) {
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return b64url(sig);
}

/**
 * Usage:
 *   node jwt_hs256.js <secret> <payload_json> [expiresInSec]
 *
 * Example payload_json:
 *   {"sub":"gate-tester-id","email":"gate@test.local","tier":"PRO","orgId":"p1d-org"}
 */
function main() {
  const [, , secret, payloadJson, expiresInSecArg] = process.argv;

  if (!secret) {
    console.error('ERR: missing <secret>');
    process.exit(2);
  }
  if (!payloadJson) {
    console.error('ERR: missing <payload_json>');
    process.exit(2);
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    console.error('ERR: payload_json is not valid JSON');
    process.exit(2);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresInSec = expiresInSecArg ? parseInt(expiresInSecArg, 10) : 3600;
  if (!Number.isFinite(expiresInSec) || expiresInSec <= 0) {
    console.error('ERR: expiresInSec must be a positive integer');
    process.exit(2);
  }

  // Minimal required claims for your JwtStrategy: sub/email/tier/orgId
  payload.iat = payload.iat ?? now;
  payload.exp = payload.exp ?? now + expiresInSec;

  const header = { alg: 'HS256', typ: 'JWT' };

  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const sigB64 = signHS256(secret, headerB64, payloadB64);

  process.stdout.write(`${headerB64}.${payloadB64}.${sigB64}`);
}

main();
