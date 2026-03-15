import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({});

async function exportCSV() {
  console.log('--- Script CSV Export Tool (INDUSTRIAL SEALED) ---');

  // 1. Get the latest successful ScriptBuild with Source metadata
  const build = await prisma.scriptBuild.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      storySource: true,
      episodes: {
        orderBy: { index: 'asc' },
        include: {
          scenes: {
            orderBy: { sceneIndex: 'asc' },
            include: {
              sourceRef: true,
              shots: {
                orderBy: { index: 'asc' },
                include: { sourceRef: true },
              },
            },
          },
          sourceRef: true,
        },
      },
    },
  });

  if (!build) {
    console.error('No ScriptBuild found.');
    return;
  }

  console.log(`Exporting Build: ${build.id} (Status: ${build.status})`);
  console.log(`Source Hash: ${build.storySource.globalHash}`);

  // 2. Define Headers with Industrial Fingerprints
  const headers = [
    'EpisodeIndex',
    'SceneIndex',
    'ShotIndex',
    'Content',
    'Location',
    'SourceHash',
    'SourceOffset',
    'BuildID',
    'AuditStatus',
    'GlobalHash',
  ];

  const rows: string[][] = [headers];

  for (const ep of build.episodes) {
    for (const sc of ep.scenes) {
      if (sc.shots.length > 0) {
        for (const shot of sc.shots) {
          rows.push([
            ep.index.toString(),
            sc.sceneIndex.toString(),
            shot.index.toString(),
            shot.content.replace(/\n/g, ' '),
            sc.locationSlug || '',
            shot.sourceRef?.textHash || '',
            (shot.sourceRef?.offsetStart || 0).toString(),
            build.id,
            build.status,
            build.storySource.globalHash,
          ]);
        }
      } else {
        // Fallback for scenes without shots
        rows.push([
          ep.index.toString(),
          sc.sceneIndex.toString(),
          'N/A',
          sc.summary?.replace(/\n/g, ' ') || '',
          sc.locationSlug || '',
          sc.sourceRef?.textHash || '',
          (sc.sourceRef?.offsetStart || 0).toString(),
          build.id,
          build.status,
          build.storySource.globalHash,
        ]);
      }
    }
  }

  const csvContent = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');

  const exportPath = path.join(
    process.cwd(),
    'storage/exports',
    `industrial_script_${build.id.substring(0, 8)}.csv`
  );
  fs.writeFileSync(exportPath, csvContent);

  console.log(`\n✅ Industrial Export successful: ${exportPath}`);
  console.log(`Total Rows: ${rows.length - 1}`);
  console.log(`Industrial Fingerprint Checksum: ${build.storySource.globalHash.substring(0, 16)}`);
}

exportCSV()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
