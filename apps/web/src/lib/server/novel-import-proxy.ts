import { createHash, createHmac, randomUUID } from 'crypto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function requireEnv(name: string): string {
  const fallbackValues: Record<string, string | undefined> = {
    WORKER_API_KEY: process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000',
    HMAC_SECRET_KEY:
      process.env.HMAC_SECRET_KEY ||
      process.env.WORKER_API_SECRET ||
      'sk_worker_dev_8cd1350dca488c7cfc1a2c970b65a2c8',
  };
  const value = process.env[name] || fallbackValues[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function buildSignedHeaders(
  body: string,
  contentSha256: string,
  contentType?: string
): Record<string, string> {
  const apiKey = requireEnv('WORKER_API_KEY');
  const hmacSigningKey = requireEnv('HMAC_SECRET_KEY');
  const nonce = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const canonical = `${apiKey}${nonce}${timestamp}${body || contentSha256}`;
  // NOTE: This is an HMAC signature for API authentication, NOT a password hash.
  // Using String() to ensure consistent type for crypto.update()
  const signature = createHmac('sha256', String(hmacSigningKey)).update(String(canonical), 'utf8').digest('hex');

  const headers: Record<string, string> = {
    'X-Api-Key': apiKey,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Content-SHA256': contentSha256,
    'X-Signature': signature,
  };

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

export function buildSignedJsonRequest(payload: unknown): {
  body: string;
  headers: Record<string, string>;
} {
  const body = JSON.stringify(payload);
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: buildSignedHeaders(body, contentSha256, 'application/json'),
  };
}

export function buildSignedRawJsonRequest(rawBody: string): {
  body: string;
  headers: Record<string, string>;
} {
  const body = rawBody;
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: buildSignedHeaders(body, contentSha256, 'application/json'),
  };
}

export function buildSignedJsonHashRequest(rawBody: string): {
  body: string;
  headers: Record<string, string>;
} {
  const body = rawBody;
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: buildSignedHeaders(contentSha256, contentSha256, 'application/json'),
  };
}

export function buildSignedMultipartHeaders(): Record<string, string> {
  return buildSignedHeaders('', 'UNSIGNED');
}

export function buildApiUrl(pathname: string): string {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${pathname}`;
}

export function extractForwardHeaders(request: Request): HeadersInit {
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const forwardedFor = request.headers.get('x-forwarded-for');

  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;
  if (userAgent) headers['user-agent'] = userAgent;
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  return headers;
}
