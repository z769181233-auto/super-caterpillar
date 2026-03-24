import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({});

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Project ID required');
    process.exit(1);
  }

  console.log(`Seeding data for project ${projectId}...`);

  // 1. Create Hierarchy
  const season = await prisma.season.create({
    data: {
      projectId,
      index: 1,
      title: 'Season 1',
      description: 'E2E Test Season',
    },
  });

  const episode = await prisma.episode.create({
    data: {
      seasonId: season.id,
      projectId,
      index: 1,
      name: 'Episode 1',
    },
  });

  const scene = await prisma.scene.create({
    data: {
      episodeId: episode.id,
      index: 1,
      title: 'Scene 1',
      summary: 'A test scene for video render',
    },
  });

  // 2. Create Shot & Asset
  // We need REAL dummy images.
  // I'll assume we have some accessible images or I create them.
  // E2E script runs in root.
  // I'll copy a dummy image to public-storage?
  // No, `processor` reads from `storageKey`.
  // If `storageKey` is a path, it works.
  // If `storageKey` is a URL, implementation might vary.
  // In `video-render.processor.ts`, I treat `storageKey` as `assetPath`.
  // So I'll point to a file that exists.

  const dummyImage = path.resolve(process.cwd(), 'tools/smoke/assets/test_frame.png');
  // Ensure directory exists
  if (!fs.existsSync(path.dirname(dummyImage))) {
    fs.mkdirSync(path.dirname(dummyImage), { recursive: true });
  }
  // Create a dummy image file (just text is fine for ffmpeg if using concat helper? No, ffmpeg needs valid image)
  // I'll try to find a real image or assume system has one?
  // No, I'll rely on `video-render.processor.ts` robust handling of `mock://` I added!
  // It generates a red frame for `mock://` paths.
  // So I can use `mock://frame1.png`.

  const shot1 = await prisma.shot.create({
    data: {
      sceneId: scene.id,
      index: 1,
      type: 'default',
      title: 'Shot 1',
    },
  });

  await prisma.asset.create({
    data: {
      projectId,
      ownerType: 'SHOT',
      ownerId: shot1.id,
      type: 'IMAGE',
      storageKey: 'mock://frame1.png',
      status: 'GENERATED',
    },
  });

  const shot2 = await prisma.shot.create({
    data: {
      sceneId: scene.id,
      index: 2,
      type: 'default',
      title: 'Shot 2',
    },
  });

  await prisma.asset.create({
    data: {
      projectId,
      ownerType: 'SHOT',
      ownerId: shot2.id,
      type: 'IMAGE',
      storageKey: 'mock://frame2.png', // Processor will gen dummy_frame2.png (Red)
      status: 'GENERATED',
    },
  });

  console.log('Seeding complete.');

  // Output Scene ID
  fs.writeFileSync('video_e2e_scene_id.txt', scene.id);
  console.log(`Scene ID ${scene.id} written to video_e2e_scene_id.txt`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
