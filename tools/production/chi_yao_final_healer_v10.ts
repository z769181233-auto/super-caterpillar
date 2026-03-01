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

async function healSeamPerfectly() {
    const compositePath = path.join(brainDir, 'symmetrical_raw_composite.png');
    const maskPath = path.join(brainDir, 'seam_mask_v2.png');

    // Create a VERY NARROW mask to only touch the seam
    const maskWidth = 20;
    const meta = await sharp(compositePath).metadata();
    const centerX = Math.floor((meta.width || 1024) / 2);
    const height = meta.height || 1024;

    const maskShield = await sharp({
        create: { width: maskWidth, height: height, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();

    await sharp({
        create: { width: meta.width!, height: height, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{ input: maskShield, top: 0, left: centerX - (maskWidth / 2) }])
        .png()
        .toFile(maskPath);

    console.log(`[Replicate] Final Seam Healing...`);
    const imageBase64 = `data:image/png;base64,${fs.readFileSync(compositePath).toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`;

    // Using SDXL Inpaint with VERY LOW strength to just blend textures
    const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: imageBase64,
                mask: maskBase64,
                prompt: "seamless skin, blended lips, high detail, masterpiece.",
                strength: 0.15, // Extremely low
                guidance_scale: 7.5,
                num_inference_steps: 30
            }
        }
    ) as any;

    const finalUrl = Array.isArray(output) ? output[0] : output;
    const finalPath = path.join(brainDir, "chi_yao_v10_final_perfection.png");
    const response = await fetch(finalUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(finalPath, buffer);

    console.log(`[Success] V10 Perfection Ready: ${finalPath}`);
}

healSeamPerfectly().catch(console.error);
