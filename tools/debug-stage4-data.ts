// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient({});
const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function main() {
  console.log(`Checking scenes for project ${PROJECT_ID}...`);

  const scenes = await prisma.scene.findMany({
    where: {
      episode: {
        season: {
          projectId: PROJECT_ID,
        },
      },
    },
    orderBy: { index: 'asc' },
  });

  console.log(`Found ${scenes.length} scenes.`);

  for (const scene of scenes) {
    console.log(`[${scene.index}] ID: ${scene.id}`);
    console.log(`    Title: ${scene.title}`);
    console.log(`    VD Score: ${scene.visualDensityScore}`);
    console.log(`    Enriched: ${scene.enrichedText ? 'YES' : 'NO'}`);
    if (scene.enrichedText) {
      console.log(`    Text: ${scene.enrichedText.substring(0, 50)}...`);
    }
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
