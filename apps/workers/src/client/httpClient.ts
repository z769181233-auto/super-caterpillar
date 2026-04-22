import axios from 'axios';
import { webcrypto } from 'crypto';
import { env } from '@scu/config';

type NodeCryptoKey = Awaited<ReturnType<typeof webcrypto.subtle.importKey>>;
const textEncoder = new TextEncoder();
let signingKeyPromise: Promise<NodeCryptoKey> | null = null;

export async function sign(payload: string): Promise<string> {
  if (!signingKeyPromise) {
    signingKeyPromise = webcrypto.subtle.importKey(
      'raw',
      textEncoder.encode(env.workerApiSecret || ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }
  const signingKey = await signingKeyPromise;
  const signature = await webcrypto.subtle.sign('HMAC', signingKey, textEncoder.encode(payload));
  return Buffer.from(signature).toString('hex');
}

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
});
