// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();

const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function main() {
  console.log(`Injecting Stage 4 data for project ${PROJECT_ID}...`);

  // 1. Find a scene
  const scene = await prisma.scene.findFirst({
    where: {
      episode: {
        season: {
          projectId: PROJECT_ID,
        },
      },
    },
    orderBy: { index: 'asc' },
  });

  if (!scene) {
    console.log('❌ No scene found.');
    return;
  }

  console.log(`Found Scene ${scene.index}: ${scene.title} (${scene.id})`);

  // 2. Update Scene directly (Stage 4 result)
  const updatedScene = await prisma.scene.update({
    where: { id: scene.id },
    data: {
      visualDensityScore: 8.5,
      enrichedText:
        '【AI 增强】这是一个色彩斑斓的奇幻森林，空气中弥漫着发光的孢子。镜头缓缓推进，展现出微观世界的惊人细节...',
    },
  });

  console.log(
    `✅ Scene Updated: Visual Density = ${updatedScene.visualDensityScore}, Enriched = ${!!updatedScene.enrichedText}`
  );

  // 3. Optional: Create QualityMetrics entry
  await prisma.qualityMetrics.create({
    data: {
      projectId: PROJECT_ID,
      engine: 'CE03',
      visualDensityScore: 8.5,
      metadata: { sceneId: scene.id, note: 'Simulated Injection' },
    },
  });
  console.log('✅ QualityMetrics record created.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
