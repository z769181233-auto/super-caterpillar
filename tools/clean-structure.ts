// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();
const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function main() {
  console.log(`Cleaning structure for project ${PROJECT_ID}...`);
  // Delete scenes first (FK)
  // Delete episodes
  // Delete seasons

  // To be safe and simple: delete seasons directly?
  // Delete dependent ShotJobs first
  await prisma.shotJob.deleteMany({ where: { projectId: PROJECT_ID } });

  // Delete Shots
  // Find episodes first to find scenes to find shots? No, project link on shots?
  // Schema: Shot has sceneId.
  // Let's rely on deleteMany if relations allow.
  // Actually, ShotJob has projectId, deleteMany ok.

  // To delete Seasons, we need to delete Episodes.
  // To delete Episodes, we need to delete Scenes.
  // To delete Scenes, we need to delete Shots.

  // Simplest: Delete Project? No, we want to keep Project and reset it.

  // Iterate deletion:
  const episodes = await prisma.episode.findMany({ where: { projectId: PROJECT_ID } });
  const episodeIds = episodes.map((e) => e.id);

  const scenes = await prisma.scene.findMany({ where: { episodeId: { in: episodeIds } } });
  const sceneIds = scenes.map((s) => s.id);

  await prisma.shot.deleteMany({ where: { sceneId: { in: sceneIds } } });
  await prisma.scene.deleteMany({ where: { id: { in: sceneIds } } });
  await prisma.episode.deleteMany({ where: { id: { in: episodeIds } } });

  const deletedSeasons = await prisma.season.deleteMany({
    where: { projectId: PROJECT_ID },
  });

  console.log(`Deleted ${deletedSeasons.count} seasons.`);

  // Also reset Job status to PENDING so mock-worker picks it up?
  // Or just mock-worker handles any 'DONE' job?
  // Mock worker currently finds 'PENDING' or 'RUNNING' jobs.
  // So we must reset job status too.

  const updatedJobs = await prisma.novelAnalysisJob.updateMany({
    where: { projectId: PROJECT_ID },
    data: { status: 'PENDING' },
  });
  console.log(`Reset ${updatedJobs.count} jobs to PENDING.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
