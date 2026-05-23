import {
  PrismaClient,
  UserType,
  OrganizationRole,
  ProjectStatus,
  JobType,
  JobStatus,
} from 'database';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as util from 'util';

// Load env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient({});

async function main() {
  const email = 'worker+test@local';
  const orgName = 'Worker Test Org';
  const projectName = 'Worker Test Project';

  // 1) ensure user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'hashed-password', // placeholder
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

  // 2) ensure organization
  const organizations = await prisma.organization.findMany({
    where: { name: orgName },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  });
  let organization = organizations[0] ?? null;
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

  // 3) ensure project
  const projects = await prisma.project.findMany({
    where: { name: projectName, organizationId: organization.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  });
  let project = projects[0] ?? null;
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

  // 4) ensure season/episode/scene/shot
  let season = await prisma.season.findUnique({
    where: { projectId_index: { projectId: project.id, index: 1 } },
  });
  if (!season) {
    season = await prisma.season.create({
      data: {
        projectId: project.id,
        index: 1,
        title: 'Season 1',
        description: 'Auto for test job',
        metadata: {},
      },
    });
  }

  const episodes = await prisma.episode.findMany({
    where: { seasonId: season.id, index: 1 },
    orderBy: [{ id: 'desc' }],
    take: 1,
  });
  let episode = episodes[0] ?? null;
  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        seasonId: season.id,
        index: 1,
        name: 'Episode 1',
        summary: 'Auto episode for test job',
      },
    });
  }

  const scenes = await prisma.scene.findMany({
    where: { episodeId: episode.id, sceneIndex: 1 },
    orderBy: [{ id: 'desc' }],
    take: 1,
  });
  let scene = scenes[0] ?? null;
  if (!scene) {
    scene = await prisma.scene.create({
      data: {
        episodeId: episode.id,
        projectId: project.id,
        sceneIndex: 1,
        title: 'Scene 1',
        summary: 'Auto scene for test job',
      },
    });
  }

  const shots = await prisma.shot.findMany({
    where: { sceneId: scene.id, index: 1 },
    orderBy: [{ id: 'desc' }],
    take: 1,
  });
  let shot = shots[0] ?? null;
  if (!shot) {
    shot = await prisma.shot.create({
      data: {
        sceneId: scene.id,
        index: 1,
        title: 'Shot 1',
        type: 'mock',
        organizationId: organization.id,
      },
    });
  }

  // 5) ensure Novel and NovelChapter
  let novelSource = await prisma.novel.findUnique({ where: { projectId: project.id } as any });
  if (!novelSource) {
    novelSource = await prisma.novel.create({
      data: {
        projectId: project.id,
        title: 'Test Novel',
        author: 'Worker Test',
        organizationId: organization.id,
        status: 'UPLOADING',
        fileType: 'txt',
        characterCount: 'Test novel content for job testing'.length,
        metadata: {
          source: 'create-test-novel-job',
        },
      },
    });
  }

  const novelChapters = await prisma.novelChapter.findMany({
    where: { novelSourceId: novelSource.id, index: 1 },
    orderBy: [{ id: 'desc' }],
    take: 1,
  });
  let novelChapter = novelChapters[0] ?? null;
  if (!novelChapter) {
    let volume = await prisma.novelVolume.findFirst({
      where: { projectId: project.id, novelSourceId: novelSource.id, index: 1 },
      orderBy: { id: 'desc' },
    });
    if (!volume) {
      volume = await prisma.novelVolume.create({
        data: {
          projectId: project.id,
          novelSourceId: novelSource.id,
          index: 1,
          title: 'Volume 1',
        },
      });
    }
    novelChapter = await prisma.novelChapter.create({
      data: {
        novelSourceId: novelSource.id,
        volumeId: volume.id,
        index: 1,
        title: 'Chapter 1',
        rawContent: '第1章：测试章节\n这是用于验证 worker NOVEL_ANALYSIS 链路的测试正文。',
      },
    });
  }

  // 6) create job PENDING
  const job = await prisma.shotJob.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      episodeId: episode.id,
      sceneId: scene.id,
      shotId: shot.id,
      type: JobType.NOVEL_ANALYSIS,
      status: JobStatus.PENDING,
      priority: 0,
      maxRetry: 3,
      retryCount: 0,
      attempts: 0,
      payload: {
        type: 'NOVEL_ANALYSIS_REQUEST',
        projectId: project.id,
        chapterId: novelChapter.id,
        shotId: shot.id,
        info: 'created by create-test-novel-job',
      },
      engineConfig: {},
    },
  });

  process.stdout.write(
    util.format('[create-test-novel-job] created job:', {
      id: job.id,
      status: job.status,
      type: job.type,
      projectId: job.projectId,
      shotId: job.shotId,
    }) + '\n'
  );
}

main()
  .catch((e) => {
    process.stderr.write(util.format(e) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // ✅ 成功路径显式退出
    if (!process.exitCode) {
      process.exit(0);
    }
  });
