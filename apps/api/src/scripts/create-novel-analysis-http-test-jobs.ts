/* eslint-disable no-console */
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  PrismaClient,
  UserType,
  OrganizationRole,
  ProjectStatus,
  JobType,
  JobStatus,
} from 'database';
import * as util from 'util';

// 加载根目录 .env，确保数据库配置生效
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

async function ensureUserOrgProject() {
  const email = 'http-mock+test@local';
  const orgName = 'HTTP Mock Org';
  const projectName = 'HTTP Mock Project';

  // 用户
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'hashed-password', // 测试用途
        userType: UserType.individual,
        role: 'viewer',
        tier: 'Free',
        quota: {
          remainingTokens: 1000,
          computeSeconds: 3600,
          credits: 100,
        },
      },
    });
  }

  // 组织
  let organization = await prisma.organization.findFirst({ where: { name: orgName } });
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: orgName,
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: OrganizationRole.OWNER },
        },
      },
    });
  }

  // 项目
  let project = await prisma.project.findFirst({
    where: { name: projectName, organizationId: organization.id },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: projectName,
        ownerId: user.id,
        organizationId: organization.id,
        status: ProjectStatus.in_progress,
      },
    });
  }

  return { user, organization, project };
}

async function ensureHierarchy(projectId: string, organizationId: string) {
  // season
  let season = await prisma.season.findFirst({ where: { projectId, index: 1 } });
  if (!season) {
    season = await prisma.season.create({
      data: {
        projectId,
        index: 1,
        title: 'Season 1',
        description: 'Auto for http mock',
        metadata: {},
      },
    });
  }

  // episode
  let episode = await prisma.episode.findFirst({ where: { seasonId: season.id, index: 1 } });
  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        seasonId: season.id,
        index: 1,
        name: 'Episode 1',
        summary: 'Auto episode for http mock',
      },
    });
  }

  // scene
  let scene = await prisma.scene.findFirst({ where: { episodeId: episode.id, index: 1 } });
  if (!scene) {
    scene = await prisma.scene.create({
      data: {
        episodeId: episode.id,
        index: 1,
        title: 'Scene 1',
        summary: 'Auto scene for http mock',
      },
    });
  }

  // shot
  let shot = await prisma.shot.findFirst({ where: { sceneId: scene.id, index: 1 } });
  if (!shot) {
    shot = await prisma.shot.create({
      data: {
        sceneId: scene.id,
        index: 1,
        title: 'Shot 1',
        type: 'mock',
        organizationId,
      },
    });
  }

  return { season, episode, scene, shot };
}

async function main() {
  const { organization, project } = await ensureUserOrgProject();
  const { episode, scene, shot } = await ensureHierarchy(project.id, organization.id);

  const modes = ['SUCCESS', 'FAILED', 'RETRYABLE'] as const;

  for (const mode of modes) {
    const job = await prisma.shotJob.create({
      data: {
        organizationId: organization.id,
        projectId: project.id,
        episodeId: episode.id,
        sceneId: scene.id,
        shotId: shot.id,

        // 这里用枚举里真实存在的类型：NOVEL_ANALYSIS
        type: JobType.NOVEL_ANALYSIS,
        status: JobStatus.PENDING,
        priority: 0,
        maxRetry: 3,
        retryCount: 0,
        attempts: 0,

        // 用 payload 控制走 HTTP 引擎和测试模式
        payload: {
          // 开启 HTTP 引擎 feature flag（EngineRegistry.findAdapter 会识别）
          useHttpEngine: true,
          // 使用我们在 engines.json 里配置的 mock 引擎
          engineKey: 'http_mock_novel_analysis',

          // 用 mode 区分三种测试场景
          mode,
          novelSourceId: `novel-${mode.toLowerCase()}`,
          text: `This is a mock novel content for mode=${mode}`,
        },

        engineConfig: {},
      },
    });

    process.stdout.write(
      util.format(`[CreateHttpTestJob] Created job ${job.id} with mode=${mode}`) + '\n'
    );
  }
}

main()
  .catch((e) => {
    process.stderr.write(util.format(e) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (!process.exitCode) {
      process.exit(0);
    }
  });
