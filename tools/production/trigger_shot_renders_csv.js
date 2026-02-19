
const fs = require('fs');

class SimpleApiClient {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:3000';
        // No API Key needed for ProdGate if GATE_MODE=1 and no guards
    }

    async createJob(payload) {
        const fetchFn = global.fetch;
        const url = `${this.baseUrl}/api/admin/prod-gate/shot-render`;
        console.log(`POST ${url}`);

        // Create artifact path
        const artifactDir = `docs/_evidence/wangu_ep1/${payload.shotId}`;

        const gatePayload = {
            shotId: payload.shotId,
            artifactDir: artifactDir,
            prompt: payload.prompt,
            seed: 42
        };

        const res = await fetchFn(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gatePayload)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API Error: ${res.status} ${text}`);
        }
        return await res.json();
    }
}

async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        console.error('Usage: node trigger_shot_renders_csv.js <projectId>');
        process.exit(1);
    }

    if (!fs.existsSync('shots.csv')) {
        console.error('shots.csv not found');
        process.exit(1);
    }

    console.log(`Reading shots from shots.csv...`);

    const content = fs.readFileSync('shots.csv', 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    console.log(`Found ${lines.length} shots.`);

    const apiClient = new SimpleApiClient();

    for (const line of lines) {
        // Format: id,scene_id,organization_id,episode_id,scene_index,shot_index,prompt
        const parts = line.split(',');

        if (parts.length < 6) continue;

        const id = parts[0];
        const sceneId = parts[1];
        const organizationId = parts[2];
        const episodeId = parts[3];
        const sceneIndex = parts[4];
        const shotIndex = parts[5];
        let prompt = parts.slice(6).join(',');

        if (!prompt || prompt === "null" || prompt === "") prompt = "Cinematic shot";

        console.log(`Triggering SHOT_RENDER for Shot ${shotIndex} (ID: ${id}, Scene: ${sceneIndex})...`);

        try {
            const payload = {
                shotId: id,
                prompt: prompt
            };

            const result = await apiClient.createJob(payload);
            console.log(` -> Job Created: ${result.jobId}`);

        } catch (e) {
            console.error(` -> Failed: ${e.message}`);
        }
    }

    console.log('Done.');
}

main().catch(console.error);
