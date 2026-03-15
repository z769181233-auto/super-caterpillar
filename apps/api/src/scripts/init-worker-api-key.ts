/**
 * 初始化 Worker API Key 脚本
 * 用于在开发环境中创建固定的 Worker API Key
 *
 * 使用方法：
 * pnpm --filter api init:worker-api-key
 * 或在 apps/api 目录下：pnpm init:worker-api-key
 */

import { randomUUID } from 'crypto';
import * as util from 'util';

const { Client } = require('pg');

const WORKER_API_KEY = process.env.WORKER_API_KEY;
const WORKER_API_SECRET = process.env.WORKER_API_SECRET;

if (!WORKER_API_KEY || !WORKER_API_SECRET) {
  const errMsg = 'FATAL: WORKER_API_KEY and WORKER_API_SECRET must be provided via environment variables';
  process.stderr.write(errMsg + '\n');
  process.exit(1);
}

async function main() {
  process.stdout.write(util.format('========================================') + '\n');
  process.stdout.write(util.format('初始化 Worker API Key') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write('FATAL: DATABASE_URL must be provided via environment variables\n');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000'),
    query_timeout: Number(process.env.PRISMA_QUERY_TIMEOUT_MS || '5000'),
  });

  try {
    await client.connect();

    const existing = await client.query(
      `
        SELECT id, key
        FROM api_keys
        WHERE key = $1
        LIMIT 1
      `,
      [WORKER_API_KEY]
    );

    if (existing.rows[0]) {
      process.stdout.write(util.format(`✅ API Key 已存在: ${WORKER_API_KEY}`) + '\n');
      process.stdout.write(util.format('   如需重新创建，请先删除数据库中的记录。\n') + '\n');
      return;
    }

    const apiKey = await client.query(
      `
        INSERT INTO api_keys (
          id,
          key,
          "secretHash",
          name,
          status,
          "createdAt",
          "updatedAt",
          "secretVersion"
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE'::api_key_status, NOW(), NOW(), 1)
        RETURNING id, key
      `,
      [randomUUID(), WORKER_API_KEY, WORKER_API_SECRET, 'Worker Dev API Key']
    );

    process.stdout.write(util.format('✅ Worker API Key 创建成功！') + '\n');
    process.stdout.write(util.format(`   Key: ${apiKey.rows[0].key}`) + '\n');
    process.stdout.write(util.format(`   Secret: ${WORKER_API_SECRET}`) + '\n');
    process.stdout.write(util.format('\n请将以下配置添加到 .env 文件：') + '\n');
    process.stdout.write(util.format(`WORKER_API_KEY=${WORKER_API_KEY}`) + '\n');
    process.stdout.write(util.format(`WORKER_API_SECRET=${WORKER_API_SECRET}`) + '\n');
    process.stdout.write(util.format('========================================\n') + '\n');
  } catch (error: any) {
    process.stderr.write(util.format('❌ 创建 API Key 失败:', error.message) + '\n');
    process.stderr.write(util.format(error.stack) + '\n');
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
