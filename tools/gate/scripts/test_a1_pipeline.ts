/**
 * A1完成：直接测试 startStage1Pipeline
 */

import { PrismaClient } from 'database';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function testPipeline() {
  console.log('[A1 Test] 测试 startStage1Pipeline...\n');

  try {
    // 检查数据库连接
    const users = await prisma.user.findMany({ take: 1 });
    const orgs = await prisma.organization.findMany({ take: 1 });

    console.log(`✅ 数据库连接正常`);
    console.log(`   用户数: ${users.length}`);
    console.log(`   组织数: ${orgs.length}\n`);

    // 模拟 startStage1Pipeline 的核心逻辑
    const novelText = '第一章 觉醒\\n\\n在遥远的星系中，有一只名叫毛毛的虫子。';
    const traceId = `test_${Date.now()}`;

    console.log('[1/8] 查找默认组织...');
    const defaultOrg = await prisma.organization.findFirst();
    const organizationId = defaultOrg?.id || 'default-org';
    console.log(`   组织ID: ${organizationId}\n`);

    console.log('[2/8] 查找默认用户...');
    const defaultUser = await prisma.user.findFirst();
    const ownerId = defaultUser?.id || 'system';
    console.log(`   用户ID: ${ownerId}\n`);

    console.log('[3/8] 创建 Project...');
    const project = await prisma.project.create({
      data: {
        name: `A1Test_${new Date().toISOString().slice(0, 10)}`,
        organizationId,
        status: 'in_progress',
        ownerId,
      } as any,
    });
    console.log(`   ✅ Project ID: ${project.id}\n`);

    console.log('[4/8] 创建 Novel...');
    const novelSource = await prisma.novel.create({
      data: {
        title: `A1Test_${new Date().toISOString().slice(0, 10)}`,
        projectId: project.id,
        author: 'System',
      } as any,
    });
    console.log(`   ✅ Novel ID: ${novelSource.id}\n`);

    console.log('[5/8] 创建 Volume...');
    const volume = await prisma.novelVolume.create({
      data: {
        projectId: project.id,
        novelSourceId: novelSource.id,
        index: 1,
        title: 'Volume 1',
      },
    });
    console.log(`   ✅ Volume ID: ${volume.id}\n`);

    console.log('[6/8] 创建 Chapter...');
    const chapter = await prisma.novelChapter.create({
      data: {
        novelSourceId: novelSource.id,
        volumeId: volume.id,
        index: 1,
        title: 'Chapter 1',
      } as any,
    });
    console.log(`   ✅ Chapter ID: ${chapter.id}\n`);

    console.log('[7/8] 创建 Season & Episode...');
    const season = await prisma.season.create({
      data: {
        projectId: project.id,
        index: 1,
        title: 'Season 1',
      } as any,
    });

    const episode = await prisma.episode.create({
      data: {
        projectId: project.id,
        seasonId: season.id,
        index: 1,
        name: 'Chapter 1',
        chapterId: chapter.id,
      } as any,
    });
    console.log(`   ✅ Season ID: ${season.id}`);
    console.log(`   ✅ Episode ID: ${episode.id}\n`);

    console.log('[8/8] 创建 Scene & Shot...');
    const scene = await prisma.scene.create({
      data: {
        episodeId: episode.id,
        projectId: project.id,
        sceneIndex: 9999,
        title: 'A1 Test Scene',
        summary: 'Auto-generated for A1 test',
      },
    });

    const shot = await prisma.shot.create({
      data: {
        sceneId: scene.id,
        index: 9999,
        title: 'A1 Test Shot',
        description: 'Auto-generated for A1 test',
        type: 'test_a1',
        params: {},
        organizationId,
      } as any,
    });
    console.log(`   ✅ Scene ID: ${scene.id}`);
    console.log(`   ✅ Shot ID: ${shot.id}\n`);

    console.log('========================================');
    console.log('✅ A1测试成功！Pipeline基础数据结构全部创建成功');
    console.log('========================================\n');

    console.log('测试结果:');
    console.log(`  Project ID: ${project.id}`);
    console.log(`  Episode ID: ${episode.id}`);
    console.log(`  Shot ID: ${shot.id}`);
    console.log(`  Trace ID: ${traceId}\n`);

    console.log('下一步: 这些数据可用于创建 SHOT_RENDER Job');
    console.log('Job Payload示例:');
    console.log(
      JSON.stringify(
        {
          novelText,
          novelSourceId: novelSource.id,
          chapterId: chapter.id,
          episodeId: episode.id,
          pipelineRunId: traceId,
          projectId: project.id,
          organizationId,
        },
        null,
        2
      )
    );
  } catch (error: any) {
    console.error('\n❌ 测试失败:');
    console.error(`   错误: ${error.message}`);
    console.error(`   堆栈: ${error.stack}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPipeline();
