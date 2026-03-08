
import { PrismaClient, JobType, JobStatus } from '../../packages/database';



// Simple API Client Mock/Implementation if import fails
class SimpleApiClient {
    private baseUrl = 'http://127.0.0.1:3000';
    private apiKey = 'ak_admin_secret_key_123456'; // Use admin key

    async createJob(payload: any) {
        const res = await fetch(`${this.baseUrl}/api/admin/jobs`, {
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

const prisma = new PrismaClient({});

async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        console.error('Usage: ts-node trigger_shot_renders.ts <projectId>');
        process.exit(1);
    }

    console.log(`Searching for shots in project: ${projectId}`);

    // Find all shots
    // Note: Schema might use projectId or project_id depending on prisma version/mapping
    // But usually prisma maps snake_case DB columns to camelCase JS properties
    // Let's rely on finding by scene -> project

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

    // Support optional filter: specific shotId or sceneId
    const targetId = process.argv[3];

    for (const shot of shots) {
        if (targetId && shot.id !== targetId && shot.sceneId !== targetId && shot.scene.sceneIndex.toString() !== targetId) {
            continue;
        }

        console.log(`Triggering SHOT_RENDER for Shot ${shot.index} (ID: ${shot.id}, Scene: ${shot.scene.sceneIndex})...`);

        try {
            const traceId = `trace-manual-render-${shot.id}-${Date.now()}`;
            // Construct payload internally
            const jobPayload = {
                shotId: shot.id,
                projectId: projectId,
                sceneId: shot.sceneId,
                episodeId: shot.scene.episodeId,
                traceId,
                aspect_ratio: "16:9"
            };

            await prisma.shotJob.create({
                data: {
                    type: JobType.SHOT_RENDER,
                    projectId: projectId,
                    organizationId: shot.organizationId,
                    episodeId: shot.scene.episodeId,
                    sceneId: shot.sceneId,
                    shotId: shot.id,
                    status: JobStatus.PENDING,
                    traceId,
                    payload: jobPayload,
                    priority: 10
                }
            });
            console.log(` -> Job Created (DB Direct) for Shot ${shot.id}`);

            // Update shot status
            await prisma.shot.update({
                where: { id: shot.id },
                data: { renderStatus: 'PENDING' }
            });

        } catch (e: any) {
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
