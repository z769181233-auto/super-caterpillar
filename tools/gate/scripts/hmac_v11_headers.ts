import crypto from 'crypto';

type Input = {
  apiKey: string;
  apiSecret: string;
  timestamp: string; // MUST be 10-digit seconds (not ms)
  method: string;
  path: string;
  body: string; // exact raw body string
  nonce?: string;
};

function buildMessageV11(i: Input): string {
  // SSOT from api-security.service.ts Line 381-392
  // APISpec V1.1: X-Signature = HMAC_SHA256(api_key + nonce + timestamp + rawBody)
  // NOTE: method and path are NOT included in signature (they are params but unused)
  return i.apiKey + (i.nonce ?? '') + i.timestamp + i.body;
}

function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('missing argv[2] json');
    process.exit(2);
  }
  const i: Input = JSON.parse(raw);
  const nonce = i.nonce ?? 'gate_s3_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');

  const message = buildMessageV11({ ...i, nonce });
  const signature = crypto.createHmac('sha256', i.apiSecret).update(message).digest('hex');

  // stdout as header lines for bash parsing
  console.log(`X-Api-Key:${i.apiKey}`);
  console.log(`X-Nonce:${nonce}`);
  console.log(`X-Timestamp:${i.timestamp}`);
  console.log(`X-Signature:${signature}`);
}

main();
