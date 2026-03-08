#!/usr/bin/env ts-node

/**
 * Job 索引审计脚本
 * 检查 jobs 相关索引是否覆盖领取 SQL 的 where/order by
 * 输出 EXPLAIN ANALYZE 证据
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient({});

async function auditJobIndexes() {
  console.log('🔍 Auditing Job Indexes...\n');

  // 1. 检查当前索引
  console.log('1. Current Indexes on shot_jobs table:');
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'shot_jobs'
    ORDER BY indexname;
  `;

  console.log(`   Found ${indexes.length} indexes:\n`);
  indexes.forEach((idx) => {
    console.log(`   - ${idx.indexname}`);
    console.log(`     ${idx.indexdef}\n`);
  });

  // 2. 分析领取 SQL 的查询计划
  console.log('2. Analyzing Query Plan for Job Claiming SQL:');
  console.log("   (SELECT ... WHERE status = 'PENDING' ORDER BY priority DESC, createdAt ASC)\n");

  const explainResult = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
    EXPLAIN ANALYZE
    SELECT sj.*
    FROM shot_jobs sj
    WHERE sj.status = 'PENDING'
      AND sj.type = 'VIDEO_RENDER'
    ORDER BY sj.priority DESC, sj.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  `;

  console.log('   Query Plan:');
  explainResult.forEach((row) => {
    console.log(`   ${row['QUERY PLAN']}`);
  });
  console.log('');

  // 3. 检查关键字段的索引覆盖
  console.log('3. Checking Index Coverage:');

  const criticalFields = [
    { field: 'status', usedIn: 'WHERE clause' },
    { field: 'type', usedIn: 'WHERE clause' },
    { field: 'priority', usedIn: 'ORDER BY clause' },
    { field: 'created_at', usedIn: 'ORDER BY clause' },
    { field: 'organization_id', usedIn: 'WHERE clause (capacity checks)' },
  ];

  const indexFields = indexes
    .map((idx) => {
      // 提取索引字段（简化处理）
      const match = idx.indexdef.match(/\(([^)]+)\)/);
      return match ? match[1].split(',').map((f) => f.trim().replace(/"/g, '')) : [];
    })
    .flat();

  criticalFields.forEach((field) => {
    const hasIndex = indexFields.some(
      (idxField) =>
        idxField.toLowerCase() === field.field.toLowerCase() ||
        idxField.toLowerCase().endsWith(`_${field.field.toLowerCase()}`)
    );

    const status = hasIndex ? '✅' : '❌';
    console.log(`   ${status} ${field.field} (${field.usedIn})`);
  });

  // 4. 建议的索引
  console.log('\n4. Recommended Indexes:');
  console.log('   CREATE INDEX IF NOT EXISTS idx_shot_jobs_status_type_priority_created');
  console.log('     ON shot_jobs(status, type, priority DESC, created_at ASC);');
  console.log('');
  console.log('   CREATE INDEX IF NOT EXISTS idx_shot_jobs_org_status_type');
  console.log('     ON shot_jobs(organization_id, status, type);');
  console.log('');

  // 5. 连接池配置检查
  console.log('5. Database Connection Pool Configuration:');
  const poolConfig = await prisma.$queryRaw<Array<{ setting: string; current_setting: string }>>`
    SELECT name as setting, current_setting(name) as current_setting
    FROM pg_settings
    WHERE name IN ('max_connections', 'shared_buffers', 'work_mem')
    ORDER BY name;
  `;

  poolConfig.forEach((config) => {
    console.log(`   ${config.setting}: ${config.current_setting}`);
  });
  console.log('');

  // 6. 慢查询检查（如果有 pg_stat_statements）
  try {
    console.log('6. Slow Query Analysis (if pg_stat_statements is enabled):');
    const slowQueries = await prisma.$queryRaw<
      Array<{
        query: string;
        calls: bigint;
        total_time: number;
        mean_time: number;
      }>
    >`
      SELECT 
        LEFT(query, 100) as query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time
      FROM pg_stat_statements
      WHERE query LIKE '%shot_jobs%'
      ORDER BY mean_exec_time DESC
      LIMIT 5;
    `;

    if (slowQueries.length > 0) {
      slowQueries.forEach((q, i) => {
        console.log(`   ${i + 1}. Mean time: ${q.mean_time.toFixed(2)}ms, Calls: ${q.calls}`);
        console.log(`      ${q.query}...`);
      });
    } else {
      console.log('   (pg_stat_statements not enabled or no slow queries found)');
    }
  } catch (error) {
    console.log('   (pg_stat_statements extension not available)');
  }

  console.log('\n✅ Audit completed!\n');
}

auditJobIndexes()
  .catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
