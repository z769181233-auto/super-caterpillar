import { PrismaClient } from 'database';

const prisma = new PrismaClient({});

async function main() {
  console.log('Seeding VIDEO_RENDER engine...');

  const engine = await prisma.engine.upsert({
    where: { engineKey: 'video_merge' },
    update: {
      enabled: true,
      isActive: true,
      type: 'VIDEO_RENDER',
      adapterName: 'local_ffmpeg',
      adapterType: 'local',
      code: 'video_merge',
      name: 'Local FFmpeg Video Render',
    },
    create: {
      engineKey: 'video_merge',
      type: 'VIDEO_RENDER',
      adapterName: 'local_ffmpeg',
      adapterType: 'local',
      code: 'video_merge',
      name: 'Local FFmpeg Video Render',
      enabled: true,
      isActive: true,
      config: {},
      mode: 'local',
    },
  });

  console.log('✅ VIDEO_RENDER engine seeded.');

  console.log('Seeding CE01 engine...');
  await prisma.engine.upsert({
    where: { engineKey: 'character_visual' },
    update: {
      enabled: true,
      isActive: true,
      type: 'CE01_REFERENCE_SHEET',
      code: 'character_visual',
    },
    create: {
      engineKey: 'character_visual',
      type: 'CE01_REFERENCE_SHEET',
      adapterName: 'local',
      adapterType: 'local',
      code: 'character_visual',
      name: 'Character Visual Engine',
      enabled: true,
      isActive: true,
      config: {},
      mode: 'local',
    },
  });
  console.log('✅ CE01 engine seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
