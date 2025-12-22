
import { createHmac, randomBytes, createHash } from 'crypto';

const API_BASE_URL = 'http://localhost:3000/api';
const API_KEY = 'ak_e2e_test_key_001';
const API_SECRET = 'sk_e2e_test_secret_001_plain_text';
const WORKER_ID = 'local-worker';

function generateNonce() {
    return randomBytes(16).toString('hex');
}

function computeBodyHash(body: string) {
    return createHash('sha256').update(body || '').digest('hex');
}

function buildMessage(method: string, path: string, nonce: string, timestamp: string, body: string) {
    const contentHash = computeBodyHash(body);
    return `${method}\n${path}\n${timestamp}\n${nonce}\n${contentHash}`;
}

function computeSignature(secret: string, message: string) {
    const hmac = createHmac('sha256', secret);
    hmac.update(message);
    return hmac.digest('hex');
}

async function main() {
    const path = `/workers/${WORKER_ID}/jobs/next`;
    const url = `${API_BASE_URL}${path}`;
    const method = 'POST';

    // MATCH ApiClient EXACTLY
    const body = undefined;
    const bodyString = body ? JSON.stringify(body) : ''; // becomes ""

    const nonce = generateNonce();
    const timestamp = Date.now().toString();
    const messagePath = `/api${path}`;

    const message = buildMessage(method, messagePath, nonce, timestamp, bodyString);
    const signature = computeSignature(API_SECRET, message);

    const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature
    };

    console.log(`Requesting next job for worker ${WORKER_ID}...`);
    console.log(`Body String: '${bodyString}' (Passing this explicitly to fetch)`);

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: bodyString, // PASSING EMPTY STRING EXPLICITLY
        });

        // Check if we can parse JSON
        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }

        console.log('Response Status:', response.status);
        console.log('Response Data:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data);

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
