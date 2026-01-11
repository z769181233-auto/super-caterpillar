/**
 * 初始化 Worker API Key 脚本
 * 用于在开发环境中创建固定的 Worker API Key
 *
 * 使用方法：
 * pnpm --filter api init:worker-api-key
 * 或在 apps/api 目录下：pnpm init:worker-api-key
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ApiKeyService } from '../auth/hmac/api-key.service';
import { PrismaService } from '../prisma/prisma.service';
import * as util from 'util';

const WORKER_API_KEY = process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000';
const WORKER_API_SECRET =
  process.env.WORKER_API_SECRET ||
  'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

async function main() {
  process.stdout.write(util.format('========================================') + '\n');
  process.stdout.write(util.format('初始化 Worker API Key') + '\n');
  process.stdout.write(util.format('========================================\n') + '\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const apiKeyService = app.get(ApiKeyService);

  try {
    // 检查是否已存在
    const existing = await apiKeyService.findByKey(WORKER_API_KEY);
    if (existing) {
      process.stdout.write(util.format(`✅ API Key 已存在: ${WORKER_API_KEY}`) + '\n');
      process.stdout.write(util.format('   如需重新创建，请先删除数据库中的记录。\n') + '\n');
      await app.close();
      return;
    }

    // 创建新的 API Key
    // 注意：这里我们手动创建，使用固定的 key 和 secret
    const apiKey = await (prisma as any).apiKey.create({
      data: {
        key: WORKER_API_KEY,
        secretHash: WORKER_API_SECRET, // 开发环境：直接存储明文
        name: 'Worker Dev API Key',
        status: 'ACTIVE',
        // ownerUserId 和 ownerOrgId 可以为空（开发环境）
      },
    });

    process.stdout.write(util.format('✅ Worker API Key 创建成功！') + '\n');
    process.stdout.write(util.format(`   Key: ${apiKey.key}`) + '\n');
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
    await app.close();
  }
}

main();
