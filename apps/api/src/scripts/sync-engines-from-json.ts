/* eslint-disable no-console */
import { PrismaClient } from 'database';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.resolve(__dirname, '../config/engines.json');
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content) as { engines: any[] };

  for (const engine of data.engines) {
    const exists = await (prisma as any).engine.findUnique({
      where: { engineKey: engine.engineKey },
    });
    if (exists) {
      console.log(`[sync-engines] skip existing ${engine.engineKey}`);
      continue;
    }

    await (prisma as any).engine.create({
      data: {
        engineKey: engine.engineKey,
        adapterName: engine.adapterName,
        adapterType: engine.adapterType,
        config: engine.httpConfig ?? engine.localConfig ?? engine.config ?? {},
        enabled: engine.enabled ?? true,
        version: engine.modelInfo?.version ?? null,
      },
    });
    console.log(`[sync-engines] created ${engine.engineKey}`);
  }

  console.log('[sync-engines] done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
