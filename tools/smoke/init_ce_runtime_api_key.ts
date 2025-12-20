import { PrismaClient } from 'database';

/**
 * 初始化 CE Runtime Verify 使用的 API Key
 *
 * 约定：
 * - KEY 与 SECRET 与 tools/smoke/run-ce-core-runtime-verify.sh 中保持一致
 * - dev/test 环境下，HmacAuthService 使用 secretHash 明文作为 secret
 */

const prisma = new PrismaClient();

const DEFAULT_API_KEY = 'ak_test_mj5h0knr';
const DEFAULT_API_SECRET =
  '3612e5bc385aaec44c3171156ee8a8be49aceb9ab1e6ce969ab7e0201674911c';

async function main() {
  const apiKey = process.env.API_KEY || DEFAULT_API_KEY;
  const apiSecret = process.env.API_SECRET || DEFAULT_API_SECRET;

  console.log('[init_ce_api_key] DATABASE_URL =', process.env.DATABASE_URL || '(from .env)');
  console.log('[init_ce_api_key] Upserting ApiKey:', apiKey);

  const record = await (prisma as any).apiKey.upsert({
    where: { key: apiKey },
    update: {
      secretHash: apiSecret, // dev/test: HmacAuthService 直接使用 secretHash 作为 secret
      status: 'ACTIVE',
      expiresAt: null,
      name: 'CE Runtime Verify Dev Key',
    },
    create: {
      key: apiKey,
      secretHash: apiSecret,
      status: 'ACTIVE',
      expiresAt: null,
      name: 'CE Runtime Verify Dev Key',
    },
  });

  console.log('[init_ce_api_key] Upserted ApiKey id/key:', record.id, record.key);
}

main()
  .catch((err) => {
    console.error('[init_ce_api_key] ERROR:', err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * 初始化 CE Runtime Verify 使用的 HMAC API Key
 *
 * 目标：
 * - 与 CE 脚本 (run-ce-core-runtime-verify.sh / ce-core-commercialization-smoke.ts) 使用的
 *   API_KEY / API_SECRET 保持一致
 * - 只在 dev/test 环境写入一条 ApiKey 记录，不修改签名算法和 Guard 逻辑
 */

import { PrismaClient } from 'database';
import { ApiKeyStatus } from 'database/src/generated/prisma';

const prisma = new PrismaClient();

// 与 tools/smoke/run-ce-core-runtime-verify.sh 中默认值保持一致
const CE_API_KEY = process.env.API_KEY || 'ak_test_mj5h0knr';
const CE_API_SECRET =
  process.env.API_SECRET ||
  '3612e5bc385aaec44c3171156ee8a8be49aceb9ab1e6ce969ab7e0201674911c';

async function main() {
  console.log('[init_ce_runtime_api_key] Using:');
  console.log('  API_KEY   =', CE_API_KEY);
  console.log('  API_SECRET (first 8) =', CE_API_SECRET.slice(0, 8), '...');

  // 在当前实现中，HmacAuthService 将 secretHash 视为明文 secret（仅 dev/test）
  // 参考：apps/api/src/auth/hmac/hmac-auth.service.ts 第 98~103 行
  const secretHash = CE_API_SECRET;

  const existing = await prisma.apiKey.findUnique({ where: { key: CE_API_KEY } });

  if (existing) {
    const updated = await prisma.apiKey.update({
      where: { key: CE_API_KEY },
      data: {
        secretHash,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        secretEnc: null,
        secretEncIv: null,
        secretEncTag: null,
        secretVersion: 1,
      },
    });
    console.log(
      '[init_ce_runtime_api_key] ✅ Updated existing ApiKey:',
      updated.id,
      updated.key,
    );
  } else {
    const created = await prisma.apiKey.create({
      data: {
        key: CE_API_KEY,
        name: 'CE Runtime Verify Dev Key',
        secretHash,
        status: ApiKeyStatus.ACTIVE,
        expiresAt: null,
        ownerUserId: null,
        ownerOrgId: null,
        secretEnc: null,
        secretEncIv: null,
        secretEncTag: null,
        secretVersion: 1,
      },
    });
    console.log(
      '[init_ce_runtime_api_key] ✅ Created ApiKey:',
      created.id,
      created.key,
    );
  }
}

main()
  .catch((err) => {
    console.error('[init_ce_runtime_api_key] ❌ Error:', err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


