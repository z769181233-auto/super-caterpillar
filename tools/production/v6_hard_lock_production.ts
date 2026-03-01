import sharp from 'sharp';
import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

/**
 * Hard-Lock Universal Production Engine (V6)
 * RED LINE: Every frame MUST inherit pixels from established tri-views.
 */

const CHARACTER_CONFIG: Record<string, any> = {
    "zhang_ruochen": {
        roi: { left: 130, top: 40, width: 220, height: 220 },
        negative_prompt: "sunglasses, eyewear, distorted face, low quality, blurred eyes, beard, messy hair"
    },
    "chi_yao": {
        roi: { left: 130, top: 40, width: 220, height: 220 },
        negative_prompt: "sunglasses, eyewear, glasses, smiling, informal clothes, casual look"
    },
    "lin_fei": {
        roi: { left: 130, top: 40, width: 220, height: 220 },
        negative_prompt: "sunglasses, eyewear, glasses, heavy makeup, aggressive look"
    },
    "eighth_prince": {
        roi: { left: 130, top: 40, width: 220, height: 220 },
        negative_prompt: "sunglasses, eyewear, glasses, kind eyes, beard, smile"
    }
};

async function createInpaintMask(outPath: string, roiWidth: number, roiHeight: number, targetTop: number, targetLeft: number) {
    const faceShield = await sharp({
        create: { width: roiWidth, height: roiHeight, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer();

    await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
        .composite([{ input: faceShield, top: targetTop, left: targetLeft }])
        .png()
        .toFile(outPath);
}

async function renderShot(charId: string, shotId: string, prompt: string) {
    console.log(`\n[V6_BATCH_PROD] Processing: ${charId} -> ${shotId}`);

    const config = CHARACTER_CONFIG[charId];
    if (!config) throw new Error(`UNKNOWN_CHARACTER: ${charId}`);

    const charRoot = path.join(repoRoot, 'storage', 'characters', charId);
    const sheetPath = path.join(charRoot, 'anchors', 'guoman_triview_sheet.png');

    if (!fs.existsSync(sheetPath)) throw new Error(`MISSING_CORE_ASSET: ${sheetPath}`);

    const outDir = path.join(repoRoot, 'storage', 'videos', `v6_prod_${shotId}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Step 1: Pre-Composite & Mask (Hard-Lock Face)
    const targetTop = 180;
    const targetLeft = 352;

    const faceBuffer = await sharp(sheetPath)
        .extract(config.roi)
        .resize(320, 320)
        .png()
        .toBuffer();

    const compositeInPath = path.join(outDir, 'composite_for_inpaint.png');
    await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 25, g: 25, b: 30 } }
    })
        .composite([{ input: faceBuffer, top: targetTop, left: targetLeft }])
        .png()
        .toFile(compositeInPath);

    const maskPath = path.join(outDir, 'inpaint_mask.png');
    await createInpaintMask(maskPath, 320, 320, targetTop, targetLeft);

    // Step 2: SDXL Inpaint Stitching
    console.log(`[Replicate] Rendering Inpaint Stitch...`);

    const imageBase64 = `data:image/png;base64,${fs.readFileSync(compositeInPath).toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`;

    const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: imageBase64,
                mask: maskBase64,
                prompt: prompt,
                strength: 0.95,
                guidance_scale: 8.5,
                num_inference_steps: 40,
                negative_prompt: config.negative_prompt,
                refine: "expert_ensemble_refiner",
                apply_watermark: false
            }
        }
    ) as any;

    const url = Array.isArray(output) ? output[0] : output;
    const finalPath = path.join(outDir, 'v6_hard_locked_final.png');
    const response = await fetch(url);
    const buffer = await response.buffer();
    fs.writeFileSync(finalPath, buffer);

    console.log(`[Success] Shot Rendered: ${finalPath}`);
}

/**
 * PRODUCTION QUEUE: Episode 1 Multi-Character Pilot
 */
async function runEpisodeQueue() {
    const queue = [
        {
            charId: "eighth_prince",
            shotId: "s03_shot01_pilot_v6",
            prompt: "Eighth Prince Zhang Ji, wearing a majestic dark purple royal robe with gold dragon embroidery, standing tall and arrogant with a sinister smirk, cinematographic lighting, 3D CGI guoman style, high fidelity, masterpiece, 8k resolution."
        }
    ];

    for (const job of queue) {
        await renderShot(job.charId, job.shotId, job.prompt);
    }
}

runEpisodeQueue().catch(console.error);
