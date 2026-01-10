/**
 * 端到端测试脚本：真实 Worker 联调版（小说导入 → 分析 → 结构生成）
 *
 * 使用方法：
 * pnpm --filter @super-caterpillar/api e2e:novel:worker
 *
 * 前置条件：
 * 1. API 服务已启动
 * 2. Worker 服务已启动（apps/workers）
 * 3. 数据库已连接
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ProjectService } from '../project/project.service';
import { TaskService } from '../task/task.service';
import { JobService } from '../job/job.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import {
  TaskType,
  JobStatus,
  Project,
  Episode,
  Scene,
  Shot,
  Prisma,
  MembershipRole,
} from 'database';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from "util";

type EpisodeWithScenesAndShots = Episode & {
  scenes: (Scene & { shots: Shot[] })[];
};

type ProjectWithTree = Project & {
  episodes: EpisodeWithScenesAndShots[];
};

const TEST_USER_EMAIL = 'e2e-test@example.com';
const TEST_USER_PASSWORD = 'test123456';
const TEST_PROJECT_NAME = 'E2E Novel Pipeline Test Project';
const TEST_NOVEL_FILE = path.join(__dirname, '../../fixtures/novels/sample.txt');

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createOrGetTestUser(
  prisma: PrismaService,
  authService: AuthService
): Promise<{ userId: string; organizationId: string }> {
  process.stdout.write(util.format('[E2E] 步骤 1: 创建或获取测试用户和组织...') + "\n");

  // 查找或创建用户
  let user = await prisma.user.findUnique({
    where: { email: TEST_USER_EMAIL },
  });

  if (!user) {
    process.stdout.write(util.format('[E2E] 创建新测试用户...') + "\n");
    await authService.register({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      userType: 'individual',
    });
    user = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
    });
  }

  if (!user) {
    throw new Error('Failed to create test user');
  }

  // 查找或创建组织
  let organization = await prisma.organization.findFirst({
    where: { ownerId: user.id },
  });

  if (!organization) {
    process.stdout.write(util.format('[E2E] 创建新测试组织...') + "\n");
    organization = await prisma.organization.create({
      data: {
        name: 'E2E Test Organization',
        ownerId: user.id,
      },
    });
  }

  // 确保用户有组织成员关系
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
  });

  if (!membership) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: MembershipRole.Owner,
      },
    });
  }

  process.stdout.write(util.format(`[E2E] ✅ 用户 ID: ${user.id}, 组织 ID: ${organization.id}`) + "\n");
  return { userId: user.id, organizationId: organization.id };
}

async function createOrGetTestProject(
  prisma: PrismaService,
  projectService: ProjectService,
  userId: string,
  organizationId: string
): Promise<string> {
  process.stdout.write(util.format('[E2E] 步骤 2: 创建或获取测试项目...') + "\n");

  // 查找现有项目
  let project = await prisma.project.findFirst({
    where: {
      ownerId: userId,
      organizationId,
      name: TEST_PROJECT_NAME,
    },
  });

  if (!project) {
    process.stdout.write(util.format('[E2E] 创建新测试项目...') + "\n");
    project = await projectService.create(
      {
        name: TEST_PROJECT_NAME,
        description: 'E2E 测试项目',
      },
      userId,
      organizationId
    );
  }

  process.stdout.write(util.format(`[E2E] ✅ 项目 ID: ${project.id}`) + "\n");
  return project.id;
}

async function importNovel(
  app: any,
  prisma: PrismaService,
  projectId: string,
  organizationId: string,
  userId: string
): Promise<{ novelSourceId: string; taskId: string; jobIds: string[] }> {
  process.stdout.write(util.format('[E2E] 步骤 3: 导入测试小说...') + "\n");

  // 读取测试小说文件
  const novelText = await fs.readFile(TEST_NOVEL_FILE, 'utf-8');

  // 创建 NovelSource
  const novelSource = await prisma.novelSource.create({
    data: {
      projectId,
      novelTitle: '测试小说',
      rawText: novelText,
      characterCount: novelText.length,
      fileType: 'txt',
    },
  });

  process.stdout.write(util.format(`[E2E] ✅ NovelSource ID: ${novelSource.id}`) + "\n");

  // 解析章节
  const chapterPattern =
    /第[一二三四五六七八九十\d]+章[：:]\s*(.+?)(?=第[一二三四五六七八九十\d]+章|$)/gs;
  const chapters: Array<{ title: string; content: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = chapterPattern.exec(novelText)) !== null) {
    chapters.push({
      title: match[1].trim(),
      content: match[0],
    });
  }

  if (chapters.length === 0) {
    // 如果没有找到章节，将整个文本作为一个章节
    chapters.push({
      title: '第一章',
      content: novelText,
    });
  }

  process.stdout.write(util.format(`[E2E] 解析到 ${chapters.length} 个章节`) + "\n");

  // 保存章节
  const savedChapters = [];
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const savedChapter = await prisma.novelChapter.create({
      data: {
        novelSourceId: novelSource.id,
        orderIndex: i + 1,
        title: chapter.title,
        rawText: chapter.content,
        characterCount: chapter.content.length,
      },
    });
    savedChapters.push(savedChapter);
  }

  // 创建 Season / Episode / Scene / Shot（用于挂载 Job）
  const season = await prisma.season.upsert({
    where: { projectId_index: { projectId, index: 1 } },
    update: {},
    create: {
      projectId,
      index: 1,
      title: 'Season 1',
      description: 'E2E season',
      metadata: {},
    },
  });

  const episode = await prisma.episode.create({
    data: {
      seasonId: season.id,
      projectId,
      index: 1,
      name: 'Episode 1',
      summary: 'E2E episode',
    },
  });

  const scene = await prisma.scene.create({
    data: {
      episodeId: episode.id,
      index: 1,
      title: 'Scene 1',
      summary: 'E2E scene',
    },
  });

  const shot = await prisma.shot.create({
    data: {
      sceneId: scene.id,
      index: 1,
      title: 'Shot 1',
      description: 'E2E shot',
      type: 'IMAGE',
      params: {},
      qualityScore: {},
    },
  });

  // 创建 Task
  const taskService = app.get(TaskService);
  const task = await taskService.create({
    type: TaskType.NOVEL_ANALYSIS,
    payload: {
      novelSourceId: novelSource.id,
      chapterIds: savedChapters.map((ch) => ch.id),
      shotId: shot.id,
    },
    maxRetry: 3,
    projectId,
    organizationId,
  });

  process.stdout.write(util.format(`[E2E] ✅ Task ID: ${task.id}`) + "\n");

  // 创建 Jobs
  const jobService = app.get(JobService);

  const jobIds = [];
  for (const chapter of savedChapters) {
    const job = await jobService.createNovelAnalysisJob(
      {
        type: 'NOVEL_ANALYZE_CHAPTER',
        payload: {
          chapterId: chapter.id,
          projectId,
          organizationId,
          userId,
          shotId: shot.id,
        },
      },
      userId,
      organizationId,
      task.id
    );
    jobIds.push(job.id);
  }

  process.stdout.write(util.format(`[E2E] ✅ 创建了 ${jobIds.length} 个 Job`) + "\n");
  return { novelSourceId: novelSource.id, taskId: task.id, jobIds };
}

async function triggerOrchestrator(app: any): Promise<void> {
  process.stdout.write(util.format('[E2E] 步骤 4: 触发 Orchestrator 调度...') + "\n");

  const orchestratorService = app.get(OrchestratorService);

  const result = await orchestratorService.dispatch();
  process.stdout.write(util.format(`[E2E] ✅ Orchestrator 调度完成: dispatched=${result.dispatched}, skipped=${result.skipped || 0}, errors=${result.errors || 0}`) + "\n");

  // 如果调度成功，等待一下让 Worker 有机会拉取
  if (result.dispatched > 0) {
    process.stdout.write(util.format(`[E2E] 等待 2 秒让 Worker 拉取 Job...`) + "\n");
    await sleep(2000);
  }
}

/**
 * 等待真实 Worker 处理 Job
 * 通过轮询数据库检查 Job 状态，直到全部完成或超时
 */
async function waitJobsHandledByRealWorker(
  prisma: PrismaService,
  jobIds: string[],
  timeoutMs = 60_000,
  pollIntervalMs = 3_000
): Promise<void> {
  const start = Date.now();

  process.stdout.write(util.format(`[E2E] 步骤 5: 等待真实 Worker 处理 Job...`) + "\n");
  process.stdout.write(util.format(`[E2E] 监控 Job 数量: ${jobIds.length}`) + "\n");
  process.stdout.write(util.format(`[E2E] 允许超时时间: ${timeoutMs / 1000} 秒`) + "\n");

  // 简单轮询：直到全部 SUCCEEDED / 有 FAILED / 超时
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const jobs = await prisma.shotJob.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, status: true, lastError: true },
    });

    const statusCount: Record<string, number> = {};
    for (const j of jobs) {
      statusCount[j.status] = (statusCount[j.status] ?? 0) + 1;
    }

    const pending = statusCount[JobStatus.PENDING] ?? 0;
    const running = statusCount[JobStatus.RUNNING] ?? 0;
    const succeeded = statusCount[JobStatus.SUCCEEDED] ?? 0;
    const failed = statusCount[JobStatus.FAILED] ?? 0;
    const retrying = statusCount[JobStatus.RETRYING] ?? 0;

    process.stdout.write(util.format(`[E2E] Job 状态: PENDING=${pending}, RUNNING=${running}, ` +
              `SUCCEEDED=${succeeded}, FAILED=${failed}, RETRYING=${retrying}`) + "\n");

    // 判定 1：全部成功
    if (succeeded === jobs.length && jobs.length > 0) {
      process.stdout.write(util.format('[E2E] ✅ 所有 Job 已由真实 Worker 处理完成') + "\n");
      return;
    }

    // 判定 2：有失败
    if (failed > 0) {
      const failedJobs = jobs.filter((j) => j.status === JobStatus.FAILED);
      process.stderr.write(util.format(`[E2E] ❌ 存在 ${failed} 个 FAILED Job:`) + "\n");
      failedJobs.forEach((job) => {
        process.stderr.write(util.format(`[E2E]   - Job ${job.id}: ${job.lastError || 'Unknown error'}`) + "\n");
      });
      throw new Error('[E2E] ❌ 存在 FAILED Job，真实 Worker 处理失败');
    }

    // 判定 3：超时
    if (Date.now() - start > timeoutMs) {
      throw new Error(`[E2E] ❌ 等待真实 Worker 处理 Job 超时 (${timeoutMs}ms)`);
    }

    await sleep(pollIntervalMs);
  }
}

async function verifyStructure(prisma: PrismaService, projectId: string): Promise<void> {
  process.stdout.write(util.format('[E2E] 步骤 6: 验证生成的结构...') + "\n");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      episodes: {
        include: {
          scenes: {
            include: { shots: true },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const tree = project as ProjectWithTree;

  process.stdout.write(util.format(`[E2E] 项目: ${tree.name}`) + "\n");
  process.stdout.write(util.format(`[E2E] Episode 数量: ${tree.episodes.length}`) + "\n");

  if (tree.episodes.length === 0) {
    throw new Error('❌ 没有生成任何 Episode');
  }

  // 检查第一个 Episode
  const firstEpisode = tree.episodes[0];
  process.stdout.write(util.format(`[E2E] 第一集: ${firstEpisode.name || '未命名'} (${firstEpisode.scenes.length} 个 Scene)`) + "\n");

  if (firstEpisode.scenes.length === 0) {
    throw new Error('❌ 第一集没有生成任何 Scene');
  }

  // 检查第一个 Scene
  const firstScene = firstEpisode.scenes[0];
  process.stdout.write(util.format(`[E2E] 第一个 Scene: ${firstScene.title || '未命名'} (${firstScene.shots.length} 个 Shot)`) + "\n");

  if (firstScene.shots.length === 0) {
    throw new Error('❌ 第一个 Scene 没有生成任何 Shot');
  }

  // 打印 Shot 信息
  firstScene.shots.slice(0, 5).forEach((shot, index) => {
    process.stdout.write(util.format(`[E2E]   Shot ${index + 1}: ${shot.title || '未命名'} (type: ${shot.type})`) + "\n");
  });
  if (firstScene.shots.length > 5) {
    process.stdout.write(util.format(`[E2E]   ... 还有 ${firstScene.shots.length - 5} 个 Shot`) + "\n");
  }

  // 汇总统计
  const totalScenes = tree.episodes.reduce((sum, ep) => sum + ep.scenes.length, 0);
  const totalShots = tree.episodes.reduce(
    (sum, ep) => sum + ep.scenes.reduce((s, sc) => s + sc.shots.length, 0),
    0
  );

  process.stdout.write(util.format(`[E2E] 汇总: ${tree.episodes.length} 个 Episode, ${totalScenes} 个 Scene, ${totalShots} 个 Shot`) + "\n");
  process.stdout.write(util.format('[E2E] ✅ 结构验证通过') + "\n");
}

async function main() {
  process.stdout.write(util.format('========================================') + "\n");
  process.stdout.write(util.format('E2E 测试：真实 Worker 联调版（小说 → 分析 → 结构生成）') + "\n");
  process.stdout.write(util.format('========================================\n') + "\n");

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'], // 减少日志输出
  });
  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);
  const projectService = app.get(ProjectService);

  try {
    // 步骤 1: 创建或获取测试用户和组织
    const { userId, organizationId } = await createOrGetTestUser(prisma, authService);

    // 步骤 2: 创建或获取测试项目
    const projectId = await createOrGetTestProject(prisma, projectService, userId, organizationId);

    // 步骤 3: 导入小说
    const { novelSourceId, taskId, jobIds } = await importNovel(
      app,
      prisma,
      projectId,
      organizationId,
      userId
    );

    process.stdout.write(util.format(`[E2E] 等待 3 秒让系统初始化...`) + "\n");
    await sleep(3000);

    // 步骤 4: 触发 Orchestrator 调度
    await triggerOrchestrator(app);

    // 步骤 5: 等待真实 Worker 处理 Job
    await waitJobsHandledByRealWorker(prisma, jobIds, 120000); // 2 分钟超时

    // 步骤 6: 验证结构
    await verifyStructure(prisma, projectId);

    process.stdout.write(util.format('\n========================================') + "\n");
    process.stdout.write(util.format('✅ E2E 测试通过（真实 Worker 联调版）！') + "\n");
    process.stdout.write(util.format('========================================') + "\n");
  } catch (error: any) {
    process.stderr.write(util.format('\n========================================') + "\n");
    process.stderr.write(util.format('❌ E2E 测试失败（真实 Worker 联调版）') + "\n");
    process.stderr.write(util.format('========================================') + "\n");
    process.stderr.write(util.format('错误:', error.message) + "\n");
    process.stderr.write(util.format(error.stack) + "\n");
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
