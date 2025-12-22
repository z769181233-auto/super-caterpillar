
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../..');
const STORAGE_ROOT = path.join(REPO_ROOT, '.data/storage');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const AUTH_STATE_FILE = path.resolve(__dirname, '.auth_state.json');

// Test Key with slashes to verify encoding fix
const TEST_KEY = 'temp/test/encoding/fix/check.png';
const LOCAL_FILE_PATH = path.join(STORAGE_ROOT, TEST_KEY);

async function main() {
    console.log('=== Verifying Signed URL Encoding Fix ===');

    // 1. Load Auth State
    if (!fs.existsSync(AUTH_STATE_FILE)) {
        console.error('❌ .auth_state.json not found. Run ensure_auth_state.ts first.');
        process.exit(1);
    }
    const authState = JSON.parse(fs.readFileSync(AUTH_STATE_FILE, 'utf-8'));
    const cookies = authState.cookies || {};
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

    if (!cookieHeader) {
        console.error('❌ No cookies found in auth state.');
        process.exit(1);
    }
    console.log('✅ Auth State Loaded');

    // 2. Create Dummy File
    const dir = path.dirname(LOCAL_FILE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_FILE_PATH, 'DUMMY IMAGE CONTENT');
    console.log(`✅ Dummy file created at: ${LOCAL_FILE_PATH}`);

    // 3. Request Signed URL
    // We need to encode the key exactly as the frontend/client would
    // But wait, the API endpoint is /api/storage/sign/:key(*)
    // So we pass the key as part of the path.
    // The issue was that encodeURIComponent(key) encoded '/' as '%2F' which might be what we want to test?
    // No, the client sends the key. If the path param is :key(*), it handles slashes.
    // The fix in the service was to encode each segment.
    // Let's call the API.

    // Note: key should be URL encoded in the request URL if it contains special chars?
    // But for simple slashes, we usually rely on the wildcard match.
    // Let's try sending it as is, or encoded. 
    // Standard pattern: /api/storage/sign/temp/test/encoding/fix/check.png

    const signUrl = `${API_BASE_URL}/api/storage/sign/${TEST_KEY}`;

    console.log(`[Request] POST ${signUrl}`);

    const signRes = await fetch(signUrl, {
        method: 'POST',
        headers: {
            'Cookie': cookieHeader,
            'Content-Type': 'application/json'
        }
    });

    if (!signRes.ok) {
        console.error(`❌ Sign Request Failed: ${signRes.status} ${signRes.statusText}`);
        console.error(await signRes.text());
        process.exit(1);
    }

    const signData = await signRes.json() as any;
    const signedUrl = signData.url;

    if (!signedUrl) {
        console.error('❌ No URL returned in response:', signData);
        process.exit(1);
    }

    console.log(`✅ API returned Signed URL: ${signedUrl}`);

    // 4. Access Signed URL
    console.log('[Verify] Fetching Signed URL...');
    const accessRes = await fetch(signedUrl);

    if (accessRes.status === 200) {
        const text = await accessRes.text();
        if (text === 'DUMMY IMAGE CONTENT') {
            console.log('✅ Success: Accessed file content correctly.');
        } else {
            console.error('❌ Content mismatch:', text);
            process.exit(1);
        }
    } else {
        console.error(`❌ Access Failed: ${accessRes.status}`);
        console.error(await accessRes.text());
        process.exit(1);
    }

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('✅ Cleanup complete');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
