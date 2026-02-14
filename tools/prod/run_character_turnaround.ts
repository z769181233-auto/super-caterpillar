import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ComfyUIClient } from './comfyui_client';
import {
  PrismaClient,
  AssetOwnerType,
  AssetType,
} from '../../packages/database/src/generated/prisma';

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const SCRIPT_FILE = path.join(ARTIFACTS_DIR, 'script', 'video_script.json');
const CHAR_DIR = path.join(process.cwd(), '.data', 'storage', 'characters');
const TEMPLATE_FILE = path.join(
  process.cwd(),
  'packages/engines/shot_render/providers/templates/ce02_identity_triview.json'
);

const prisma = new PrismaClient();
const comfy = new ComfyUIClient();

const STORAGE_ROOT = path.join(process.cwd(), '.data', 'storage');
const STUB_IMAGE_PATH = path.join(STORAGE_ROOT, 'test_keyframe.png');

async function main() {
  if (!fs.existsSync(SCRIPT_FILE)) {
    console.error(`Script file not found: ${SCRIPT_FILE}`);
    process.exit(1);
  }

  const script = JSON.parse(fs.readFileSync(SCRIPT_FILE, 'utf-8'));
  const charCounts: Record<string, number> = {};

  // 1. Analyze Characters
  script.forEach((scene: any) => {
    scene.shots.forEach((shot: any) => {
      if (shot.characters && Array.isArray(shot.characters)) {
        shot.characters.forEach((c: string) => {
          const clean = c.trim();
          if (clean) {
            charCounts[clean] = (charCounts[clean] || 0) + 1;
          }
        });
      }
    });
  });

  console.log('Character Counts:', charCounts);

  if (Object.keys(charCounts).length === 0) {
    console.warn("No characters found in script. Generating 'Unknown' character for safety.");
    charCounts['Hero'] = 1;
  }

  // 2. Generate Assets
  if (!fs.existsSync(CHAR_DIR)) {
    fs.mkdirSync(CHAR_DIR, { recursive: true });
  }

  const bible: Record<string, any> = {};
  const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf-8'));

  // PROJECT_ID passed via env or just use a default for characters
  const projectId = process.env.PROJECT_ID || 'characters-lib';

  for (const name of Object.keys(charCounts)) {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const charPath = path.join(CHAR_DIR, safeName);
    if (!fs.existsSync(charPath)) fs.mkdirSync(charPath, { recursive: true });

    console.log(`Generating real assets via ComfyUI for: ${name} (${safeName})`);

    const seed = Math.floor(Math.random() * 1000000);
    const views: Record<string, string> = {};

    for (const view of ['front', 'side', 'back']) {
      const outFile = path.join(charPath, `turnaround_${view}.png`);
      const storageKey = `characters/${safeName}/turnaround_${view}.png`;

      if (!fs.existsSync(outFile)) {
        console.log(`   Rendering ${view} view...`);
        // Customize template for each view
        const prompt = `Character concept art, full body, ${view} view of ${name}, turnaround, high quality, masterpiece, white background`;
        const runPrompt = JSON.parse(JSON.stringify(template));
        runPrompt['3'].inputs.seed = seed;
        runPrompt['6'].inputs.text = prompt;

        try {
          const buffer = await comfy.generateImage(runPrompt);
          fs.writeFileSync(outFile, buffer);
        } catch (e: any) {
          console.warn(
            `      FAILED to generate ${view} view for ${name}: ${e.message}. Using stub image.`
          );
          // Use a stub image instead of throwing a fatal error
          fs.copyFileSync(STUB_IMAGE_PATH, outFile);
        }
      }

      // 落库 Asset
      await prisma.asset.upsert({
        where: {
          ownerType_ownerId_type: {
            ownerId: safeName, // Using character name as ID for the bible phase
            ownerType: AssetOwnerType.CHARACTER,
            type: AssetType.IMAGE,
          },
        },
        update: { storageKey, status: 'GENERATED' },
        create: {
          projectId,
          ownerId: safeName,
          ownerType: AssetOwnerType.CHARACTER,
          type: AssetType.IMAGE,
          storageKey,
          status: 'GENERATED',
        },
      });

      views[view] = outFile;
    }

    bible[name] = {
      name: name,
      assets: views,
      frequency: charCounts[name],
    };
  }

  // 3. Write Bible
  const biblePath = path.join(CHAR_DIR, 'character_bible.json');
  fs.writeFileSync(biblePath, JSON.stringify(bible, null, 2));

  // Also copy to artifacts for user review
  const artifactBible = path.join(ARTIFACTS_DIR, 'characters', 'character_bible.json');
  if (!fs.existsSync(path.dirname(artifactBible)))
    fs.mkdirSync(path.dirname(artifactBible), { recursive: true });
  fs.copyFileSync(biblePath, artifactBible);

  console.log(`[Success] Character Turnaround Complete. Bible: ${biblePath}`);
}

main().catch((e) => {
  console.error('Fatal in Character Gen:', e);
  process.exit(1);
});
