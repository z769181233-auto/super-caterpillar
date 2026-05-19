import { createHash, randomUUID, webcrypto } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { buildApiUrl as buildWebApiUrl } from '@/lib/api-base';

const textEncoder = new TextEncoder();
type NodeCryptoKey = Awaited<ReturnType<typeof webcrypto.subtle.importKey>>;
let signingKeyPromise: Promise<NodeCryptoKey> | null = null;
const fallbackEnvCache = new Map<string, string>();
const fallbackEnvLoadedFiles = new Set<string>();

function getCandidateRoots(): string[] {
  const roots = new Set<string>();
  let current = process.cwd();

  for (let i = 0; i < 4; i += 1) {
    roots.add(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return Array.from(roots);
}

function getDefaultEnvFiles(): string[] {
  return getCandidateRoots().flatMap((root) => [
    path.resolve(root, '.env'),
    path.resolve(root, 'apps/api/.env'),
    path.resolve(root, 'apps/web/.env'),
  ]);
}

export function readEnvValueFromFiles(name: string, files = getDefaultEnvFiles()): string | undefined {
  if (fallbackEnvCache.has(name)) {
    return fallbackEnvCache.get(name);
  }

  for (const file of files) {
    if (fallbackEnvLoadedFiles.has(file)) {
      continue;
    }

    if (!fs.existsSync(file)) {
      fallbackEnvLoadedFiles.add(file);
      continue;
    }

    const parsed = parseDotenv(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!fallbackEnvCache.has(key)) {
        fallbackEnvCache.set(key, value);
      }
    }
    fallbackEnvLoadedFiles.add(file);
  }

  return fallbackEnvCache.get(name);
}

export function resolveProxyEnv(name: string): string | undefined {
  return process.env[name] || readEnvValueFromFiles(name);
}

function requireEnv(name: string): string {
  const value = resolveProxyEnv(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function getSigningKey(secret: string): Promise<NodeCryptoKey> {
  if (!signingKeyPromise) {
    signingKeyPromise = webcrypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  return signingKeyPromise;
}

async function buildSignedHeaders(
  body: string,
  contentSha256: string,
  contentType?: string
): Promise<Record<string, string>> {
  const apiKey = requireEnv('WORKER_API_KEY');
  const hmacSigningKey = requireEnv('HMAC_SECRET_KEY');
  const nonce = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const canonical = `${apiKey}${nonce}${timestamp}${body || contentSha256}`;
  const key = await getSigningKey(hmacSigningKey);
  const rawSignature = await webcrypto.subtle.sign('HMAC', key, textEncoder.encode(canonical));
  const signature = Buffer.from(rawSignature).toString('hex');

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

export async function buildSignedJsonRequest(payload: unknown): Promise<{
  body: string;
  headers: Record<string, string>;
}> {
  const body = JSON.stringify(payload);
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: await buildSignedHeaders(body, contentSha256, 'application/json'),
  };
}

export async function buildSignedRawJsonRequest(rawBody: string): Promise<{
  body: string;
  headers: Record<string, string>;
}> {
  const body = rawBody;
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: await buildSignedHeaders(body, contentSha256, 'application/json'),
  };
}

export async function buildSignedJsonHashRequest(rawBody: string): Promise<{
  body: string;
  headers: Record<string, string>;
}> {
  const body = rawBody;
  const contentSha256 = createHash('sha256').update(body, 'utf8').digest('hex');
  return {
    body,
    headers: await buildSignedHeaders(contentSha256, contentSha256, 'application/json'),
  };
}

export async function buildSignedMultipartHeaders(): Promise<Record<string, string>> {
  return buildSignedHeaders('', 'UNSIGNED');
}

export function buildApiUrl(pathname: string): string {
  return buildWebApiUrl(pathname);
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

export function forwardSetCookies(source: Headers, target: Headers) {
  const setCookies = typeof source.getSetCookie === 'function' ? source.getSetCookie() : [];

  if (setCookies.length > 0) {
    for (const value of setCookies) {
      target.append('set-cookie', value);
    }
    return;
  }

  const fallback = source.get('set-cookie');
  if (fallback) {
    target.append('set-cookie', fallback);
  }
}
