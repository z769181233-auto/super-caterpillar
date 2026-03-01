import sharp from 'sharp';
import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import axios from 'axios';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

export async function renderShotV7(params: {
    charId: string;
    shotId: string;
    prompt: string;
    dialogue?: string;
    voice?: string;
}) {
    console.log(`\n>>> Rendering SCU 2.0 Shot: ${params.shotId}`);
    const outDir = path.join(repoRoot, 'storage', 'videos', `v7_prod_${params.shotId}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. Lossless Overlay + Global Fusion
    const anchorFace = path.join(brainDir, `${params.charId}_v10_final_perfection.png`);
    if (!fs.existsSync(anchorFace)) throw new Error(`Missing Anchor: ${anchorFace}`);

    const faceROI = await sharp(anchorFace)
        .extract({ left: 300, top: 120, width: 424, height: 424 })
        .resize(320, 320)
        .png()
        .toBuffer();

    const overlayImg = path.join(outDir, 'step1_overlay.png');
    await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 15, g: 15, b: 20 } }
    })
        .composite([{ input: faceROI, top: 180, left: 352 }])
        .png()
        .toFile(overlayImg);

    console.log(`[Replicate] Global Fusion...`);
    const sdxlOutput = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
            input: {
                image: `data:image/png;base64,${fs.readFileSync(overlayImg).toString('base64')}`,
                prompt: `${params.prompt}, peak guoman 3D sub-surface scattering style, masterpiece`,
                strength: 0.35,
                negative_prompt: "photorealistic, pores, blurry, sunglasses"
            }
        }
    ) as any;

    const firstFrameFile = path.join(outDir, 'first_frame.png');
    await downloadFile(sdxlOutput[0] || sdxlOutput, firstFrameFile);

    // 2. I2V Motion (SVD/Sync)
    console.log(`[Replicate] I2V Production...`);
    const videoOutput = await replicate.run(
        "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
        {
            input: {
                input_image: `data:image/png;base64,${fs.readFileSync(firstFrameFile).toString('base64')}`,
                motion_bucket_id: 127
            }
        }
    ) as any;

    const rawVideo = path.join(outDir, 'raw_motion.mp4');
    await downloadFile(videoOutput, rawVideo);

    // 3. Camera Movement (Zoom)
    console.log(`[FFmpeg] Applying Camera Zoom...`);
    const zoomedVideo = path.join(outDir, 'zoomed_performance.mp4');
    const filter = "scale=1280:720,zoompan=z='zoom+0.001':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=100:s=1280x720";
    execSync(`ffmpeg -y -i "${rawVideo}" -vf "${filter}" -c:v libx264 -pix_fmt yuv420p "${zoomedVideo}" 2>/dev/null`);

    // 4. Lipsync (if dialogue)
    if (params.dialogue && params.voice) {
        console.log(`[Perform] LipSync Pass...`);
        const tmpWav = path.join(outDir, 'dialogue.wav');
        execSync(`say -v ${params.voice} -o "${tmpWav}.aiff" -- "${params.dialogue}"`);
        execSync(`ffmpeg -y -i "${tmpWav}.aiff" -ar 16000 -ac 1 "${tmpWav}" 2>/dev/null`);

        const syncOutput = await replicate.run(
            "sync/lipsync-2",
            {
                input: {
                    video: fs.readFileSync(zoomedVideo),
                    audio: fs.readFileSync(tmpWav)
                }
            }
        ) as any;

        const finalFile = path.join(outDir, 'final_performance.mp4');
        await downloadFile(syncOutput.video || syncOutput, finalFile);
        console.log(`[SUCCESS] Final Video: ${finalFile}`);
    } else {
        console.log(`[SUCCESS] Final Video (No Dialogue): ${zoomedVideo}`);
    }
}
