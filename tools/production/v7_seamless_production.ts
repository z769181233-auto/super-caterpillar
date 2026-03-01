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
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

/**
 * SCU 2.0 Production Engine (V7)
 * Strategy: 
 * 1. Physical Layering: Lossless pixel overlay of character ROI.
 * 2. Global Fusion: Low-strength (0.35) img2img to blend lighting/texture.
 */

interface RenderParams {
    charId: string;
    shotId: string;
    prompt: string;
    strength: number;
}

async function renderV7(params: RenderParams) {
    console.log(`\n[V7_PROD] Starting: ${params.charId} -> ${params.shotId}`);

    const charRoot = path.join(repoRoot, 'storage', 'characters', params.charId);
    const sheetPath = path.join(charRoot, 'anchors', 'guoman_triview_sheet.png');

    // For Chi Yao, we have the V11 perfect symmetrical face in brainDir
    const godFacePath = path.join(brainDir, 'chi_yao_v10_final_perfection.png');
    const sourceFace = fs.existsSync(godFacePath) ? godFacePath : sheetPath;

    const outDir = path.join(repoRoot, 'storage', 'videos', `v7_prod_${params.shotId}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // --- STEP 1: Lossless Overlay ---
    // Extract a LARGER ROI (320x320) as requested
    const faceROI = await sharp(sourceFace)
        .extract({ left: 300, top: 120, width: 424, height: 424 }) // From 1024 GodFace
        .resize(320, 320)
        .png()
        .toBuffer();

    // Base background for initial placement (Black or dummy)
    const baseCanvas = await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 15, g: 15, b: 20 } }
    })
        .composite([{ input: faceROI, top: 180, left: 352 }])
        .png()
        .toFile(path.join(outDir, 'v7_step1_overlay.png'));

    // --- STEP 2: Global Fusion (Low Strength) ---
    console.log(`[Replicate] Global Fusion (Strength: ${params.strength})...`);

    const imageBase64 = `data:image/png;base64,${fs.readFileSync(path.join(outDir, 'v7_step1_overlay.png')).toString('base64')}`;

    const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: imageBase64,
                prompt: params.prompt,
                strength: params.strength, // 0.35
                guidance_scale: 7.5,
                num_inference_steps: 40,
                negative_prompt: "photorealistic, cinematic photo, real skin texture, pores, freckles, symmetrical asymmetry, distorted face, blurry",
                refine: "expert_ensemble_refiner"
            }
        }
    ) as any;

    const url = Array.isArray(output) ? output[0] : output;
    const finalPath = path.join(outDir, 'v7_final_shot.png');
    const response = await fetch(url);
    const buffer = await response.buffer();
    fs.writeFileSync(finalPath, buffer);

    console.log(`[Success] V7 Shot Completed: ${finalPath}`);
}

// Global Execution
renderV7({
    charId: "chi_yao",
    shotId: "s01_shot01_v7",
    prompt: "Chi Yao, Empress in magnificent golden royal gown, standing in a dark void with floating broken purple crystals, 3D CGI guoman style, masterpiece, sharp focus, volumetric lighting.",
    strength: 0.35
}).catch(console.error);
