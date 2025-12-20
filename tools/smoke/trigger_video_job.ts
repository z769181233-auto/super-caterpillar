
import { makeHmacRequest } from './helpers/hmac_request.js';
import { readFileSync } from 'fs';
import * as path from 'path';

// Load Env
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';
const SHOT_ID = process.env.SHOT_ID;
const FRAME_KEYS_JSON = process.env.FRAME_KEYS;

if (!SHOT_ID || !FRAME_KEYS_JSON) {
    console.error('SHOT_ID and FRAME_KEYS are required');
    process.exit(1);
}

const frameKeys = JSON.parse(FRAME_KEYS_JSON);

async function main() {
    console.log(`[Trigger] Triggering VIDEO_RENDER for Shot ${SHOT_ID} at ${API_BASE_URL}`);

    const result = await makeHmacRequest({
        apiBaseUrl: API_BASE_URL,
        apiKey: API_KEY,
        apiSecret: API_SECRET,
        method: 'POST',
        path: `/shots/${SHOT_ID}/jobs`,
        body: {
            type: 'VIDEO_RENDER',
            payload: {
                frameKeys,
                fps: 1
            }
        }
    });

    if (result.status !== 201 && result.status !== 200) {
        console.error('Trigger Failed:', JSON.stringify(result, null, 2));
        process.exit(1);
    }

    console.log(JSON.stringify(result.response));
}

main().catch(console.error);
