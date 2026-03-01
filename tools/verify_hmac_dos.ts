/**
 * 验证 HmacAuthService 内存 DoS 防护逻辑
 * 模拟 Redis 失败场景下，大量 unique nonce 对内存的影响
 */
import { HmacAuthService } from '../apps/api/src/auth/hmac/hmac-auth.service';
import { RedisService } from '../apps/api/src/redis/redis.service';
import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { AuditLogService } from '../apps/api/src/audit-log/audit-log.service';
import { Logger } from '@nestjs/common';

// Mock依赖
class MockRedisService {
  async set() {
    return false;
  } // 模拟 Redis 失败
}
class MockAuditLogService {}
class MockPrismaService {}

async function testMemoryProtection() {
  console.log('[Test] Starting Memory DoS Protection Test...');

  // 手动实例化 Service（绕过 Nest 依赖注入，便于单元测试）
  const service = new HmacAuthService(
    new MockPrismaService() as any,
    new MockRedisService() as any,
    new MockAuditLogService() as any
  );

  // 暴露私有属性 nonceCache 进行验证
  const getCacheSize = () => (service as any).nonceCache.size;

  console.log(`[Test] Initial cache size: ${getCacheSize()}`);

  const BATCH_SIZE = 12000;
  const MAX_LIMIT = 10000;

  console.log(`[Test] Injecting ${BATCH_SIZE} unique nonces...`);

  for (let i = 0; i < BATCH_SIZE; i++) {
    const nonce = `nonce_${i}`;
    const timestamp = Date.now();
    // 调用私有方法 saveNonce
    await (service as any).saveNonce(`hmac:nonce:${nonce}`, timestamp);

    if (i > 0 && i % 2000 === 0) {
      console.log(`[Test] Injected ${i} nonces. Current Cache Size: ${getCacheSize()}`);
    }
  }

  const finalSize = getCacheSize();
  console.log(`[Test] Final cache size: ${finalSize}`);

  if (finalSize <= MAX_LIMIT) {
    console.log(`[Test] SUCCESS: Cache size is within limit (${finalSize} <= ${MAX_LIMIT})`);
    process.exit(0);
  } else {
    console.error(`[Test] FAILED: Cache size exceeded limit (${finalSize} > ${MAX_LIMIT})`);
    process.exit(1);
  }
}

testMemoryProtection();
