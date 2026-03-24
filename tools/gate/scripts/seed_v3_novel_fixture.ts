import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'create'; // create or echo

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const orgId = process.env.ORG_ID || `org_v3_${timestamp}`;
    const projId = process.env.PROJ_ID || `proj_v3_${timestamp}`;
    const novelId = process.env.NOVEL_ID || `novel_v3_${timestamp}`;
    const sourceId = process.env.SOURCE_ID || `src_v3_${timestamp}`;
    const userId = process.env.USER_ID || 'user-gate-v3';

    // 1. Ensure User
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: `gate-v3-${timestamp}@example.com`,
            passwordHash: 'mock',
            tier: 'Free' as any,
        },
    });

    // 2. Organization
    await prisma.organization.upsert({
        where: { id: orgId },
        update: {},
        create: {
            id: orgId,
            name: 'V3 Gate Org',
            slug: orgId,
            ownerId: userId,
            credits: 1000000,
        },
    });

    // 3. Project
    await prisma.project.upsert({
        where: { id: projId },
        update: {},
        create: {
            id: projId,
            organizationId: orgId,
            name: 'V3 Gate Project',
            ownerId: userId,
            status: 'in_progress',
        },
    });

    // 4. Novel (V3.0 Top-level entity)
    await prisma.novel.upsert({
        where: { id: novelId },
        update: {},
        create: {
            id: novelId,
            projectId: projId,
            organizationId: orgId,
            title: 'V3 Gate Novel',
        },
    });

    // 5. NovelSource (V3.0 schema: No rawText)
    await prisma.novelSource.upsert({
        where: { id: sourceId },
        update: {},
        create: {
            id: sourceId,
            projectId: projId,
            organizationId: orgId,
            fileKey: `novels/${novelId}/source.txt`,
            fileName: 'source.txt',
            fileSize: 1024,
            status: 'COMPLETED',
        },
    });

    // 6. Volume & Chapters
    const volId = `vol_v3_${timestamp}`;
    await prisma.novelVolume.create({
        data: {
            id: volId,
            projectId: projId,
            novelSourceId: novelId, // Foreign key to Novel as per V3 Schema
            index: 1,
            title: 'Volume 1',
        },
    });

    const chapter1Id = `chap_v3_1_${timestamp}`;
    const chapter2Id = `chap_v3_2_${timestamp}`;

    const chap1Content = process.env.CHAP1_CONTENT || 'This is the content for chapter 1. It contains characters like Alice.';
    const chap2Content = process.env.CHAP2_CONTENT || 'This is the content for chapter 2. Alice meets Bob.';

    await prisma.novelChapter.createMany({
        data: [
            {
                id: chapter1Id,
                volumeId: volId,
                novelSourceId: novelId,
                index: 1,
                title: 'Chapter 1',
                rawContent: chap1Content,
                isSystemControlled: true,
            },
            {
                id: chapter2Id,
                volumeId: volId,
                novelSourceId: novelId,
                index: 2,
                title: 'Chapter 2',
                rawContent: chap2Content,
                isSystemControlled: true,
            },
        ],
    });

    // Output the IDs for shell script usage (Mandatory Contract)
    const result = {
        orgId,
        projId,
        novelId,
        sourceId,
        volId,
        chapter1Id,
        chapter2Id,
        userId,
    };

    // Use a clean delimiter if needed, but for now just raw JSON
    process.stdout.write(JSON.stringify(result) + '\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
// test
