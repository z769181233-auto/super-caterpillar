import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});
const SCENE_ID = '415e844f-429b-4f65-959f-8c4843ad76bf'; // ID from previous successful run

async function check() {
  console.log(`🔍 Checking DB for Scene ID: ${SCENE_ID}`);

  const scene = await prisma.scene.findUnique({ where: { id: SCENE_ID } });
  if (!scene) {
    console.error('❌ Scene not found in DB');
  } else {
    console.log('✅ Scene found:', scene.title);
    if (scene.enrichedText) {
      console.log('   Enriched Text (on Scene):', scene.enrichedText.substring(0, 50) + '...');
    } else {
      console.log('   Enriched Text (on Scene): NULL');
    }
  }

  // Check SemanticEnhancement table
  // Assuming nodeType is 'Scene' or 'SCENE'
  const enhancement = await prisma.semanticEnhancement.findFirst({
    where: {
      nodeId: SCENE_ID,
    },
  });

  if (!enhancement) {
    console.error('❌ SemanticEnhancement record not found');
  } else {
    console.log('✅ SemanticEnhancement record found!');
    console.log('   ID:', enhancement.id);
    console.log('   NodeType:', enhancement.nodeType);
    console.log('   Data:', JSON.stringify(enhancement.data, null, 2));
  }

  await prisma.$disconnect();
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
