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
 * Asset Face Healer V6.2 (Surgical Perfection)
 * Focus: Symmetry & Cleaning the Philtrum.
 */

async function healAssetFaceSurgical(charId: string, maskROI: any, prompt: string) {
    console.log(`\n[Healer V6.2] High-Precision Repair for ${charId}...`);
    const sheetPath = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'guoman_triview_sheet.png');
    const outDir = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'repair_log_v2');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Step 1: Create a surgical mask for the Midline (Nose to Chin)
    const maskPath = path.join(outDir, 'midline_repair_mask.png');

    // We want a mask that covers the vertical center of the face
    const shield = await sharp({
        create: { width: maskROI.width, height: maskROI.height, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();

    await sharp({
        create: { width: 1344, height: 768, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{ input: shield, top: maskROI.top, left: maskROI.left }])
        .png()
        .toFile(maskPath);

    // Step 2: Call SDXL Inpaint with "Symmetry & Cleanup" focus
    console.log(`[Replicate] Reconstructing midline features...`);
    const imageBase64 = `data:image/png;base64,${fs.readFileSync(sheetPath).toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`;

    try {
        const output = await replicate.run(
            "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            {
                input: {
                    image: imageBase64,
                    mask: maskBase64,
                    prompt: prompt,
                    strength: 0.8, // Slightly higher to allow structure change (symmetry)
                    guidance_scale: 9.0, // Higher guidance for strict prompt adherence
                    num_inference_steps: 60,
                    negative_prompt: "crooked mouth, asymmetrical lips, red smear under nose, red philtrum, distorted nose base, low quality, double mouth, messy lipstick",
                    apply_watermark: false
                }
            }
        ) as any;

        const url = Array.isArray(output) ? output[0] : output;
        const repairedPath = path.join(outDir, 'guoman_triview_repaired_v6.2.png');
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(repairedPath, buffer);

        console.log(`[Success] Surgical Repair Complete: ${repairedPath}`);
    } catch (e) {
        console.error(`[Fatal] Repair failed:`, e);
    }
}

// Surgical ROI for Chi Yao: Covers Nose tip to Chin area
// Sheet is 1344x768. Face is 130, 40 to 350, 260.
// Midline is at x=240. 
const surgicalROI = { left: 190, top: 180, width: 100, height: 100 };
const surgicalPrompt = "Perfectly centered and symmetrical red lips, clean and natural skin philtrum under the nose, well-defined mouth shape, masterwork 3D CGI guoman style, realistic textures, high quality.";

healAssetFaceSurgical('chi_yao', surgicalROI, surgicalPrompt).catch(console.error);
