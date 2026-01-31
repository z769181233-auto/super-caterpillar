import { PrismaClient } from 'database';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (override) if exists
if (require('fs').existsSync(path.join(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });
}
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding stage1_orchestrator engine...');
  const engine = await prisma.engine.upsert({
    where: { engineKey: 'stage1_orchestrator' },
    update: {
      isActive: true,
      enabled: true,
      mode: 'local',
    },
    create: {
      engineKey: 'stage1_orchestrator',
      code: 'stage1_orchestrator',
      name: 'Stage 1 Orchestrator',
      type: 'local',
      adapterName: 'stage1_orchestrator',
      adapterType: 'local',
      mode: 'local',
      config: {},
      isActive: true,
      enabled: true,
    },
  });
  console.log('Upserted engine:', engine);

  console.log('Seeding character_visual engine...');
  const cvEngine = await prisma.engine.upsert({
    where: { engineKey: 'character_visual' },
    update: { isActive: true, enabled: true, mode: 'mock' },
    create: {
      engineKey: 'character_visual',
      code: 'character_visual',
      name: 'Character Visual Engine',
      type: 'generation',
      adapterName: 'character_visual',
      adapterType: 'generation',
      mode: 'mock',
      config: {},
      isActive: true,
      enabled: true,
    },
  });
  console.log('Upserted character_visual:', cvEngine);
  await prisma.$disconnect();
}

main().catch(console.error);
