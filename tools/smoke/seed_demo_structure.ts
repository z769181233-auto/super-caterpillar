
/**
 * Smoke Test: Seed Demo Structure
 * Creates a complete hierarchy: Project -> Season -> Episode -> Scene -> Shot
 * Requirement: 1 Season, 2 Episodes, 2 Episodes * 3 Scenes * 5 Shots = 30 Shots
 */

import { PrismaClient } from 'database';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    // Try to use the smoke user if available, otherwise fallback
    const EMAIL = process.env.TEST_USER_EMAIL || 'smoke_admin@scu.local';
    const PROJECT_NAME = 'Demo Structure Project';
    const DEMO_ENV_FILE = path.join(__dirname, '.demo_env');

    console.log(`[SEED] Seeding demo structure for user ${EMAIL}...`);

    // 1. Find User & Org
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) throw new Error(`User ${EMAIL} not found under DATABASE_URL=${process.env.DATABASE_URL?.substring(0, 15)}...`);

    // Use 'smoke-tenant' to ensure alignment with ensure_auth_state.ts
    const TENANT_SLUG = 'smoke-tenant';

    let orgId = user.defaultOrganizationId;

    // Find organization by slug 'smoke-tenant' which ensure_auth_state uses
    const targetOrg = await prisma.organization.findFirst({
        where: { slug: TENANT_SLUG }
    });

    if (targetOrg) {
        // Verify user is member
        const membership = await prisma.organizationMember.findFirst({
            where: { userId: user.id, organizationId: targetOrg.id }
        });
        if (membership) {
            orgId = targetOrg.id;
        } else {
            console.warn(`[SEED] User not member of ${TENANT_SLUG}, falling back to default/first found.`);
            // Fallback logic below
        }
    }

    if (!orgId) {
        const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
        if (!membership) throw new Error('User has no organization');
        orgId = membership.organizationId;
    }

    console.log(`[SEED] Using Organization: ${orgId}`);

    // 2. Create/Upsert Project
    // We use a fixed ID if possible for stability, or just find by name
    let project = await prisma.project.findFirst({
        where: { ownerId: user.id, name: PROJECT_NAME }
    });

    if (!project) {
        project = await prisma.project.create({
            data: {
                name: PROJECT_NAME,
                description: 'Auto-generated demo for structure contract verification',
                ownerId: user.id,
                organizationId: orgId,
                status: 'in_progress',
            }
        });
        console.log(`[SEED] Created Project: ${project.id}`);
    } else {
        console.log(`[SEED] Found Project: ${project.id}`);
    }

    const projectId = project.id;

    // 3. Create Season 1
    // Use upsert-like logic
    let season = await prisma.season.findFirst({
        where: { projectId, index: 1 }
    });
    if (!season) {
        season = await prisma.season.create({
            data: {
                projectId,
                index: 1,
                title: 'Season 1'
            }
        });
        console.log(`[SEED] Created Season 1: ${season.id}`);
    }

    // 4. Create Episodes (1, 2)
    for (let epIndex = 1; epIndex <= 2; epIndex++) {
        let episode = await prisma.episode.findFirst({
            where: { seasonId: season.id, index: epIndex }
        });
        if (!episode) {
            episode = await prisma.episode.create({
                data: {
                    seasonId: season.id,
                    index: epIndex,
                    name: `Episode ${epIndex}`,
                    projectId // Compatible legacy field
                }
            });
            console.log(`[SEED] Created Episode ${epIndex}: ${episode.id}`);
        }

        // 5. Create Scenes (1..3)
        for (let scIndex = 1; scIndex <= 3; scIndex++) {
            let scene = await prisma.scene.findFirst({
                where: { episodeId: episode.id, index: scIndex }
            });
            if (!scene) {
                scene = await prisma.scene.create({
                    data: {
                        episodeId: episode.id,
                        index: scIndex,
                        title: `Scene ${epIndex}-${scIndex}`,
                        projectId // Compatible legacy field
                    }
                });
                console.log(`[SEED] Created Scene ${epIndex}-${scIndex}`);
            }

            // 6. Create Shots (1..5)
            // Check existing count to avoid dups if run multiple times
            const shotCount = await prisma.shot.count({
                where: { sceneId: scene.id }
            });

            if (shotCount < 5) {
                const shotsToCreate = 5 - shotCount;
                for (let k = 1; k <= shotsToCreate; k++) {
                    const rawIndex = shotCount + k;
                    await prisma.shot.create({
                        data: {
                            sceneId: scene.id,
                            index: rawIndex,
                            title: `Shot ${epIndex}-${scIndex}-${rawIndex}`,
                            type: 'IMAGE', // Default
                            durationSeconds: 2,
                            organizationId: orgId
                        }
                    });
                }
                console.log(`[SEED] Created ${shotsToCreate} Shots for Scene ${epIndex}-${scIndex}`);
            }
        }
    }

    // 7. Write .demo_env
    fs.writeFileSync(DEMO_ENV_FILE, `TEST_PROJECT_ID="${projectId}"\n`);
    console.log(`[SEED] Setup complete. Project ID written to ${DEMO_ENV_FILE}`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
