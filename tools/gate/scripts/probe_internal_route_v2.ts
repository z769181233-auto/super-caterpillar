import axios from 'axios';
import { createHmac } from 'crypto';

const BASE_URL = 'http://127.0.0.1:3000';
const ENDPOINT = '/api/internal/events/hmac-ping';
const API_KEY = 'dev-worker-key';
const API_SECRET = 'dev-worker-secret';

function computeSignature(apiKey: string, secret: string, nonce: string, timestamp: string, body: string) {
    const message = apiKey + nonce + timestamp + body;
    return createHmac('sha256', secret).update(message).digest('hex');
}

async function probe() {
    console.log(`[PROBE] Checking ${ENDPOINT} with dev-worker-key...`);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(7);
    const body = '';
    const signature = computeSignature(API_KEY, API_SECRET, nonce, timestamp, body);

    try {
        const res = await axios.get(`${BASE_URL}${ENDPOINT}`, {
            headers: {
                'X-Api-Key': API_KEY,
                'X-Nonce': nonce,
                'X-Timestamp': timestamp,
                'X-Signature': signature,
                'X-Content-SHA256': 'UNSIGNED'
            },
            validateStatus: () => true
        });
        console.log(`[PROBE] Result: HTTP ${res.status}`, res.data);
    } catch (e: any) {
        console.log(`[PROBE] Error: ${e.message}`);
    }
}

probe();
