import { PrismaClient } from '../packages/database';

async function main() {
  const prisma = new PrismaClient();
  try {
    const engineKey = 'stage1_orchestrator';
    const exists = await prisma.engine.findUnique({ where: { engineKey } });
    if (!exists) {
      await prisma.engine.create({
        data: {
          engineKey,
          code: engineKey,
          name: 'Stage 1 Orchestrator',
          type: 'local',
          adapterName: 'local',
          adapterType: 'local',
          config: {},
          mode: 'local',
          enabled: true,
          isActive: true,
        },
      });
      console.log(`Created engine: ${engineKey}`);
    } else {
      console.log(`Engine ${engineKey} already exists.`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
