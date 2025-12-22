#!/usr/bin/env node
/**
 * 查询安全相关的 audit_logs
 * 用于验证降噪改进是否生效
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaClient } = require('../../packages/database/src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== 查询安全相关 Audit Logs ===\n');
    
    // 查询最近 50 条安全相关审计日志
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'API_SIGNATURE' } },
          { action: { contains: 'API_NONCE' } },
          { action: { contains: 'API_FORBIDDEN' } },
          { action: { contains: 'API_UNAUTHORIZED' } },
          { action: { contains: 'SECURITY_EVENT' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (auditLogs.length === 0) {
      console.log('⚠️  未找到安全相关 Audit Logs');
      console.log('   这可能表示：');
      console.log('   1. 安全事件尚未触发');
      console.log('   2. audit_logs 写入失败');
      console.log('   3. 查询条件需要调整');
    } else {
      console.log(`✅ 找到 ${auditLogs.length} 条安全相关记录：\n`);
      auditLogs.slice(0, 20).forEach((log, idx) => {
        const details = log.details || {};
        console.log(`${idx + 1}. Action: ${log.action}`);
        console.log(`   Resource Type: ${log.resourceType || 'N/A'}`);
        console.log(`   Resource ID: ${log.resourceId || 'N/A'}`);
        console.log(`   IP: ${log.ip || 'N/A'}`);
        console.log(`   User Agent: ${log.userAgent ? log.userAgent.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`   Details: ${JSON.stringify(details).substring(0, 150)}...`);
        console.log(`   Created At: ${log.createdAt}`);
        console.log('');
      });
    }

    // 统计各类型安全事件数量
    console.log('\n=== 安全事件统计 ===\n');
    const stats = {
      API_SIGNATURE_ERROR: 0,
      API_NONCE_REPLAY: 0,
      API_FORBIDDEN: 0,
      API_UNAUTHORIZED: 0,
      SECURITY_EVENT: 0,
    };

    auditLogs.forEach((log) => {
      if (log.action.includes('API_SIGNATURE')) stats.API_SIGNATURE_ERROR++;
      if (log.action.includes('API_NONCE')) stats.API_NONCE_REPLAY++;
      if (log.action.includes('API_FORBIDDEN')) stats.API_FORBIDDEN++;
      if (log.action.includes('API_UNAUTHORIZED')) stats.API_UNAUTHORIZED++;
      if (log.action.includes('SECURITY_EVENT')) stats.SECURITY_EVENT++;
    });

    Object.entries(stats).forEach(([action, count]) => {
      if (count > 0) {
        console.log(`  ${action}: ${count} 条`);
      }
    });
    console.log('');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

