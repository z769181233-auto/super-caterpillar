// Stage2-B 创建测试 Job
const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient({});

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('Usage: node stage2-b-create-job.js <projectId>');
    process.exit(1);
  }

  try {
    // 查找 Project 的 organizationId
    const project = await prisma.$queryRaw`
      SELECT id, organization_id
      FROM projects
      WHERE id = ${projectId}::uuid
      LIMIT 1
    `;

    if (!project || project.length === 0) {
      throw new Error(`Project ${projectId} not found`);
    }

    const orgId = project[0].organization_id;

    // 查找或创建 Shot
    let shot = await prisma.$queryRaw`
      SELECT s.id, s.scene_id, sc.episode_id
      FROM shots s
      JOIN scenes sc ON s.scene_id = sc.id
      JOIN episodes e ON sc.episode_id = e.id
      JOIN seasons se ON e.season_id = se.id
      WHERE se.project_id = ${projectId}::uuid
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    if (!shot || shot.length === 0) {
      // 创建最小测试数据
      const season = await prisma.$queryRaw`
        INSERT INTO seasons (id, project_id, name, index, created_at, updated_at)
        VALUES (gen_random_uuid(), ${projectId}::uuid, 'Test Season', 1, now(), now())
        RETURNING id
      `;

      const episode = await prisma.$queryRaw`
        INSERT INTO episodes (id, season_id, name, index, created_at, updated_at)
        VALUES (gen_random_uuid(), ${season[0].id}::uuid, 'Test Episode', 1, now(), now())
        RETURNING id
      `;

      const scene = await prisma.$queryRaw`
        INSERT INTO scenes (id, episode_id, name, index, created_at, updated_at)
        VALUES (gen_random_uuid(), ${episode[0].id}::uuid, 'Test Scene', 1, now(), now())
        RETURNING id
      `;

      const newShot = await prisma.$queryRaw`
        INSERT INTO shots (id, scene_id, name, index, created_at, updated_at)
        VALUES (gen_random_uuid(), ${scene[0].id}::uuid, 'Test Shot', 1, now(), now())
        RETURNING id, scene_id
      `;

      shot = [
        {
          id: newShot[0].id,
          scene_id: newShot[0].scene_id,
          episode_id: episode[0].id,
        },
      ];
    }

    const shotData = shot[0];

    // 创建 PENDING Job
    const job = await prisma.$queryRaw`
      INSERT INTO shot_jobs (
        id, organization_id, project_id, episode_id, scene_id, shot_id,
        type, status, payload, priority, max_retry, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${orgId}::uuid,
        ${projectId}::uuid,
        ${shotData.episode_id}::uuid,
        ${shotData.scene_id}::uuid,
        ${shotData.id}::uuid,
        'CE03_VISUAL_DENSITY',
        'PENDING',
        '{}'::jsonb,
        0,
        3,
        now(),
        now()
      )
      RETURNING id, status, type
    `;

    const jobData = job[0];
    console.log(`Job ID: ${jobData.id}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Type: ${jobData.type}`);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
