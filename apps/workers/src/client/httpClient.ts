import axios from 'axios';
import crypto from 'crypto';
import { env } from '@scu/config';

export function sign(payload: string) {
  return crypto.createHmac('sha256', env.workerApiSecret || '').update(payload).digest('hex');
}

export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
});

