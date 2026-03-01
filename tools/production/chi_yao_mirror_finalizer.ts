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

async function createSymmetricalGodFace(sourcePath: string) {
    console.log(`\n[Symmetry-Engine] Processing ${sourcePath}...`);

    // 1. Load image and find center
    const meta = await sharp(sourcePath).metadata();
    const width = meta.width || 1024;
    const height = meta.height || 1024;
    const centerX = Math.floor(width / 2);

    // 2. Extract Left Half and Flip to Right
    const leftHalf = await sharp(sourcePath)
        .extract({ left: 0, top: 0, width: centerX, height: height })
        .toBuffer();

    const rightHalfMirrored = await sharp(leftHalf)
        .flop() // Mirror horizontally
        .toBuffer();

    // 3. Join into a perfectly symmetrical composite
    const compositePath = path.join(brainDir, 'symmetrical_raw_composite.png');
    await sharp({
        create: { width: centerX * 2, height: height, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([
            { input: leftHalf, left: 0, top: 0 },
            { input: rightHalfMirrored, left: centerX, top: 0 }
        ])
        .png()
        .toFile(compositePath);

    // 4. Use AI to HEAL ONLY THE SEAM (Center vertical line)
    // Mask is a narrow vertical strip in the middle
    const maskPath = path.join(brainDir, 'seam_mask.png');
    const maskWidth = 60; // Narrow seam
    const maskShield = await sharp({
        create: { width: maskWidth, height: height, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();

    await sharp({
        create: { width: centerX * 2, height: height, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{ input: maskShield, top: 0, left: centerX - (maskWidth / 2) }])
        .png()
        .toFile(maskPath);

    console.log(`[Replicate] Healing the vertical seam for seamless skin/lip transition...`);
    const imageBase64 = `data:image/png;base64,${fs.readFileSync(compositePath).toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${fs.readFileSync(maskPath).toString('base64')}`;

    const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: imageBase64,
                mask: maskBase64,
                prompt: "seamless skin texture, perfectly blended mouth and nose, symmetrical face, masterpiece, high fidelity.",
                strength: 0.25, // VERY LOW to maintain the symmetrical structure
                guidance_scale: 7.5,
                num_inference_steps: 40,
                negative_prompt: "visible seam, line in middle, red markings, distorted philtrum"
            }
        }
    ) as any;

    const finalUrl = Array.isArray(output) ? output[0] : output;
    const finalPath = path.join(brainDir, "chi_yao_v9_symmetrical_perfection.png");
    const response = await fetch(finalUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(finalPath, buffer);

    console.log(`[Success] 100% Symmetrical Asset Ready: ${finalPath}`);
}

// Use Candidate 1 as the source for mirroring (it had better texture)
const source = path.join(brainDir, "hunt_cand_1.png");
createSymmetricalGodFace(source).catch(console.error);
