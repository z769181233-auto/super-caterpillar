import { PrismaClient } from 'database';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const S2_USER_ID = 's2-test-user-' + Date.now();
  const S2_ORG_ID = 's2-test-org-' + Date.now();
  const S2_PROJ_ID = 's2-test-proj-' + Date.now();

  // 1. Create User
  await prisma.user.create({
    data: {
      id: S2_USER_ID,
      email: `s2-test-${Date.now()}@example.com`,
      passwordHash: 'mock',
    },
  });

  // 2. Create Organization
  await prisma.organization.create({
    data: {
      id: S2_ORG_ID,
      name: 'Stage 2 Test Org',
      slug: S2_ORG_ID,
      ownerId: S2_USER_ID,
    },
  });

  // 3. Create Project (and cascade hierarchy)
  // @ts-ignore
  const project: any = await prisma.project.create({
    data: {
      id: S2_PROJ_ID,
      organizationId: S2_ORG_ID,
      name: 'Stage 2 Test Project',
      ownerId: S2_USER_ID,
      seasons: {
        create: {
          index: 1,
          title: 'S2 Season',
          // projectId: S2_PROJ_ID, // REMOVED: Implicit
          episodes: {
            create: {
              index: 1,
              name: 'S2 Episode',
              projectId: S2_PROJ_ID, // Explicitly linking to Project for Episode (optional but good)
              scenes: {
                create: {
                  index: 1,
                  title: 'S2 Scene',
                  projectId: S2_PROJ_ID, // Explicit (Required by Scene)
                  shots: {
                    create: {
                      title: 'S2 Shot',
                      index: 1,
                      type: 'normal',
                      organizationId: S2_ORG_ID,
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as any,
    include: {
      seasons: {
        include: {
          episodes: {
            include: {
              scenes: {
                include: {
                  shots: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const shot = project.seasons[0].episodes[0].scenes[0].shots[0];

  // 4. Create Seed Job
  const job = await prisma.shotJob.create({
    data: {
      id: `job-s2-${Date.now()}`,
      organizationId: S2_ORG_ID,
      projectId: S2_PROJ_ID,
      episodeId: project.seasons[0].episodes[0].id,
      sceneId: project.seasons[0].episodes[0].scenes[0].id,
      shotId: shot.id,
      type: 'SHOT_RENDER' as any,
      status: 'PENDING' as any,
      priority: 100,
      payload: {
        mock: true,
        gate: 's2-orch-base',
      },
    },
  });

  console.log(`[Seed] Created Job: ${job.id}`);
  console.log(`[Seed] UserId: ${S2_USER_ID}`);
  console.log(`[Seed] OrgId: ${S2_ORG_ID}`);
  console.log(`[Seed] ProjId: ${S2_PROJ_ID}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
