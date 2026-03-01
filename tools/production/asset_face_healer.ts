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
 * Asset Face Healer (V6)
 * Fixes specific defects in the anchor sheets themselves.
 */

async function healAssetMouth(charId: string, maskROI: any, prompt: string) {
    console.log(`\n[Healer] Repairing Mouth for ${charId}...`);
    const sheetPath = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'guoman_triview_sheet.png');
    const outDir = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'repair_log');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Step 1: Create a specialized mask for the mouth area
    // ROI in sheet (frontal view), e.g., around lower face
    const maskPath = path.join(outDir, 'mouth_repair_mask.png');

    const mouthShield = await sharp({
        create: { width: maskROI.width, height: maskROI.height, channels: 3, background: { r: 255, g: 255, b: 255 } } // White = Area to change
    }).png().toBuffer();

    await sharp({
        create: { width: 1344, height: 768, channels: 3, background: { r: 0, g: 0, b: 0 } } // Black = Keep
    })
        .composite([{ input: mouthShield, top: maskROI.top, left: maskROI.left }])
        .png()
        .toFile(maskPath);

    // Step 2: Call Inpaint to fix the mouth
    console.log(`[Replicate] Refining mouth pixels...`);
    const imageBase64 = `data:image/png;base64,${fs.readFileSync(sheetPath).toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`;

    const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: imageBase64,
                mask: maskBase64,
                prompt: prompt,
                strength: 0.7, // Moderate strength to keep identity but fix shape
                guidance_scale: 8.0,
                num_inference_steps: 50,
                negative_prompt: "distorted lips, double mouth, smear, low quality, blurred",
            }
        }
    ) as any;

    const url = Array.isArray(output) ? output[0] : output;
    const repairedPath = path.join(outDir, 'guoman_triview_repaired_v6.1.png');
    const response = await fetch(url);
    const buffer = await response.buffer();
    fs.writeFileSync(repairedPath, buffer);

    console.log(`[Success] Asset Repaired: ${repairedPath}`);
}

// Chi Yao Mouth ROI (Approximate based on 1344x768 sheet)
// Target: frontal view (left side), mouth is around top 240, left 220? 
// Let's be precise: face is at 130, 40, 220, 220. 
// Mouth should be around top 180 (relative to face) -> top 220 absolute.
// Left 240 absolute.
const chiYaoMouthROI = { left: 210, top: 200, width: 80, height: 60 };
const chiYaoPrompt = "Perfectly shaped red lips, realistic skin texture, beautiful mouth, professional 3D CGI guoman style, extremely detailed.";

healAssetMouth('chi_yao', chiYaoMouthROI, chiYaoPrompt).catch(console.error);
