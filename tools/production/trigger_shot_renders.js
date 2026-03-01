
const { PrismaClient } = require('@prisma/client');

// Simple API Client Mock/Implementation
class SimpleApiClient {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:3000';
        this.apiKey = 'ak_admin_secret_key_123456'; // Use admin key
    }

    async createJob(payload) {
        // Determine fetch availability
        const fetchFn = global.fetch || require('node-fetch');

        const res = await fetchFn(`${this.baseUrl}/api/admin/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'x-user-id': 'admin-user'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API Error: ${res.status} ${text}`);
        }
        return await res.json();
    }
}

const prisma = new PrismaClient();

async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        console.error('Usage: node trigger_shot_renders.js <projectId>');
        process.exit(1);
    }

    console.log(`Searching for shots in project: ${projectId}`);

    // Find all shots
    const shots = await prisma.shot.findMany({
        where: {
            scene: {
                projectId: projectId
            }
        },
        include: {
            scene: true
        }
    });

    console.log(`Found ${shots.length} shots.`);

    const apiClient = new SimpleApiClient();

    for (const shot of shots) {
        console.log(`Triggering SHOT_RENDER for Shot ${shot.index} (ID: ${shot.id}, Scene: ${shot.scene.sceneIndex})...`);

        // Check if job already exists (simple check)
        /*
        const existing = await prisma.shotJob.findFirst({
            where: { shotId: shot.id, type: 'SHOT_RENDER', status: { not: 'FAILED' } }
        });
        if (existing) {
            console.log(` -> Skipping: Job already exists ${existing.id}`);
            continue;
        }
        */

        try {
            const traceId = `trace-manual-render-${shot.id}-${Date.now()}`;
            const payload = {
                type: 'SHOT_RENDER',
                projectId: projectId,
                organizationId: shot.organizationId,
                payload: {
                    shotId: shot.id,
                    projectId: projectId,
                    sceneId: shot.sceneId,
                    episodeId: shot.scene.episodeId,
                    traceId,
                    // Force params for now
                    prompt: shot.prompt || "High quality cinematic shot",
                    aspect_ratio: "16:9"
                }
            };

            const result = await apiClient.createJob(payload);
            console.log(` -> Job Created: ${result.id}`);

            // Update shot status locally just in case
            await prisma.shot.update({
                where: { id: shot.id },
                data: { renderStatus: 'PENDING' }
            });

        } catch (e) {
            console.error(` -> Failed: ${e.message}`);
        }
    }

    console.log('Done.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
