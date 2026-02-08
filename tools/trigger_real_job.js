const axios = require('axios');
const { PrismaClient } = require('database');
const prisma = new PrismaClient();

async function main() {
    const shotId = process.argv[2];
    if (!shotId) throw new Error('Missing SHOT_ID');

    console.log(`[Trigger] Triggering REAL RENDER for Shot: ${shotId}`);

    // 1. Get Project ID for this shot
    const shot = await prisma.shot.findUnique({
        where: { id: shotId },
        include: { scene: true }
    });
    if (!shot) throw new Error('Shot not found');
    const projectId = shot.scene.projectId;

    // 2. Trigger via API Hub (simulating worker/client)
    // We'll use the API Key created by init_api_key.ts
    const apiKey = 'scu_smoke_key';
    const apiSecret = 'scu_smoke_secret';

    const response = await axios.post('http://localhost:3000/api/engines/invoke', {
        engineKey: 'shot_render',
        payload: {
            prompt: 'A beautiful sunset over the digital ocean, cinematic, 4k',
            shotId: shotId,
            projectId: projectId
        },
        context: {
            mode: 'REAL_ENGINE'
        }
    }, {
        headers: {
            'x-api-key': apiKey,
            'x-api-secret': apiSecret
        }
    });

    console.log('[Trigger] API Response:', JSON.stringify(response.data, null, 2));

    if (response.data.status !== 'SUCCESS') {
        throw new Error(`Engine Trigger Failed: ${response.data.error?.message}`);
    }

    console.log('[Trigger] SUCCESS. Job ID:', response.data.output?.jobId || 'N/A');
}

main().catch(e => {
    console.error('[Trigger] Error:', e.response?.data || e.message);
    process.exit(1);
}).finally(() => prisma.$disconnect());
