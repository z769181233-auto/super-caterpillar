// @ts-ignore
import { PrismaClient } from '../packages/database/src/generated/prisma/index';

const prisma = new PrismaClient();
const PROJECT_ID = process.argv[2];

if (!PROJECT_ID) {
  console.error('Usage: ts-node tools/verify-stage4-5-api.ts <PROJECT_ID>');
  process.exit(1);
}

async function verifyStage5() {
  console.log(`\n--- Verifying Stage 5 (Shot Planning) for Project ${PROJECT_ID} ---`);

  // 1. Find the target shot
  // We just pick the first shot available in the project
  const shot = await prisma.shot.findFirst({
    where: {
      scene: {
        projectId: PROJECT_ID,
      },
    },
    orderBy: { index: 'asc' },
  });

  if (!shot) {
    console.error('❌ Stage 5 FAILED: No shot found in project');
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
  // We expect structure: { shotType, movement, angle, lighting, ... }
  const data = planning.data as any;

  // Relaxed assertions (Check existence rather than specific values)
  const hasShotType = !!data?.shotType;
  const hasMovement = !!data?.movement;
  const hasAction = !!data?.action;

  if (hasShotType && hasMovement) {
    console.log(`✅ ShotPlanning Data Verified (Shot ID: ${shot.id}):`);
    console.log(`   - shotType: ${JSON.stringify(data.shotType)}`);
    console.log(`   - movement: ${JSON.stringify(data.movement)}`);
    console.log(`   - action: ${data.action ? data.action.substring(0, 30) + '...' : 'N/A'}`);
    return true;
  } else {
    console.error('❌ Stage 5 FAILED: Data structure incomplete');
    console.log('   - Actual Data:', JSON.stringify(data, null, 2));
    return false;
  }
}

async function main() {
  const s5 = await verifyStage5();

  if (s5) {
    console.log('\n🎉 STAGE 5 VERIFICATION PASSED');
    process.exit(0);
  } else {
    console.error('\n💥 VERIFICATION FAILED');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
