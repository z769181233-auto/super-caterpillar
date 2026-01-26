
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

function generateHmacHeaders(apiKey: string, apiSecret: string, method: string, path: string, body: any, orgId?: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyString = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

    // Format: ${apiKey}${nonce}${timestamp}${bodyString}
    const message = `${apiKey}${nonce}${timestamp}${bodyString}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
    const contentSha256 = crypto.createHash('sha256').update(bodyString).digest('hex');

    const headers: any = {
        'X-Api-Key': apiKey,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Content-SHA256': contentSha256,
    };
    if (orgId) {
        headers['X-Organization-Id'] = orgId;
    }
    console.log(`[DEBUG] Generated Headers: Nonce=${headers['X-Nonce']}, Timestamp=${headers['X-Timestamp']}`);
    return headers;
}

async function main() {
    const args = process.argv.slice(2);
    const words = parseInt(args.find(a => a.startsWith('--words='))?.split('=')[1] || '10000');
    const seed = args.find(a => a.startsWith('--seed='))?.split('=')[1] || `seed_${Date.now()}`;
    const outDir = args.find(a => a.startsWith('--out='))?.split('=')[1] || './out';
    const label = args.find(a => a.startsWith('--label='))?.split('=')[1] || 'default';

    const apiKey = process.env.VALID_API_KEY_ID || '';
    const apiSecret = process.env.API_SECRET || '';
    const orgId = process.env.ORG_ID;

    if (!apiKey || !apiSecret) {
        console.error('Missing VALID_API_KEY_ID or API_SECRET in env');
        process.exit(1);
    }

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const runDir = path.join(outDir, label);
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

    console.log(`[P25 Runner] Rules: Org=${orgId}, ApiKey=${apiKey.substring(0, 6)}... (Business Route Fixed)`);
    console.log(`[P25 Runner] Starting word-scaling test (Words=${words}, Seed=${seed})...`);

    // 1. Generate Novel
    const novelPath = path.join(runDir, 'input_novel.txt');
    execSync(`pnpm exec tsx tools/stress/p25/gen_novel_by_words.ts --words=${words} --out=${novelPath} --seed=${seed}`);
    const novelContent = fs.readFileSync(novelPath, 'utf-8');

    // 2. Auth & Project Setup (API)
    const apiBase = 'http://localhost:3000/api';

    console.log(`[P25 Runner] Seeding Project under Org Context: ${orgId}...`);
    const projectPath = '/api/projects';
    const projectBody = {
        name: `P25_Scale_${label}_${Date.now()}`,
        description: `P25 Scale Test ${words} words`
    };

    const projectHeaders = generateHmacHeaders(apiKey, apiSecret, 'POST', projectPath, projectBody, orgId);
    const projectRes = await axios.post(`${apiBase}/projects`, projectBody, { headers: projectHeaders });

    const project = projectRes.data.data;
    const projectId = project.id;
    console.log(`[P25 Runner] ProjectID Created: ${projectId}`);

    // Force timestamp tick to avoid "Nonce Used" false positives if server uses TS as Key component
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 3. Trigger Novel Import (Correct Route: projects/:projectId/novel/import)
    console.log(`[P25 Runner] Importing Novel (Words: ${words})...`);
    const importPath = `/api/projects/${projectId}/novel/import`;
    const importBody = {
        title: `P25 Scale Novel`,
        rawText: novelContent
    };

    const importHeaders = generateHmacHeaders(apiKey, apiSecret, 'POST', importPath, importBody, orgId);
    const importRes = await axios.post(`${apiBase}/projects/${projectId}/novel/import`, importBody, { headers: importHeaders });

    console.log(`[P25 Runner] Import Success. Task: ${importRes.data.data.taskId}. Status: ${importRes.data.message}`);
    console.log(`[P25 Runner] SUCCESS: PROJECT_ID=${projectId}`);
}

main().catch(e => {
    if (e.response?.data) {
        console.error('API Error Response:', JSON.stringify(e.response.data, null, 2));
    } else {
        console.error(e);
    }
    process.exit(1);
});
