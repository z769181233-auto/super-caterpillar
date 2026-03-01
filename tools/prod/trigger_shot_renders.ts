import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const SCRIPT_JSON_PATH = path.join(process.cwd(), 'artifacts', 'script', 'video_script.json');

async function main() {
  if (!fs.existsSync(SCRIPT_JSON_PATH)) {
    console.error(
      `Error: Script JSON found at ${SCRIPT_JSON_PATH}. Run compile_video_script.ts first.`
    );
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync(SCRIPT_JSON_PATH, 'utf-8'));
  console.log(`[Trigger] Enqueuing jobs for ${scriptData.length} scenes.`);

  for (const scene of scriptData) {
    for (const shot of scene.shots) {
      console.log(
        `[Trigger] Enqueuing SHOT_RENDER for Shot Index ${shot.index} (Scene ID: ${shot.sceneId})`
      );

      // Verify shot existence and current status
      const existingShot = await prisma.shot.findUnique({ where: { id: shot.shotId } });
      if (!existingShot) {
        console.warn(`[Warn] Shot ${shot.shotId} not found in DB. Skipping.`);
        continue;
      }

      // Fetch reference info from scene and shot
      const sceneInfo = await prisma.scene.findUnique({ where: { id: shot.sceneId } });

      // Get character ID from appearances
      const appearance = await prisma.characterAppearance.findFirst({
        where: { shotId: shot.shotId },
      });

      // Create Job
      const job = await prisma.shotJob.create({
        data: {
          organizationId: 'org_wangu',
          projectId: 'wangu_trailer_20260215_232235',
          episodeId: sceneInfo?.episodeId,
          sceneId: shot.sceneId,
          shotId: shot.shotId,
          type: 'SHOT_RENDER',
          status: 'PENDING',
          priority: 5, // Higher priority for production
          payload: {
            sceneId: shot.sceneId,
            shotId: shot.shotId,
            engineKey: 'real_shot_render',
            projectId: 'wangu_trailer_20260215_232235',
            visual_prompt: shot.visual_prompt,
            characterId: appearance?.characterId,
            cameraMovement: existingShot.cameraMovement || scene.cameraMovement,
            shotType: existingShot.shotType || scene.shotType,
            referenceSheetId: 'v18_sealed_reference',
          },
        },
      });

      console.log(`[Success] Created Job ID: ${job.id}`);
    }
  }

  console.log('[Trigger] All 11 shots have been enqueued for rendering.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
