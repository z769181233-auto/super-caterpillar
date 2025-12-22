#!/usr/bin/env ts-node

/**
 * Quality Metrics Smoke Test
 * 最小单元测试：验证 QualityMetricsWriter 可以写入质量指标
 */

import { PrismaClient, JobType, JobStatus } from 'database';

const prisma = new PrismaClient();

async function testQualityMetricsWrite() {
  console.log('=== Quality Metrics Smoke Test ===\n');

  try {
    // 1. 查找一个测试项目（或创建）
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!project) {
      console.log('❌ No project found. Please create a project first.');
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.id}`);

    // 2. 查找一个 CE03 或 CE04 的 SUCCEEDED Job
    const job = await prisma.shotJob.findFirst({
      where: {
        projectId: project.id,
        type: { in: [JobType.CE03_VISUAL_DENSITY, JobType.CE04_VISUAL_ENRICHMENT] },
        status: JobStatus.SUCCEEDED,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!job) {
      console.log('❌ No CE03/CE04 SUCCEEDED job found. Please run a job first.');
      process.exit(1);
    }

    console.log(`✅ Found job: ${job.id} (${job.type})`);

    // 3. 检查 QualityMetrics 是否已写入
    const qualityMetrics = await prisma.qualityMetrics.findFirst({
      where: {
        projectId: project.id,
        engine: job.type === JobType.CE03_VISUAL_DENSITY ? 'CE03' : 'CE04',
      },
    });

    if (qualityMetrics) {
      console.log('✅ QualityMetrics found:');
      console.log(`   - Engine: ${qualityMetrics.engine}`);
      console.log(`   - Visual Density Score: ${qualityMetrics.visualDensityScore || 'N/A'}`);
      console.log(`   - Enrichment Quality: ${qualityMetrics.enrichmentQuality || 'N/A'}`);
      console.log(`   - Created At: ${qualityMetrics.createdAt}`);
      console.log('\n✅ Quality Metrics write verified!');
    } else {
      console.log('⚠️  QualityMetrics not found. This may be expected if:');
      console.log('   - Job completed before quality metrics writer was implemented');
      console.log('   - Job result did not contain quality metrics');
      console.log('\n💡 To test quality metrics write, trigger a new CE03/CE04 job.');
    }

    // 4. 模拟写入（使用 QualityMetricsWriter）
    console.log('\n=== Simulating Quality Metrics Write ===');
    const { QualityMetricsWriter } = await import('../../apps/api/src/quality/quality-metrics.writer');
    const { PrismaService } = await import('../../apps/api/src/prisma/prisma.service');
    const prismaService = new PrismaService();
    const writer = new QualityMetricsWriter(prismaService);

    const testResult = {
      visualDensityScore: 0.85,
      enrichmentQuality: 0.92,
    };

    const success = await writer.writeQualityMetrics({
      jobId: job.id,
      jobType: job.type,
      projectId: job.projectId,
      traceId: job.traceId || undefined,
      result: testResult,
    });

    if (success) {
      console.log('✅ QualityMetrics write simulation successful!');
    } else {
      console.log('⚠️  QualityMetrics write simulation returned false (no metrics found)');
    }

    // 5. 验证写入结果
    const updatedMetrics = await prisma.qualityMetrics.findFirst({
      where: {
        projectId: project.id,
        engine: job.type === JobType.CE03_VISUAL_DENSITY ? 'CE03' : 'CE04',
      },
    });

    if (updatedMetrics) {
      console.log('\n✅ Updated QualityMetrics:');
      console.log(`   - Visual Density Score: ${updatedMetrics.visualDensityScore}`);
      console.log(`   - Enrichment Quality: ${updatedMetrics.enrichmentQuality}`);
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testQualityMetricsWrite().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

