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

const prisma = new PrismaClient();

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

  // 3) ensure project
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

  // 4) ensure season/episode/scene/shot
  let season = await prisma.season.findFirst({ where: { projectId: project.id, index: 1 } });
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

  let episode = await prisma.episode.findFirst({ where: { seasonId: season.id, index: 1 } });
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

  let scene = await prisma.scene.findFirst({ where: { episodeId: episode.id, index: 1 } });
  if (!scene) {
    scene = await prisma.scene.create({
      data: {
        episodeId: episode.id,
        index: 1,
        title: 'Scene 1',
        summary: 'Auto scene for test job',
      },
    });
  }

  let shot = await prisma.shot.findFirst({ where: { sceneId: scene.id, index: 1 } });
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

  // 5) ensure NovelSource and NovelChapter
  let novelSource = await prisma.novelSource.findFirst({ where: { projectId: project.id } });
  if (!novelSource) {
    novelSource = await prisma.novelSource.create({
      data: {
        projectId: project.id,
        novelTitle: 'Test Novel',
        rawText: 'Test novel content for job testing',
      },
    });
  }

  let novelChapter = await prisma.novelChapter.findFirst({
    where: { novelSourceId: novelSource.id, orderIndex: 1 },
  });
  if (!novelChapter) {
    novelChapter = await prisma.novelChapter.create({
      data: {
        novelSourceId: novelSource.id,
        orderIndex: 1,
        title: 'Chapter 1',
        rawText: 'Test chapter content',
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
