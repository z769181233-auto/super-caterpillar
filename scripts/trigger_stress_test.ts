import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
    const projectId = 'stress-test-wangu-' + Date.now();
    const organizationId = 'org_seed_1769170233_13924';
    const ownerId = 'gate-user';

    console.log(`Creating stress test project: ${projectId}`);

    // 0. Create Project
    const project = await (prisma as any).project.create({
        data: {
            id: projectId,
            name: 'Stress Test: 万古神帝',
            ownerId: ownerId,
            organizationId: organizationId,
            stylePrompt: 'Anime style, high quality, cinematic lighting',
            status: 'in_progress'
        }
    });

    // 1. Create NovelSource
    const novelSource = await (prisma as any).novelSource.create({
        data: {
            projectId: projectId,
            organizationId: organizationId,
            fileKey: 'docs/_specs/万古神帝.txt',
            fileName: '万古神帝.txt',
            fileSize: 32505856,
            status: 'PENDING'
        }
    });

    // 2. Insert Scan Job
    const job = await (prisma as any).shotJob.create({
        data: {
            organizationId: organizationId,
            projectId: projectId,
            type: 'NOVEL_SCAN_TOC', // Literal string as JobType enum might be tricky across versions
            status: 'PENDING',
            priority: 10,
            payload: {
                projectId: projectId,
                fileKey: 'docs/_specs/万古神帝.txt',
                novelSourceId: novelSource.id,
                isVerification: true,
            },
        }
    });

    console.log(`Stress test triggered! Job ID: ${job.id}`);
    console.log(`Monitor NovelSource ID: ${novelSource.id}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await (prisma as any).$disconnect();
    });
