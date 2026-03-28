/**
 * 初始化 Worker API Key 脚本
 * 用于在开发环境中创建固定的 Worker API Key
 *
 * 使用方法：
 * pnpm --filter api init:worker-api-key
 * 或在 apps/api 目录下：pnpm init:worker-api-key
 */

import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as util from 'util';
import { createRuntimePgClient, getRuntimeDbTimeoutMs } from '../prisma/pg-runtime.util';
import { SecretEncryptionService } from '../security/api-security/secret-encryption.service';

const root = path.resolve(__dirname, '../../../..');
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

if (!process.env.API_KEY_MASTER_KEY_B64 && process.env.NODE_ENV !== 'production') {
  process.env.API_KEY_MASTER_KEY_B64 = Buffer.alloc(32, 7).toString('base64');
}

const WORKER_API_KEY = process.env.WORKER_API_KEY;
const WORKER_API_SECRET = process.env.WORKER_API_SECRET;

if (!WORKER_API_KEY || !WORKER_API_SECRET) {
  const errMsg = 'FATAL: WORKER_API_KEY and WORKER_API_SECRET must be provided via environment variables';
  process.stderr.write(errMsg + '\n');
  process.exit(1);
}

const workerApiKey = WORKER_API_KEY;
const workerApiSecret = WORKER_API_SECRET;

async function main() {
  process.stdout.write(util.format('========================================') + '\n');
  process.stdout.write(util.format('初始化 Worker API Key') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write('FATAL: DATABASE_URL must be provided via environment variables\n');
    process.exit(1);
  }

  const client = createRuntimePgClient({
    applicationName: 'super-caterpillar-api-init-worker-key',
    connectionString: databaseUrl,
    queryTimeoutMs: getRuntimeDbTimeoutMs('query'),
  });
  const secretEncryptionService = new SecretEncryptionService();

  try {
    await client.connect();

    const existing = await client.query(
      `
        SELECT id, key
        FROM api_keys
        WHERE key = $1
        LIMIT 1
      `,
      [workerApiKey]
    );

    if (existing.rows[0]) {
      process.stdout.write(util.format(`✅ API Key 已存在: ${workerApiKey}`) + '\n');
      process.stdout.write(util.format('   如需重新创建，请先删除数据库中的记录。\n') + '\n');
      return;
    }

    if (!secretEncryptionService.isMasterKeyConfigured()) {
      throw new Error('FATAL: API_KEY_MASTER_KEY_B64 must be provided via environment variables');
    }

    const encrypted = secretEncryptionService.encryptSecret(workerApiSecret);

    const apiKey = await client.query(
      `
        INSERT INTO api_keys (
          id,
          key,
          "secretEnc",
          "secretEncIv",
          "secretEncTag",
          name,
          status,
          "createdAt",
          "updatedAt",
          "secretVersion"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE'::api_key_status, NOW(), NOW(), 1)
        RETURNING id, key
      `,
      [
        randomUUID(),
        workerApiKey,
        encrypted.enc,
        encrypted.iv,
        encrypted.tag,
        'Worker Dev API Key',
      ]
    );

    process.stdout.write(util.format('✅ Worker API Key 创建成功！') + '\n');
    process.stdout.write(util.format(`   Key: ${apiKey.rows[0].key}`) + '\n');
    process.stdout.write(util.format(`   Secret: ${WORKER_API_SECRET}`) + '\n');
    process.stdout.write(util.format('\n请将以下配置添加到 .env 文件：') + '\n');
    process.stdout.write(util.format(`WORKER_API_KEY=${workerApiKey}`) + '\n');
    process.stdout.write(util.format(`WORKER_API_SECRET=${workerApiSecret}`) + '\n');
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
