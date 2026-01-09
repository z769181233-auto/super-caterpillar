const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.episode.findMany({
    where: { seasonId: null },
    select: { projectId: true },
    distinct: ['projectId'],
  });

  let createdSeasons = 0;
  const updates = [];

  for (const proj of projects) {
    const projectId = proj.projectId;
    if (!projectId) continue;

    let season = await prisma.season.findFirst({
      where: { projectId },
      orderBy: { index: 'asc' },
    });

    if (!season) {
      season = await prisma.season.create({
        data: {
          projectId,
          index: 1,
          title: 'Default Season',
          description: 'Auto-created for missing seasonId',
          metadata: {},
        },
      });
      createdSeasons += 1;
    }

    const updated = await prisma.episode.updateMany({
      where: { projectId, seasonId: null },
      data: { seasonId: season.id },
    });
    updates.push({
      projectId,
      updated: updated.count,
      seasonId: season.id,
      createdSeason: !season ? true : false,
    });
  }

  console.log(
    JSON.stringify(
      {
        projectsProcessed: projects.length,
        createdSeasons,
        updates,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
