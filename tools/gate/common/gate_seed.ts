import { PrismaClient } from '../../../packages/database/src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Gate Seeding: Ensuring User and Organization exist...');

    const userEmail = 'gate_user@local';
    const orgSlug = 'gate_org_stage3b';

    // 1. Ensure User exists
    let user = await prisma.user.findUnique({
        where: { email: userEmail },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email: userEmail,
                passwordHash: 'gate_password_hash',
                userType: 'individual' as any,
                role: 'admin' as any,
                tier: 'Free' as any,
            },
        });
        console.log(`✅ Created user: ${user.email} (id: ${user.id})`);
    } else {
        console.log(`✅ User already exists: ${user.email} (id: ${user.id})`);
    }

    // 1.1 Ensure Engine exists (ce06_novel_parsing)
    const engineKey = 'ce06_novel_parsing';
    const engine = await prisma.engine.findUnique({ where: { engineKey } });
    if (!engine) {
        await prisma.engine.create({
            data: {
                code: engineKey,
                name: 'CE06 Novel Parsing (Mock)',
                type: 'local',
                isActive: true,
                engineKey: engineKey,
                adapterName: 'ce06_novel_parsing', // Assuming adapter mapping exists or generic
                adapterType: 'local',
                config: {},
                enabled: true
            }
        });
        console.log(`✅ Created engine: ${engineKey}`);
    } else {
        console.log(`✅ Engine already exists: ${engineKey}`);
    }

    // 2. Ensure Organization exists
    let org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
    });

    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: 'Gate Org',
                slug: orgSlug,
                ownerId: user.id,
                credits: 1000,
                type: 'PERSONAL',
            },
        });
        console.log(`✅ Created organization: ${org.slug} (id: ${org.id})`);
    } else {
        // Ensure ownerId is correct if it exists but might have different owner in some edge case
        if (org.ownerId !== user.id) {
            await prisma.organization.update({
                where: { id: org.id },
                data: { ownerId: user.id }
            });
            console.log(`✅ Updated organization owner to: ${user.id}`);
        }
        console.log(`✅ Organization already exists: ${org.slug} (id: ${org.id})`);
    }

    // 3. Ensure Anchor Shot exists (for ce06_trigger.ts)
    const existingShot = await prisma.shot.findFirst();
    if (!existingShot) {
        console.log('🌱 Seeding anchor shot structure...');
        const project = await prisma.project.create({
            data: {
                name: 'Seed Project',
                organizationId: org.id,
                ownerId: user.id,
                status: 'in_progress' as any,
            }
        });

        const season = await prisma.season.create({
            data: {
                title: 'Seed Season',
                index: 1,
                projectId: project.id,
            }
        });

        const episode = await prisma.episode.create({
            data: {
                name: 'Seed Episode',
                index: 1,
                seasonId: season.id,
                projectId: project.id,
            }
        });

        const scene = await prisma.scene.create({
            data: {
                title: 'Seed Scene',
                index: 1,
                episodeId: episode.id,
                projectId: project.id,
            }
        });

        const shot = await prisma.shot.create({
            data: {
                index: 1,
                sceneId: scene.id,
                organizationId: org.id,
                type: 'SHOT',
            }
        });
        console.log(`✅ Created anchor shot: ${shot.id}`);
    } else {
        console.log(`✅ Anchor shot already exists.`);
    }

    console.log('✅ Gate seeding completed!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Gate seeding failed:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
