import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function main() {
  const sceneIdArg = process.argv.find((arg) => arg.startsWith('--sceneId='))?.split('=')[1];

  const scene = await prisma.scene.findFirst({
    where: sceneIdArg ? { id: sceneIdArg } : { filmIrId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    include: {
      shots: {
        orderBy: { index: 'asc' },
        include: {
          shotPlanning: true,
          assets: true,
        },
      },
      filmIr: true,
      episode: true,
    },
  });

  if (!scene) {
    throw new Error(sceneIdArg ? `Scene ${sceneIdArg} not found` : 'No scene with Film IR found');
  }

  const continuitySnapshots = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM continuity_state_snapshots
      WHERE scene_id = $1
    `,
    scene.id,
  ).catch(() => [{ count: BigInt(0) }]);

  const gateResults = await prisma.contentGateResult.findMany({
    where: {
      sceneId: scene.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  const publishedVideos = await prisma.publishedVideo.findMany({
    where: {
      episodeId: scene.episodeId,
    },
    orderBy: { createdAt: 'desc' },
  });

  const summary = {
    sceneId: scene.id,
    episodeId: scene.episodeId,
    projectId: scene.projectId,
    filmIrId: scene.filmIrId,
    filmIrStatus: scene.filmIr?.status ?? null,
    shotCount: scene.shots.length,
    shotPlanningCount: scene.shots.filter((shot) => !!shot.shotPlanning).length,
    shotsWithFilmIrCount: scene.shots.filter((shot) => !!shot.filmIrId).length,
    shotsWithDirectorFieldsCount: scene.shots.filter(
      (shot) => !!shot.dramaticFunction || !!shot.emotionalTarget,
    ).length,
    continuitySnapshotCount: Number(continuitySnapshots[0]?.count ?? BigInt(0)),
    contentGateResultCount: gateResults.length,
    latestGateVerdict: gateResults[0]?.gateVerdict ?? null,
    publishedVideoCount: publishedVideos.length,
    latestPublishedDirectorLayer:
      (publishedVideos[0]?.metadata as any)?.directorLayer ?? null,
  };

  const checks = {
    hasFilmIr: !!summary.filmIrId,
    hasApprovedOrLockedFilmIr:
      summary.filmIrStatus === 'APPROVED' || summary.filmIrStatus === 'LOCKED',
    hasShots: summary.shotCount > 0,
    hasShotPlanning: summary.shotPlanningCount > 0,
    hasShotFilmIrProjection: summary.shotsWithFilmIrCount > 0,
    hasDirectorFieldsOnShots: summary.shotsWithDirectorFieldsCount > 0,
    hasContinuitySnapshots: summary.continuitySnapshotCount > 0,
    hasContentGateResults: summary.contentGateResultCount > 0,
    hasPublishDirectorEvidence:
      !!summary.latestPublishedDirectorLayer || summary.publishedVideoCount === 0,
  };

  const passed =
    checks.hasFilmIr &&
    checks.hasShots &&
    checks.hasShotPlanning &&
    checks.hasShotFilmIrProjection &&
    checks.hasDirectorFieldsOnShots &&
    checks.hasContinuitySnapshots &&
    checks.hasContentGateResults &&
    checks.hasPublishDirectorEvidence;

  const result = {
    verdict: passed ? 'PASS' : 'FAIL',
    checks,
    summary,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!passed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
