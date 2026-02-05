
import { PrismaClient } from '../../packages/database/src/generated/prisma';

const prisma = new PrismaClient();
const PROJECT_ID = 'prod-pilot-sealed42';

async function main() {
    console.log('Checking Pilot State for:', PROJECT_ID);

    const scenes = await prisma.scene.count({ where: { episode: { projectId: PROJECT_ID } } });
    console.log('Scenes Count:', scenes);

    const ce06Jobs = await prisma.shotJob.findMany({
        where: { projectId: PROJECT_ID, type: 'CE06_NOVEL_PARSING' },
        orderBy: { createdAt: 'desc' },
        take: 1
    });

    if (ce06Jobs.length > 0) {
        console.log('Last CE06 Job:', ce06Jobs[0].status, ce06Jobs[0].id);
        console.log('CE06 Payload:', JSON.stringify(ce06Jobs[0].payload));
        console.log('CE06 Result:', JSON.stringify(ce06Jobs[0].result));
    } else {
        console.log('No CE06 Job found.');
    }

    const ce03Jobs = await prisma.shotJob.count({
        where: { projectId: PROJECT_ID, type: 'CE03_VISUAL_DENSITY' }
    });
    console.log('CE03 Jobs Count:', ce03Jobs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
