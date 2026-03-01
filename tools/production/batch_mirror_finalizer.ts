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

const CHARACTERS = ["zhang_ruochen", "lin_fei", "eighth_prince"];

async function finalizeMirror(charId: string) {
    console.log(`\n>>> Finalizing Mirror for: ${charId}`);
    const rawPath = path.join(brainDir, `${charId}_god_face_raw.png`);
    const mirroredPath = path.join(brainDir, `${charId}_god_face_mirrored.png`);
    const finalPath = path.join(brainDir, `${charId}_v10_final_perfection.png`);

    if (!fs.existsSync(rawPath)) {
        console.error(`Missing raw file: ${rawPath}`);
        return;
    }

    const img = sharp(rawPath);
    const meta = await img.metadata();
    const halfWidth = Math.floor(meta.width! / 2);

    const leftHalf = await sharp(rawPath)
        .extract({ left: 0, top: 0, width: halfWidth, height: meta.height! })
        .toBuffer();

    const rightHalfMirrored = await sharp(leftHalf)
        .flop()
        .toBuffer();

    await sharp({
        create: { width: meta.width!, height: meta.height!, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([
            { input: leftHalf, left: 0, top: 0 },
            { input: rightHalfMirrored, left: halfWidth, top: 0 }
        ])
        .png()
        .toFile(mirroredPath);

    console.log(`[Success] Mirrored: ${mirroredPath}`);

    // Second Pass: Seam Healing (Flux Fill Pro)
    console.log(`[Replicate] Seam Healing via Flux Fill Pro...`);
    const imageBase64 = `data:image/png;base64,${fs.readFileSync(mirroredPath).toString('base64')}`;

    // Create a thin mask for the center seam (White = change, Black = keep)
    // Actually, Flux-Fill on replicate often follows the Inpaint convention: 
    // Usually mask is black where you want to keep and white where you want to change.
    const maskBuffer = await sharp({
        create: { width: meta.width!, height: meta.height!, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{
            input: await sharp({
                create: { width: 60, height: meta.height!, channels: 3, background: { r: 255, g: 255, b: 255 } }
            }).png().toBuffer(),
            left: halfWidth - 30,
            top: 0
        }])
        .png()
        .toBuffer();

    const maskBase64 = `data:image/png;base64,${maskBuffer.toString('base64')}`;

    try {
        const output = await replicate.run(
            "black-forest-labs/flux-fill-pro",
            {
                input: {
                    image: imageBase64,
                    mask: maskBase64,
                    prompt: "perfect facial feature blending, high fidelity 3D CGI guoman style, masterpiece, seamless face symmetry",
                    guidance_scale: 30, // Higher guidance for better fill consistency
                    output_format: "png",
                    safety_tolerance: 2
                }
            }
        ) as any;

        const url = output;
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(finalPath, buffer);
        console.log(`[Success] Final Perfect Face: ${finalPath}`);
    } catch (e) {
        console.error(`[Error] Seam healing failed for ${charId}:`, e);
    }
}

async function runBatch() {
    for (const charId of CHARACTERS) {
        await finalizeMirror(charId);
    }
}

runBatch().catch(console.error);
