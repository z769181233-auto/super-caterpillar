import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ComfyUIClient } from './comfyui_client';
import {
  PrismaClient,
  AssetOwnerType,
  AssetType,
} from '../../packages/database/src/generated/prisma';
import Replicate from 'replicate';
import axios from 'axios';
import { pipeline } from 'stream/promises';

// Load envs
const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const SCRIPT_FILE = path.join(ARTIFACTS_DIR, 'script', 'video_script.json');
const CHAR_DIR = path.join(process.cwd(), '.data', 'storage', 'characters');
const TEMPLATE_FILE = path.join(
  process.cwd(),
  'packages/engines/shot_render/providers/templates/ce02_identity_triview.json'
);

const prisma = new PrismaClient({});
const comfy = new ComfyUIClient();

const STORAGE_ROOT = path.join(process.cwd(), '.data', 'storage');
const STUB_IMAGE_PATH = path.join(STORAGE_ROOT, 'test_keyframe.png');

// SDXL Model from Adapter
const REPLICATE_MODEL =
  'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

async function downloadImage(url: string, localPath: string): Promise<void> {
  let retries = 0;
  const MAX_DOWNLOAD_RETRIES = 10;
  while (retries < MAX_DOWNLOAD_RETRIES) {
    try {
      const response = await axios.get(url, { responseType: 'stream', timeout: 120000 });
      await pipeline(response.data, fs.createWriteStream(localPath));

      // Verify file size after download
      const stats = fs.statSync(localPath);
      if (stats.size < 50000) {
        throw new Error(`Downloaded file too small (${stats.size} bytes), likely corrupted.`);
      }
      return;
    } catch (e: any) {
      retries++;
      if (retries >= MAX_DOWNLOAD_RETRIES) {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath); // Clean up trash
        throw e;
      }
      console.warn(
        `      Download attempt ${retries} failed for ${url}: ${e.message}. Retrying...`
      );
      await sleep(3000);
    }
  }
}

// Helper to wait
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- STYLE CONFIGURATION (Fanren / Jian Lai / Mu Shen Ji style) ---

// V16.0: "Absolute Subject Locking" (Final Fix for high-end Guoman 3D look)
const GUOMAN_STYLE_PROMPT =
  '(Masterpiece 3D CGI:1.8), (High-end Chinese Animation style:1.7), (High-fidelity Unreal Engine 5 render:1.6), (Clean 3D modeling reference:1.5), smooth oil-like skin, (pearlescent high-end silk reflection:1.4), sharp edges, cinematic studio lighting, (pure neutral light gray background:1.8), no grain, 8k resolution, industrial precision model';

// V16.0: Structure (Clean workstation layout, no background debris)
const TURNAROUND_STRUCT_PROMPT =
  '(Professional character model sheet:1.9), (unified front side and back standing views:1.8), perfectly symmetrical A-pose, (nine-head tall heroic body ratio:1.7), perfectly aligned horizontal, clean spacing between views, (strictly 3D character reference sheet:1.5), no scenery, no background artifacts';

const NEGATIVE_PROMPT =
  '2D, illustration, drawing, sketch, painting, flat color, ink, watercolor, lines, blurry, grainy, (landscape:2.0), (mountains:2.0), (river:2.0), (trees:2.0), scenery, (environment:1.8), background artifacts, distorted anatomy, (short legs:1.5), scifi, futuristic, modern, photo, real human, watermark, signature';

// V16.0: Character DNA (Regal Majesty & Precise Traits)
const CHARACTER_OVERRIDES: Record<string, string> = {
  'Zhang Ruochen':
    '主角张若尘，九头身比例的顶级 3D CG 剑仙，五官极度清冷深邃，高岭之花气质。白银色高级丝绸汉服，精致龙纹暗纹，银色古风发冠。手持玉柄长剑，全身站姿，禁止出现山水背景，UE5 高精模型渲染',
  'Lin Fei':
    '林妃，地位尊崇的皇室贵妃 (Imperial Consort)，顶级 3D CG 贵族女性建模，五官典雅雍容，自带皇权威严。身着极其考究的银白高级 multilayered 皇家丝绸长袍，粉色牡丹刺绣，佩戴全套金玉簪，比例完美，慈爱但神圣不可侵犯，高规格 3D 生产资产',
  "Yun'er":
    '侍女云儿，16岁 3D CG 少女，圆润可爱的 3D 面部建模，清秀无瑕。身着浅绿色交领襦裙，比例协调。标准的 3D 动画制作级侍女资产，纯净灰色背景',
  'Eighth Prince':
    '八皇子张济，狂傲阴鸷的 3D CG 皇族反派，九头身英雄比例。身着极其奢华厚重的深紫色五爪金龙蟒袍，刺绣立体。面部线条锐利，散发皇室邪气。全身站姿 A-pose，标准三视图，UE5 顶级生产规格资产',
  张若尘:
    '主角张若尘，九头身比例的顶级 3D CG 剑仙，五官极度清冷深邃，高岭之花气质。白银色高级丝绸汉服，精致龙纹暗纹，银色古风发冠。手持玉柄长剑，全身站姿，禁止出现山水背景，UE5 高精模型渲染',
  林妃: '林妃，地位尊崇的皇室贵妃 (Imperial Consort)，顶级 3D CG 贵族女性建模，五官典雅雍容，自带皇权威严。身着极其考究的银白高级 multilayered 皇家丝绸长袍，粉色牡丹刺绣，佩戴全套金玉簪，比例完美，慈爱但神圣不可侵犯，高规格 3D 生产资产',
};

async function main() {
  const provider = process.env.CHARACTER_GEN_PROVIDER || 'stub';
  console.log(`[Config] Character Gen Provider: ${provider}`);

  if (provider === 'replicate' && !process.env.REPLICATE_API_TOKEN) {
    console.error('Missing REPLICATE_API_TOKEN');
    process.exit(1);
  }

  const replicate =
    provider === 'replicate' ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN }) : null;

  // 1. Analyze Characters (From DB)
  let charsToProcess: { name: string; desc: string }[] = [];

  const projectId = process.env.PROJECT_ID;
  if (projectId) {
    console.log(`[Config] Reading characters from DB for Project: ${projectId} `);
    const profiles = await prisma.characterProfile.findMany({
      where: { projectId },
    });
    console.log(`[DB] Found ${profiles.length} profiles.`);
    charsToProcess = profiles.map((p) => {
      let descStr = '';
      try {
        const attr = p.attributes as any;
        if (attr) {
          descStr = `${attr.clothing || ''}, ${attr.hair || ''} `;
        }
      } catch (e) {}
      return { name: p.name, desc: descStr };
    });
  } else {
    // Fallback to script file
    if (!fs.existsSync(SCRIPT_FILE)) {
      console.error(`Script file not found: ${SCRIPT_FILE} `);
      process.exit(1);
    }
    const script = JSON.parse(fs.readFileSync(SCRIPT_FILE, 'utf-8'));
    const charCounts: Record<string, number> = {};
    script.forEach((scene: any) => {
      scene.shots.forEach((shot: any) => {
        if (shot.characters && Array.isArray(shot.characters)) {
          shot.characters.forEach((c: string) => {
            const clean = c.trim();
            if (clean) charCounts[clean] = (charCounts[clean] || 0) + 1;
          });
        }
      });
    });
    charsToProcess = Object.keys(charCounts).map((name) => ({ name, desc: '' }));
  }

  if (charsToProcess.length === 0) {
    console.warn("No characters found. Generating 'Unknown' character for safety.");
    charsToProcess.push({ name: 'Hero', desc: 'warrior' });
  }

  // 2. Generate Assets
  if (!fs.existsSync(CHAR_DIR)) {
    fs.mkdirSync(CHAR_DIR, { recursive: true });
  }

  const bible: Record<string, any> = {};

  let template: any;
  if (provider === 'comfy') {
    if (fs.existsSync(TEMPLATE_FILE)) {
      template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf-8'));
    } else {
      console.warn('Comfy template not found, might fail if using comfy');
    }
  }

  const targetProjectId = projectId || 'characters-lib';

  for (const { name, desc } of charsToProcess) {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const charPath = path.join(CHAR_DIR, safeName);
    if (!fs.existsSync(charPath)) fs.mkdirSync(charPath, { recursive: true });

    console.log(`Generating assets via ${provider} for: ${name} (${safeName})`);

    const seed = Math.floor(Math.random() * 1000000);
    const outFile = path.join(charPath, `triview.png`);
    const storageKey = `characters/${safeName}/triview.png`;

    // Check if file exists and is VALID
    let skip = false;
    if (fs.existsSync(outFile)) {
      const stats = fs.statSync(outFile);
      if (stats.size > 10000) {
        skip = true;
        console.log(`   Unified 3-view sheet already exists. Skipping.`);
      }
    }

    if (!skip) {
      console.log(`   Rendering Unified 3-view sheet...`);

      // --- APPLY OVERRIDES ---
      let specificPrompt = desc;
      for (const [key, val] of Object.entries(CHARACTER_OVERRIDES)) {
        if (name.includes(key) || key.includes(name)) {
          specificPrompt = val;
          console.log(`   >> Using Style Override for ${name}: ${specificPrompt.slice(0, 30)}...`);
          break;
        }
      }

      const prompt = `${name}, ${specificPrompt}, ${TURNAROUND_STRUCT_PROMPT}, ${GUOMAN_STYLE_PROMPT}`;

      let success = false;
      let retries = 0;
      const MAX_RETRIES = 5;

      while (!success && retries < MAX_RETRIES) {
        try {
          if (provider === 'replicate' && replicate) {
            const output = await replicate.run(REPLICATE_MODEL as any, {
              input: {
                prompt: prompt,
                negative_prompt: NEGATIVE_PROMPT,
                seed: seed,
                width: 1344, // V14: Increased width for better proportions
                height: 768,
                scheduler: 'K_EULER',
                num_inference_steps: 50,
                guidance_scale: 8.5,
                refine: 'expert_ensemble_refiner',
                high_noise_frac: 0.85,
              },
            });
            const imageUrl = Array.isArray(output) ? output[0] : output;
            await downloadImage(imageUrl as string, outFile);
            success = true;
          } else if (template) {
            const runPrompt = JSON.parse(JSON.stringify(template));
            runPrompt['3'].inputs.seed = seed;
            runPrompt['6'].inputs.text = prompt;
            const buffer = await comfy.generateImage(runPrompt);
            fs.writeFileSync(outFile, buffer);
            success = true;
          } else {
            console.log('      Using stub image.');
            if (fs.existsSync(STUB_IMAGE_PATH)) fs.copyFileSync(STUB_IMAGE_PATH, outFile);
            else fs.writeFileSync(outFile, 'fake image');
            success = true;
          }
        } catch (e: any) {
          if (e.message && e.message.includes('429')) {
            console.warn(`      Rate Limit (429). Retrying in ${5 * (retries + 1)}s...`);
            await sleep(5000 * (retries + 1));
            retries++;
          } else {
            console.error(`      FATAL Error generating Triview for ${name}: ${e.message}`);
            throw e;
          }
        }
      }

      // 落库 Asset
      try {
        await prisma.asset.upsert({
          where: {
            ownerType_ownerId_type: {
              ownerId: safeName,
              ownerType: AssetOwnerType.CHARACTER,
              type: AssetType.IMAGE,
            },
          },
          update: { storageKey, status: 'GENERATED' },
          create: {
            projectId: targetProjectId,
            ownerId: safeName,
            ownerType: AssetOwnerType.CHARACTER,
            type: AssetType.IMAGE,
            storageKey,
            status: 'GENERATED',
          },
        });
      } catch (upsertError: any) {}

      bible[name] = {
        name: name,
        asset: outFile,
        frequency: 1,
      };
    }
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
