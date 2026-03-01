import { PrismaClient } from '../../packages/database/src/generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PROJECT_ID = 'wangu_trailer_20260215_232235';
const SCRIPT_PATH =
  '/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/EPISODE_1_SCRIPT.md';

async function main() {
  console.log(`[Sync] Reading script from: ${SCRIPT_PATH}`);
  const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

  // Parser: Split into scenes
  const scenesToSync: any[] = [];
  const sceneBlocks = content.split(/### 🎞️ 场景 /).slice(1);

  for (const block of sceneBlocks) {
    const lines = block.split('\n');
    const header = lines[0];
    const indexMatch = header.match(/^(\d+)：(.*)/);
    if (!indexMatch) continue;

    const index = parseInt(indexMatch[1]);
    const title = indexMatch[2].trim();
    const body = lines.slice(1).join('\n');

    // Extract env
    const envMatch = body.match(/\*\*【环境】\*\*：(.*?)(?=\n|\Z)/);
    const env = envMatch ? envMatch[1].trim() : '';

    // Extract shots
    // Robust regex for shots
    const shotRegex = /\*\*【镜头 (\d+)\/.*?】\*\*：(.*?)(?=\n\*\*【镜头|\n\n|\n---|\Z)/gs;
    let sMatch;
    const shots: any[] = [];
    while ((sMatch = shotRegex.exec(body)) !== null) {
      shots.push({
        index: parseInt(sMatch[1]),
        description: sMatch[2].trim(),
      });
    }

    scenesToSync.push({ index, title, env, shots });
  }

  console.log(`[Sync] Parsed ${scenesToSync.length} scenes.`);

  // 1. Clean up existing scenes at these indices to prevent duplicates
  const indices = scenesToSync.map((s) => s.index);
  console.log(`[Sync] Archiving existing scenes at indices: ${indices.join(', ')}`);

  await prisma.scene.updateMany({
    where: {
      projectId: PROJECT_ID,
      sceneIndex: { in: indices },
    },
    data: {
      status: 'ARCHIVED',
      title: `[Archived] ${new Date().toISOString()}`,
    },
  });

  // 2. Create fresh scenes
  for (const sceneData of scenesToSync) {
    console.log(`[Sync] Creating Scene ${sceneData.index}: ${sceneData.title}`);

    // Fetch defaults from an existing known scene if possible
    const refScene = await prisma.scene.findFirst({ where: { projectId: PROJECT_ID } });

    const newScene = await prisma.scene.create({
      data: {
        projectId: PROJECT_ID,
        sceneIndex: sceneData.index,
        title: sceneData.title,
        summary: sceneData.env,
        enrichedText: sceneData.env,
        status: 'PENDING',
        episodeId: refScene?.episodeId,
        chapterId: refScene?.chapterId
          ? `${refScene.chapterId}-${sceneData.index}-sync`
          : undefined, // ChapterId usually unique
      },
    });

    for (const shotData of sceneData.shots) {
      console.log(`[Sync] Creating Shot ${shotData.index} for Scene ${sceneData.index}`);

      const finalPrompt = `(Masterpiece 3D CGI:1.5), (Seedance-Level Aesthetic:1.6), Environment: ${sceneData.env}. Shot: ${shotData.description}. (Unreal Engine 5 high-fidelity render:1.4)`;

      await prisma.shot.create({
        data: {
          sceneId: newScene.id,
          index: shotData.index,
          visualPrompt: finalPrompt,
          renderStatus: 'PENDING',
          type: 'DEFAULT',
          params: {
            visual_prompt: finalPrompt,
            description: shotData.description,
            environment: sceneData.env,
            characters: [],
          },
        },
      });
    }
  }

  console.log('[Sync] Database rebuild completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
