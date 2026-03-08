// Stage2-A 创建测试数据脚本
const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient({});

async function main() {
  try {
    console.log('=== Stage2-A 创建测试数据 ===\n');

    // 1. 创建或获取测试 Worker
    const workerId = 'test_worker_001';
    let worker = await prisma.$queryRaw`
      SELECT id, worker_id, status 
      FROM worker_nodes 
      WHERE worker_id = ${workerId}
      LIMIT 1
    `;

    if (!worker || worker.length === 0) {
      const newWorker = await prisma.$executeRaw`
        INSERT INTO worker_nodes (id, worker_id, status, capabilities, created_at, updated_at)
        VALUES (gen_random_uuid(), ${workerId}, 'online', '{}'::jsonb, now(), now())
        RETURNING id, worker_id
      `;
      console.log('✅ 创建测试 Worker:', workerId);
    } else {
      console.log('✅ 测试 Worker 已存在:', workerId);
    }

    // 2. 查找现有 Shot
    const shot = await prisma.$queryRaw`
      SELECT s.id, s.scene_id, sc.episode_id, e.season_id, se.project_id, se.organization_id
      FROM shots s
      JOIN scenes sc ON s.scene_id = sc.id
      JOIN episodes e ON sc.episode_id = e.id
      JOIN seasons se ON e.season_id = se.id
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    if (!shot || shot.length === 0) {
      console.error('❌ 未找到 Shot，请先创建测试数据');
      process.exit(1);
    }

    const shotData = shot[0];
    console.log('✅ 找到 Shot:', shotData.id);
    console.log('   Project ID:', shotData.project_id);

    // 3. 创建 PENDING Job
    const job = await prisma.$queryRaw`
      INSERT INTO shot_jobs (
        id, organization_id, project_id, episode_id, scene_id, shot_id,
        type, status, payload, priority, max_retry, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${shotData.organization_id}::uuid,
        ${shotData.project_id}::uuid,
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
    console.log('\n✅ 创建 Job:');
    console.log('   ID:', jobData.id);
    console.log('   Status:', jobData.status);
    console.log('   Type:', jobData.type);

    // 4. 创建 WorkerHeartbeat
    await prisma.$executeRaw`
      INSERT INTO worker_heartbeats (worker_id, last_seen_at, status, created_at, updated_at)
      VALUES (${workerId}, now(), 'ALIVE', now(), now())
      ON CONFLICT (worker_id) DO UPDATE
      SET last_seen_at = now(), status = 'ALIVE', updated_at = now()
    `;

    console.log('\n✅ WorkerHeartbeat 已更新');

    // 输出验证信息
    console.log('\n=== 验证数据已准备 ===');
    console.log('Job ID:', jobData.id);
    console.log('Worker ID:', workerId);
    console.log('Shot ID:', shotData.id);
    console.log('\n请继续执行 API 测试步骤...');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
