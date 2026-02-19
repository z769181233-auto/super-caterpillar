
const fs = require('fs');
import { ApiClient } from '../../apps/workers/src/api-client';

async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        console.error('Usage: tsx tools/production/trigger_shot_renders_v2.ts <projectId>');
        process.exit(1);
    }

    const csvPath = 'shots.csv';
    if (!fs.existsSync(csvPath)) {
        console.error('shots.csv not found');
        process.exit(1);
    }

    console.log(`Reading shots from ${csvPath}...`);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    console.log(`Found ${lines.length} shots.`);

    const client = new ApiClient(
        'http://127.0.0.1:3000',
        'ak_worker_dev_0000000000000000', // API Key
        'scu_smoke_key',                  // API Secret
        'local-worker'                    // workerId
    );

    for (const line of lines) {
        // CSV format: id,scene_id,organization_id,episode_id,scene_index,shot_index,description
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const shotId = parts[0];
        const organizationId = parts[2];
        let prompt = parts.slice(6).join(',');

        // Basic CSV unquoting
        if (prompt.startsWith('"') && prompt.endsWith('"')) {
            prompt = prompt.substring(1, prompt.length - 1);
        }
        // Handle double quotes escape in CSV ("")
        prompt = prompt.replace(/""/g, '"');

        if (!prompt || prompt === "null" || prompt === "") prompt = "Cinematic shot";

        console.log(`Triggering SHOT_RENDER for Shot ${shotId}...`);

        try {
            // We use the 'organizationId' from CSV to impersonate the correct org context
            // The ApiClient will set 'x-organization-id' header if present in body (as we saw in code)
            const res = await client.createJob(shotId, {
                type: 'SHOT_RENDER',
                payload: {
                    prompt: prompt,
                    traceId: `manual-trigger-${shotId}`,
                },
                organizationId: organizationId
            } as any);

            console.log(` -> OK: Job ${res.data?.id || res.id}`);
        } catch (e: any) {
            console.error(` -> FAILED: ${e.message}`);
        }
    }
}

main().catch(console.error);
