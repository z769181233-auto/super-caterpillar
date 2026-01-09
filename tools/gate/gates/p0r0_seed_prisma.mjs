/**
 * P0-R0 Gate Prisma Seed
 * 
 * 使用 Prisma Client 创建测试数据，避免 SQL 与 schema 不一致
 * 用法: node tools/gate/gates/p0r0_seed_prisma.mjs
 */

import { PrismaClient } from '../../../packages/database/src/generated/prisma/index.js';

const prisma = new PrismaClient();

// 固定 ID（幂等清理）
const ORG_ID = 'org-p0r0-gate';
const USER_ID = 'user-p0r0-gate';
const PROJECT_ID = 'proj-p0r0-gate';
const EPISODE_ID = 'episode-p0r0-gate';
const SCENE_ID = 'scene-p0r0-gate';
const SHOT_ID = 'shot-p0r0-gate';

async function main() {
    console.log('[P0R0-Seed] Starting...');

    // 1. 清理旧数据（顺序重要，按 FK 依赖反向）
    console.log('[P0R0-Seed] Cleaning old data...');
    await prisma.shot.deleteMany({ where: { id: { startsWith: 'shot-p0r0' } } }).catch(() => { });
    await prisma.scene.deleteMany({ where: { id: { startsWith: 'scene-p0r0' } } }).catch(() => { });
    await prisma.episode.deleteMany({ where: { id: { startsWith: 'episode-p0r0' } } }).catch(() => { });
    await prisma.project.deleteMany({ where: { id: PROJECT_ID } }).catch(() => { });
    await prisma.organization.deleteMany({ where: { id: ORG_ID } }).catch(() => { });
    await prisma.user.deleteMany({ where: { id: USER_ID } }).catch(() => { });

    // 2. 创建基础数据
    console.log('[P0R0-Seed] Creating User...');
    const user = await prisma.user.create({
        data: {
            id: USER_ID,
            email: 'p0r0-gate@test.com',
            passwordHash: 'gate-test-hash',
        },
    });

    console.log('[P0R0-Seed] Creating Organization...');
    const org = await prisma.organization.create({
        data: {
            id: ORG_ID,
            name: 'P0-R0 Gate Org',
            ownerId: user.id,
            credits: 10000,
        },
    });

    console.log('[P0R0-Seed] Creating Project...');
    const project = await prisma.project.create({
        data: {
            id: PROJECT_ID,
            name: 'P0-R0 Gate Project',
            organizationId: org.id,
            ownerId: user.id,
        },
    });

    console.log('[P0R0-Seed] Creating Episode...');
    const episode = await prisma.episode.create({
        data: {
            id: EPISODE_ID,
            projectId: project.id,
            index: 1,
        },
    });

    console.log('[P0R0-Seed] Creating Scene...');
    const scene = await prisma.scene.create({
        data: {
            id: SCENE_ID,
            projectId: project.id,
            episodeId: episode.id,
            index: 1,
        },
    });

    console.log('[P0R0-Seed] Creating Shot...');
    const shot = await prisma.shot.create({
        data: {
            id: SHOT_ID,
            sceneId: scene.id,
            index: 1,
        },
    });

    console.log('[P0R0-Seed] ✅ Done!');
    console.log(`  User: ${user.id}`);
    console.log(`  Org: ${org.id}`);
    console.log(`  Project: ${project.id}`);
    console.log(`  Episode: ${episode.id}`);
    console.log(`  Scene: ${scene.id}`);
    console.log(`  Shot: ${shot.id}`);

    // 输出 JSON 供 Gate 使用
    const result = {
        userId: user.id,
        orgId: org.id,
        projectId: project.id,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,
    };

    console.log(JSON.stringify(result));
}

main()
    .catch((e) => {
        console.error('[P0R0-Seed] ❌ Error:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
