import axios from 'axios';
import { PrismaClient } from 'database';

const prisma = new PrismaClient();
const PROJECT_ID = 'prod-pilot-pilot_1770212330012';
const API_URL = 'http://localhost:3000/api/admin/prod-gate/shot-render';
const BATCH_SIZE = 500;

async function run() {
  console.log(`[MassTrigger] Fetching up to ${BATCH_SIZE} shots for project ${PROJECT_ID}...`);

  const shots = await prisma.shot.findMany({
    where: {
      scene: {
        episode: {
          season: {
            projectId: PROJECT_ID,
          },
        },
      },
    },
    take: BATCH_SIZE,
    select: {
      id: true,
    },
  });

  console.log(`[MassTrigger] Found ${shots.length} shots. Starting batch trigger...`);

  let successCount = 0;
  let failCount = 0;

  for (const shot of shots) {
    try {
      const response = await axios.post(API_URL, {
        shotId: shot.id,
        artifactDir: 'docs/_evidence/mass_render_test',
        prompt: 'Stress test shot rendering',
        jobId: `stress_render_${Date.now()}_${shot.id.slice(0, 8)}`,
      });

      if (response.data.success) {
        successCount++;
        if (successCount % 50 === 0) {
          console.log(`[MassTrigger] Triggered ${successCount} jobs...`);
        }
      } else {
        failCount++;
      }
    } catch (err: any) {
      failCount++;
      console.error(`[MassTrigger] Failed to trigger shot ${shot.id}: ${err.message}`);
    }
    // Subtle delay to avoid overwhelming API connection pool immediately
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log(`[MassTrigger] COMPLETE.`);
  console.log(`[MassTrigger] Total Success: ${successCount}`);
  console.log(`[MassTrigger] Total Failed: ${failCount}`);

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('[MassTrigger] Fatal error:', err);
  process.exit(1);
});
