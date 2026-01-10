import { PrismaClient, JobStatus, JobType, ProjectStatus, UserType } from 'database';
import * as util from "util";

/**
 * 开发用脚本：创建一个最小的 NOVEL_ANALYSIS Job，供 Worker 拉取处理
 * 用法：
 *   pnpm --filter ./apps/api dev:create-test-novel-job
 */
async function main() {
  const prisma = new PrismaClient();

  // 1) 确保有用户
  const email = 'dev+worker@test.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'dev-password-hash',
        userType: UserType.individual,
        role: UserRole.viewer,
        tier: UserTier.Free,
        quota: { credits: 100, remainingTokens: 1000, computeSeconds: 3600 },
      },
    });
  }

  // 2) 确保有组织
  const orgName = 'Dev Org';
  let org = await prisma.organization.findFirst({ where: { name: orgName } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgName,
        ownerId: user.id,
        quota: { credits: 1000, computeSeconds: 36000 },
      },
    });
  }

  // 3) 确保成员关系
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!membership) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: MembershipRole.Owner,
      },
    });
  }

  // 4) 确保项目
  const projectName = 'Dev Project - Novel Analysis';
  let project = await prisma.project.findFirst({
    where: { name: projectName, organizationId: org.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: projectName,
        description: 'Dev project for NOVEL_ANALYSIS job',
        ownerId: user.id,
        organizationId: org.id,
        status: ProjectStatus.in_progress,
      },
    });
  }

  // 5) Season / Episode / Scene / Shot（若不存在则创建最小结构）
  let season = await prisma.season.findFirst({
    where: { projectId: project.id },
    orderBy: { index: 'asc' },
  });
  if (!season) {
    season = await prisma.season.create({
      data: {
        projectId: project.id,
        index: 1,
        title: 'Season 1',
        description: 'Auto generated for dev novel analysis',
        metadata: {},
      },
    });
  }

  let episode = await prisma.episode.findFirst({
    where: { seasonId: season.id },
    orderBy: { index: 'asc' },
  });
  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        seasonId: season.id,
        projectId: project.id,
        index: 1,
        name: 'Episode 1',
        summary: 'Auto generated for dev novel analysis',
      },
    });
  }

  let scene = await prisma.scene.findFirst({
    where: { episodeId: episode.id },
    orderBy: { index: 'asc' },
  });
  if (!scene) {
    scene = await prisma.scene.create({
      data: {
        episodeId: episode.id,
        index: 1,
        title: 'Scene 1',
        summary: 'Auto generated for dev novel analysis',
      },
    });
  }

  let shot = await prisma.shot.findFirst({
    where: { sceneId: scene.id },
    orderBy: { index: 'asc' },
  });
  if (!shot) {
    shot = await prisma.shot.create({
      data: {
        sceneId: scene.id,
        index: 1,
        title: 'Shot 1',
        description: 'Auto generated for dev novel analysis',
        type: 'novel_analysis',
        params: {},
        qualityScore: {},
        organizationId: org.id,
      },
    });
  }

  // 6) 创建 PENDING Job（NOVEL_ANALYSIS）
  const job = await prisma.shotJob.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      episodeId: episode.id,
      sceneId: scene.id,
      shotId: shot.id,
      taskId: null,
      type: JobType.NOVEL_ANALYSIS,
      status: JobStatus.PENDING,
      priority: 0,
      maxRetry: 3,
      retryCount: 0,
      attempts: 0,
      payload: {
        type: 'NOVEL_ANALYSIS',
        summary: 'MOCK_NOVEL_ANALYSIS_REQUEST',
        chapterId: null,
      },
      engineConfig: {},
    },
  });

  process.stdout.write(util.format('Created job:', job.id, job.type, job.status) + "\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(util.format(e) + "\n");
  process.exit(1);
});
