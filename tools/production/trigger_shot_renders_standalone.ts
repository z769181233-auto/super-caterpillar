
const fs = require('fs');
const { createHmac, randomBytes, createHash } = require('crypto');
// We use global fetch (node 18+)

// --- Minimal ApiClient ---
class ApiClient {
    baseURL: string;
    apiKey: string;
    apiSecret: string;
    workerId: string;

    constructor(baseURL: string, apiKey: string, apiSecret: string, workerId: string) {
        this.baseURL = baseURL.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.workerId = workerId;
    }

    generateNonce() {
        return `${randomBytes(16).toString('hex')}-${Date.now()}`;
    }

    computeSignature(secret: string, message: string) {
        return createHmac('sha256', secret).update(message).digest('hex');
    }

    async createJob(shotId: string, dto: any) {
        const url = `${this.baseURL}/api/shots/${shotId}/jobs`;
        const method = 'POST';
        const bodyString = JSON.stringify(dto);

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = this.generateNonce();

        // HMAC V1.1: apiKey + nonce + timestamp + body
        // If POST and empty body, use content hash? BUT body is not empty here.
        // Actually, let's follow the standard: bodyString.
        // Wait, Worker ApiClient api-client.ts says:
        // if POST and bodyString=='', sign contentHash.
        // Here bodyString is NOT empty.
        // So message = apiKey + nonce + timestamp + bodyString.

        const message = this.apiKey + nonce + timestamp + bodyString;
        const signature = this.computeSignature(this.apiSecret, message);
        const bodyHash = createHash('sha256').update(bodyString).digest('hex');

        const headers: any = {
            'Content-Type': 'application/json',
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-Signature': signature,
            'X-Api-Key': this.apiKey,
            'X-Content-SHA256': bodyHash,
            'X-Hmac-Version': '1.1',
            'x-worker-id': this.workerId
        };

        if (dto.organizationId) {
            headers['x-organization-id'] = dto.organizationId;
        }

        console.log(`[Standalone] POST ${url}`);
        const res = await fetch(url, {
            method,
            headers,
            body: bodyString
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API ${res.status}: ${text}`);
        }

        return await res.json();
    }
}

async function main() {
    console.log('Starting standalone trigger script...');
    const projectId = process.argv[2];
    if (!projectId) {
        console.error('Usage: tsx tools/production/trigger_shot_renders_standalone.ts <projectId>');
        process.exit(1);
    }

    const csvPath = 'shots.csv';
    if (!fs.existsSync(csvPath)) {
        console.error('shots.csv not found');
        process.exit(1);
    }

    console.log(`Reading shots from ${csvPath}...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
    console.log(`Found ${lines.length} shots.`);

    const client = new ApiClient(
        'http://127.0.0.1:3000',
        'ak_worker_dev_0000000000000000', // API Key
        'sk_worker_dev_1234567890123456', // API Secret (Correct one from env/db)
        'local-worker'                    // workerId
    );

    let successCount = 0;
    let failCount = 0;

    for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const shotId = parts[0];
        const organizationId = parts[2];
        let prompt = parts.slice(6).join(',');

        // Basic CSV unquoting
        if (prompt.startsWith('"') && prompt.endsWith('"')) {
            prompt = prompt.substring(1, prompt.length - 1);
        }
        prompt = prompt.replace(/""/g, '"');

        if (!prompt || prompt === "null" || prompt === "") prompt = "Cinematic shot";

        console.log(`Triggering SHOT_RENDER for Shot ${shotId}...`);

        try {
            const res = await client.createJob(shotId, {
                type: 'SHOT_RENDER',
                payload: {
                    prompt: prompt,
                    traceId: `manual-trigger-${shotId}`,
                    referenceSheetId: 'gate-mock-ref-id' // Bypass reference check
                },
                organizationId: organizationId
            });

            console.log(` -> OK: Job ${res.data?.id || res.id}`);
            successCount++;
        } catch (e: any) {
            console.error(` -> FAILED: ${e.message}`);
            failCount++;
        }
    }
    console.log(`Finished. Success: ${successCount}, Failed: ${failCount}`);
}

main().catch(console.error);
