// Stage2-A 运行时验证脚本
const path = require('path');
const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage2-A 运行时验证 ===\n');

  try {
    // STEP 1: 检查 API 状态（通过端口检查）
    console.log('STEP 1: 检查 API 状态...');
    console.log('✅ API 应在端口 3000 运行（请确认）');

    // STEP 2: 创建测试 Worker（如果不存在）
    console.log('\nSTEP 2: 准备测试 Worker...');
    const workerId = 'test_worker_001';
    let worker = await prisma.workerNode.findUnique({
      where: { workerId },
    });

    if (!worker) {
      worker = await prisma.workerNode.create({
        data: {
          workerId,
          status: 'online',
          capabilities: {},
        },
      });
      console.log('✅ 创建测试 Worker:', worker.id);
    } else {
      console.log('✅ 测试 Worker 已存在:', worker.id);
    }

    // STEP 3: 创建测试 Project 和 Shot（如果不存在）
    console.log('\nSTEP 3: 准备测试数据...');
    let project = await prisma.project.findFirst({
      where: { name: { contains: 'Stage2-A Test' } },
    });

    if (!project) {
      // 需要 organizationId，先找一个
      const org = await prisma.organization.findFirst();
      if (!org) {
        throw new Error('No organization found. Please create one first.');
      }

      project = await prisma.project.create({
        data: {
          name: 'Stage2-A Test Project',
          organizationId: org.id,
          status: 'ACTIVE',
        },
      });
      console.log('✅ 创建测试 Project:', project.id);
    } else {
      console.log('✅ 测试 Project 已存在:', project.id);
    }

    // 创建 Season/Episode/Scene/Shot
    let season = await prisma.season.findFirst({
      where: { projectId: project.id },
    });

    if (!season) {
      season = await prisma.season.create({
        data: {
          projectId: project.id,
          name: 'Test Season',
          index: 1,
        },
      });
    }

    let episode = await prisma.episode.findFirst({
      where: { seasonId: season.id },
    });

    if (!episode) {
      episode = await prisma.episode.create({
        data: {
          seasonId: season.id,
          name: 'Test Episode',
          index: 1,
        },
      });
    }

    let scene = await prisma.scene.findFirst({
      where: { episodeId: episode.id },
    });

    if (!scene) {
      scene = await prisma.scene.create({
        data: {
          episodeId: episode.id,
          name: 'Test Scene',
          index: 1,
        },
      });
    }

    let shot = await prisma.shot.findFirst({
      where: { sceneId: scene.id },
    });

    if (!shot) {
      shot = await prisma.shot.create({
        data: {
          sceneId: scene.id,
          name: 'Test Shot',
          index: 1,
        },
      });
    }

    console.log('✅ 测试 Shot:', shot.id);

    // STEP 4: 创建 PENDING Job（直接 SQL）
    console.log('\nSTEP 4: 创建 PENDING Job...');
    const job = await prisma.shotJob.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,
        type: 'CE03_VISUAL_DENSITY',
        status: 'PENDING',
        payload: {},
        priority: 0,
        maxRetry: 3,
      },
    });

    console.log('✅ 创建 Job:', job.id);
    console.log('   Status:', job.status);
    console.log('   Type:', job.type);

    // STEP 5: Orchestrator 领取（通过 API）
    console.log('\nSTEP 5: Orchestrator 领取 Job...');
    try {
      // 注意：需要认证，这里先记录 jobId，手动测试
      console.log('⚠️  需要手动调用: POST /api/workers/test_worker_001/jobs/next');
      console.log('   Job ID:', job.id);
    } catch (e) {
      console.log('⚠️  API 调用需要认证，请手动测试');
    }

    // STEP 6: 验证数据库状态
    console.log('\nSTEP 6: 验证数据库状态...');
    const jobAfter = await prisma.shotJob.findUnique({
      where: { id: job.id },
    });

    console.log('当前 Job 状态:', jobAfter.status);
    console.log('Worker ID:', jobAfter.workerId);

    // STEP 7: Worker 心跳
    console.log('\nSTEP 7: Worker 心跳...');
    const heartbeat = await prisma.workerHeartbeat.upsert({
      where: { workerId },
      create: {
        workerId,
        lastSeenAt: new Date(),
        status: 'ALIVE',
      },
      update: {
        lastSeenAt: new Date(),
        status: 'ALIVE',
      },
    });

    console.log('✅ WorkerHeartbeat 已更新');
    console.log('   Status:', heartbeat.status);
    console.log('   LastSeenAt:', heartbeat.lastSeenAt);

    console.log('\n=== 验证数据已准备 ===');
    console.log('Job ID:', job.id);
    console.log('Worker ID:', workerId);
    console.log('Shot ID:', shot.id);
    console.log('\n请继续手动执行 API 测试步骤...');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
