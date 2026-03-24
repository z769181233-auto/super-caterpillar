const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});

async function main() {
  const engineKey = 'default_novel_analysis';
  console.log(`Seeding engine config for ${engineKey}...`);

  // 1. Upsert Engine
  const engine = await prisma.engine.upsert({
    where: { engineKey },
    create: {
      engineKey,
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      config: {},
      enabled: true,
      defaultVersion: '1.0.0',
    },
    update: {
      adapterName: 'default_novel_analysis',
      adapterType: 'local',
      enabled: true,
    },
  });

  console.log(`Engine ensured: ${engine.id}`);

  // 2. Ensure Version exists (optional but good practice)
  await prisma.engineVersion.upsert({
    where: {
      engineId_versionName: {
        engineId: engine.id,
        versionName: '1.0.0',
      },
    },
    create: {
      engineId: engine.id,
      versionName: '1.0.0',
      config: {},
      enabled: true,
    },
    update: {},
  });
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
