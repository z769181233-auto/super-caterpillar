// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();
const PROJECT_ID = '99a1bcdb-fe85-4244-9a80-dabae0a3dbe1';

async function verifyStage4() {
  console.log('\n--- Verifying Stage 4 (Semantic Enhancement) ---');

  // 1. Verify Scene Data (Find the specific enriched scene)
  // We use the ID found in debug step: 8dbd097a-40d8-4e52-9f90-17e59c1553a6
  const scene = await prisma.scene.findFirst({
    where: {
      id: '8dbd097a-40d8-4e52-9f90-17e59c1553a6',
    },
  });

  if (!scene) {
    console.error('❌ Stage 4 FAILED: No scene found');
    return false;
  }

  const hasDensity = scene.visualDensityScore === 8.5;
  const hasEnriched = scene.enrichedText && scene.enrichedText.includes('【AI 增强】');

  if (hasDensity && hasEnriched) {
    console.log(`✅ Scene Attributes Verified:`);
    console.log(`   - visualDensityScore: ${scene.visualDensityScore}`);
    console.log(`   - enrichedText: ${scene.enrichedText.substring(0, 20)}...`);
  } else {
    console.error('❌ Stage 4 FAILED: Missing attributes');
    console.log(`   - visualDensityScore: ${scene.visualDensityScore}`);
    console.log(`   - enrichedText: ${scene.enrichedText}`);
    return false;
  }

  return true;
}

async function verifyStage5() {
  console.log('\n--- Verifying Stage 5 (Shot Planning) ---');

  // 1. Find the target shot
  const shot = await prisma.shot.findFirst({
    where: {
      scene: {
        episode: {
          season: {
            projectId: PROJECT_ID,
          },
        },
      },
    },
    orderBy: { index: 'asc' },
  });

  if (!shot) {
    console.error('❌ Stage 5 FAILED: No shot found');
    return false;
  }

  // 2. Verify ShotPlanning Record
  const planning = await prisma.shotPlanning.findUnique({
    where: { shotId: shot.id },
  });

  if (!planning) {
    console.error(`❌ Stage 5 FAILED: No ShotPlanning record for shot ${shot.id}`);
    return false;
  }

  // 3. Verify Data Content
  const data = planning.data as any;
  const shotTypeValid = data?.shotType?.primary === '中景 (Medium Shot)';
  const movementValid = data?.movement?.primary === '推镜头 (Dolly In)';

  if (shotTypeValid && movementValid) {
    console.log(`✅ ShotPlanning Data Verified:`);
    console.log(`   - shotType: ${data.shotType.primary}`);
    console.log(`   - movement: ${data.movement.primary}`);
  } else {
    console.error('❌ Stage 5 FAILED: Data mismatch');
    console.log('   - Actual Data:', JSON.stringify(data, null, 2));
    return false;
  }

  return true;
}

async function main() {
  const s4 = await verifyStage4();
  const s5 = await verifyStage5();

  if (s4 && s5) {
    console.log('\n🎉 ALL VERIFICATIONS PASSED');
    process.exit(0);
  } else {
    console.error('\n💥 VERIFICATION FAILED');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
