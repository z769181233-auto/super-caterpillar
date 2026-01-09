#!/usr/bin/env node
/**
 * 查询验证数据（Quality Metrics 和 Audit Logs）
 * 用于运行时验证报告
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const projectId = process.env.TEST_PROJECT_ID;

  if (!projectId) {
    console.error('❌ TEST_PROJECT_ID 未设置');
    process.exit(1);
  }

  try {
    console.log('=== Quality Metrics 查询 ===\n');

    const qualityMetrics = await prisma.qualityMetrics.findMany({
      where: {
        projectId,
        engine: { in: ['CE03', 'CE04'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (qualityMetrics.length === 0) {
      console.log('⚠️  未找到 Quality Metrics 记录');
    } else {
      console.log(`✅ 找到 ${qualityMetrics.length} 条记录：\n`);
      qualityMetrics.forEach((qm, idx) => {
        const metadata = qm.metadata || {};
        console.log(`${idx + 1}. Engine: ${qm.engine}`);
        console.log(`   Project ID: ${qm.projectId}`);
        console.log(`   Visual Density Score: ${qm.visualDensityScore || 'N/A'}`);
        console.log(`   Enrichment Quality: ${qm.enrichmentQuality || 'N/A'}`);
        console.log(`   Job ID: ${metadata.jobId || 'N/A'}`);
        console.log(`   Trace ID: ${metadata.traceId || 'N/A'}`);
        console.log(`   Engine Key: ${metadata.engineKey || 'N/A'}`);
        console.log(`   Created At: ${qm.createdAt}`);
        console.log('');
      });
    }

    console.log('\n=== Audit Logs 查询 ===\n');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { details: { path: ['traceId'], string_contains: 'ce_pipeline' } },
          { details: { path: ['jobType'], string_contains: 'CE03' } },
          { details: { path: ['jobType'], string_contains: 'CE04' } },
          { details: { path: ['jobType'], string_contains: 'CE06' } },
          { action: { contains: 'SAFETY' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (auditLogs.length === 0) {
      console.log('⚠️  未找到相关 Audit Logs');
    } else {
      console.log(`✅ 找到 ${auditLogs.length} 条记录：\n`);
      auditLogs.slice(0, 20).forEach((log, idx) => {
        const details = log.details || {};
        console.log(`${idx + 1}. Action: ${log.action}`);
        console.log(`   Resource Type: ${log.resourceType || 'N/A'}`);
        console.log(`   Resource ID: ${log.resourceId || 'N/A'}`);
        console.log(`   Trace ID: ${details.traceId || 'N/A'}`);
        console.log(`   Status: ${details.status || 'N/A'}`);
        console.log(`   Job Type: ${details.jobType || 'N/A'}`);
        console.log(
          `   Safety Check: ${details.safetyCheck ? JSON.stringify(details.safetyCheck).substring(0, 100) : 'N/A'}`
        );
        console.log(`   Created At: ${log.createdAt}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
