// Stage2-B 查询 audit_logs
const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient({});

async function main() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: node stage2-b-query-audit-logs.js <jobId>');
    process.exit(1);
  }

  try {
    console.log(`查询 Job ${jobId} 的 audit_logs...\n`);

    const logs = await prisma.$queryRaw`
      SELECT action, resource_type, resource_id, details, created_at
      FROM audit_logs
      WHERE resource_id = ${jobId}::uuid
        AND action IN ('JOB_DISPATCHED', 'JOB_STARTED', 'JOB_REPORT_RECEIVED', 'JOB_SUCCEEDED')
      ORDER BY created_at ASC
    `;

    if (!logs || logs.length === 0) {
      console.log('⚠️  未找到相关 audit_logs');
    } else {
      console.log(`✅ 找到 ${logs.length} 条记录：\n`);
      logs.forEach((log, idx) => {
        console.log(`${idx + 1}. Action: ${log.action}`);
        console.log(`   Resource Type: ${log.resource_type}`);
        console.log(`   Resource ID: ${log.resource_id}`);
        console.log(`   Details: ${JSON.stringify(log.details || {}, null, 2)}`);
        console.log(`   Created At: ${log.created_at}`);
        console.log('');
      });
    }

    // 验证必需的动作
    const actions = logs.map((l) => l.action);
    const required = ['JOB_DISPATCHED', 'JOB_STARTED', 'JOB_REPORT_RECEIVED'];
    const missing = required.filter((a) => !actions.includes(a));

    if (missing.length === 0) {
      console.log('✅ 所有必需的 audit_logs 动作都已记录');
    } else {
      console.log(`⚠️  缺少以下动作: ${missing.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
