/**
 * 生产触发脚本：为已创建的场景触发 SHOT_RENDER 任务
 * 使用 CE06 解析阶段创建的 shots 记录
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
  'production-trigger-render'
);

const prisma = new PrismaClient();

const PROJECT_ID = 'prod-2-episode';
const ORGANIZATION_ID = 'default-org';

async function main() {
  console.log('🎨 SHOT_RENDER 渲染触发 - 2 集视频生产');
  console.log('========================================');

  // 获取项目下所有待渲染的 shots
  const shots = await prisma.shot.findMany({
    where: {
      scene: {
        projectId: PROJECT_ID,
      },
      renderStatus: 'PENDING',
    },
    include: {
      scene: true,
    },
  });

  console.log(`✅ 找到 ${shots.length} 个待渲染 shots`);

  if (shots.length === 0) {
    console.log('⚠️ 没有待渲染的 shots，退出');
    await prisma.$disconnect();
    return;
  }

  // 为每个 shot 生成渲染提示词并创建任务
  for (const shot of shots) {
    console.log(`\n--- Shot ${shot.id} (Scene: ${shot.scene.title}) ---`);

    // 生成模拟提示词 (正式生产应该来自 CE03/CE04 增强)
    const mockPrompt = `高质量动漫风格插图，场景：${shot.scene.title}，镜头${shot.index}，细腻柔和的光影效果，电影级构图，4K分辨率`;

    try {
      // 先更新 shot 的 enrichedPrompt
      await prisma.shot.update({
        where: { id: shot.id },
        data: { enrichedPrompt: mockPrompt },
      });
      console.log(`   ✏️ 已更新 enrichedPrompt`);

      // 创建 SHOT_RENDER 任务
      const job = await apiClient.createJob({
        jobType: 'SHOT_RENDER',
        projectId: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        traceId: `render-${shot.id.substring(0, 8)}-${crypto.randomBytes(4).toString('hex')}`,
        payload: {
          shotId: shot.id,
          sceneId: shot.sceneId,
          prompt: mockPrompt,
          productionMode: true,
        },
      });
      console.log(`   ✅ SHOT_RENDER 任务已创建: ${job.id}`);
    } catch (e: any) {
      console.error(`   ❌ 任务创建失败: ${e.message}`);
    }
  }

  await prisma.$disconnect();

  console.log('\n========================================');
  console.log('🎨 SHOT_RENDER 任务已提交！Worker 将自动处理渲染。');
  console.log(
    `📊 监视命令: pnpm -w exec tsx tools/smoke/diag_db.ts --sql "SELECT id, type, status FROM shot_jobs WHERE \"projectId\" = '${PROJECT_ID}' AND type = 'SHOT_RENDER';"`
  );
}

main().catch((err) => {
  console.error('❌ 渲染触发失败:', err);
  prisma.$disconnect();
  process.exit(1);
});
