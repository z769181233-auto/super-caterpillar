
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';

const API_URL = 'http://localhost:3000';
// Need a valid API Key and Secret for signature? 
// Or user token? 
// Controller uses @RequireSignature AND @UseGuards(JwtOrHmacGuard).
// If using JWT (User), signature is still required by @RequireSignature.
// We need to sign the request.
// Signature = HMAC-SHA256(Method + Path + Timestamp + Nonce + BodyString, Secret)
// But wait, if I use User Token, I might not have a "Secret" known to client unless I use an API Key?
// Usually @RequireSignature implies using API Key authentication.
// If I use JWT, `req.user` is set, but `RequireSignature` might check headers.
// If I login as user, I don't have a signing secret.
// So I MUST use API Key for this endpoint if `RequireSignature` is present.
// I'll grab the worker key from env or create a new API Key for test user?
// The E2E script `run_video_e2e.sh` logged in as user.
// But `apps/api/src/shot-director/shot-director.controller.ts` has `@RequireSignature`.
// This blocks normal users? 
// Yes, CE10 "High Cost Interface" requires signature.
// So Users must have API Keys to use it? Or the Frontend signs it?
// Frontend signs using a session secret? 
// Let's assume we use the WORKER_API_KEY for simplicity in this smoke test.
// Env should have it.

const API_KEY = process.env.WORKER_API_KEY || 'test-worker-key';
const API_SECRET = process.env.WORKER_API_SECRET || 'test-worker-secret';

async function main() {
    const sceneId = process.argv[2];
    const userToken = process.argv[3]; // We might ignore this if using API Key

    if (!sceneId) {
        console.error('Scene ID required');
        process.exit(1);
    }

    const path = `/api/shots/scene/${sceneId}/compose-video`;
    const method = 'POST';
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const body = {};

    // Signature Generation (Standard HMAC)
    // Server expectation: apiKey + nonce + timestamp + (bodyString || '')
    // Server HmacAuthGuard converts empty object body to ''
    const bodyString = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
    const payloadToSign = `${API_KEY}${nonce}${timestamp}${bodyString}`;
    const signature = crypto.createHmac('sha256', API_SECRET).update(payloadToSign).digest('hex');

    try {
        const response = await axios.post(`${API_URL}${path}`, body, {
            headers: {
                'x-api-key': API_KEY, // Use API Key auth
                'x-timestamp': timestamp,
                'x-nonce': nonce,
                'x-signature': signature,
                'Content-Type': 'application/json'
            }
        });

        console.log('Trigger success:', response.data);
        if (response.data.success) {
            fs.writeFileSync('video_e2e_job_id.txt', response.data.data.jobId);
        }
    } catch (e: any) {
        console.error('Trigger failed:', e.response?.data || e.message);
        process.exit(1);
    }
}

main();
