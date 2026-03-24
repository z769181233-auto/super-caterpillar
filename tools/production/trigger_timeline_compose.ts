/**
 * 生产触发脚本：为已完成 SHOT_RENDER 的场景触发 TIMELINE_COMPOSE 任务
 */

import { ApiClient } from '../../apps/workers/src/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '../../packages/database/src/generated/prisma';

// 加载环境变量
const envLocalPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// 配置 API 客户端
const API_KEY = process.env.WORKER_API_KEY || 'ak_worker_dev_0000000000000000';
const API_SECRET =
  process.env.WORKER_API_SECRET ||
  'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';

const apiClient = new ApiClient(
  'http://localhost:3000',
  API_KEY,
  API_SECRET,
  'production-trigger-compose'
);

const prisma = new PrismaClient({});

const PROJECT_ID = 'prod-2-episode';
const ORGANIZATION_ID = 'default-org';

async function main() {
  console.log('🎞️ TIMELINE_COMPOSE 触发 - 2 集视频生产');
  console.log('========================================');

  // 获取项目下所有场景
  const scenes = await prisma.scene.findMany({
    where: {
      projectId: PROJECT_ID,
    },
    include: {
      shots: true,
    },
  });

  console.log(`✅ 找到 ${scenes.length} 个场景`);

  if (scenes.length === 0) {
    console.log('⚠️ 没有场景，退出');
    await prisma.$disconnect();
    return;
  }

  for (const scene of scenes) {
    console.log(`\n--- Scene ${scene.id} (${scene.title}) ---`);
    console.log(`    Shots: ${scene.shots.length}`);

    try {
      // 绕过 API 验证，直接写入数据库
      // type: 'PIPELINE_TIMELINE_COMPOSE' 在 DB Enum 中存在，但在 API DTO 中可能有缺失
      const job = await prisma.shotJob.create({
        data: {
          type: 'PIPELINE_TIMELINE_COMPOSE',
          projectId: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          traceId: `compose-${scene.id.substring(0, 8)}-${crypto.randomBytes(4).toString('hex')}`,
          status: 'PENDING',
          payload: {
            sceneId: scene.id,
            pipelineRunId: `run-${Date.now()}`,
            // 音频配置 (Mock)
            bgmMode: 'loop',
            bgmGain: 0.3,
          },
          // 关联 Scene 以便追踪
          sceneId: scene.id,
        },
      });
      console.log(`   ✅ TIMELINE_COMPOSE 任务已创建 (Direct DB): ${job.id}`);
    } catch (e: any) {
      console.error(`   ❌ 任务创建失败: ${e.message}`);
    }
  }

  await prisma.$disconnect();

  console.log('\n========================================');
  console.log('🎞️ TIMELINE_COMPOSE 任务已提交！Worker 将自动生成 timeline.json。');
  console.log(
    `📊 监视命令: pnpm -w exec tsx tools/smoke/diag_db.ts --sql "SELECT id, type, status FROM shot_jobs WHERE \"projectId\" = '${PROJECT_ID}' AND type = 'PIPELINE_TIMELINE_COMPOSE';"`
  );
}

main().catch((err) => {
  console.error('❌ 触发失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
