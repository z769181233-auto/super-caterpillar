import { PrismaClient } from 'database';
import { LocalStorageAdapter } from '@scu/storage';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // 1. Setup Storage
  const repoRoot = path.resolve(__dirname, '../../');
  const storageRoot = process.env.STORAGE_ROOT || path.join(repoRoot, '.data/storage');
  const storage = new LocalStorageAdapter(storageRoot);

  console.log(`[Seed] Storage Root: ${storageRoot}`);

  // 2. Generate Frames via FFmpeg
  const seedId = `seed-${Date.now()}`;
  const frameKeys: string[] = [];
  const colors = ['red', 'green', 'blue'];

  for (let i = 0; i < 3; i++) {
    const color = colors[i];
    const key = `temp/seed/${seedId}/${i}.png`;
    const absPath = storage.getAbsolutePath(key);

    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    // Generate 640x360 image
    const proc = spawnSync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=640x360`,
      '-frames:v',
      '1',
      '-y',
      absPath,
    ]);

    if (proc.status !== 0) {
      throw new Error(`FFmpeg failed: ${proc.stderr.toString()}`);
    }

    frameKeys.push(key);
  }
  console.log(`[Seed] Generated ${frameKeys.length} frames.`);

  // 3. Inject DB Data
  // Use Smoke User (created by init_api_key.ts)
  let user = await prisma.user.findFirst({ where: { email: 'smoke@local' } });
  if (!user) {
    // Fallback if not initialized (though it should be)
    user = await prisma.user.create({
      data: {
        id: `user-${seedId}`,
        email: 'smoke@local',
        passwordHash: 'smoke-dev-password',
      },
    });
  }

  // Ensure Organization exists (created by init_api_key.ts)
  let org = await prisma.organization.findFirst({ where: { slug: 'smoke-org' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: 'smoke-org',
        name: 'Smoke Org',
        slug: 'smoke-org',
        ownerId: user.id,
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      name: `E2E Video Project ${seedId}`,
      ownerId: user.id,
      organizationId: org.id,
      status: 'in_progress',
    },
  });

  const season = await prisma.season.create({
    data: { projectId: project.id, index: 1, title: 'S1' },
  });

  const episode = await prisma.episode.create({
    data: { seasonId: season.id, index: 1, name: 'E1' },
  });

  const scene = await prisma.scene.create({
    data: { episodeId: episode.id, index: 1, title: 'Sc1', summary: 'E2E Test Scene Summary', projectId: project.id },
  });

  const shot = await prisma.shot.create({
    data: {
      sceneId: scene.id,
      index: 1,
      type: 'VIDEO',
      organizationId: org.id,
    },
  });

  // 4. Ensure Engine Exists (VIDEO_RENDER)
  // Code: default_video_render (must match EngineRegistry)
  await prisma.engine.upsert({
    where: { code: 'default_video_render' },
    update: { isActive: true },
    create: {
      code: 'default_video_render',
      engineKey: 'default_video_render',
      name: 'Video Render Engine',
      adapterName: 'default_video_render',
      adapterType: 'local',
      type: 'local',
      config: {},
      isActive: true,
      enabled: true,
    },
  });

  console.log(
    JSON.stringify({
      shotId: shot.id,
      frameKeys,
      projectId: project.id,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
