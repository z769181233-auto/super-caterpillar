import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';

// Load envs
const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, 'apps/api/.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

let apiToken = process.env.REPLICATE_API_TOKEN || '';
if (apiToken.startsWith('"') && apiToken.endsWith('"')) {
    apiToken = apiToken.slice(1, -1);
}

const replicate = new Replicate({
    auth: apiToken,
});

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

async function main() {
    console.log("=== Phase 1: Generate Cinematic First Frame via SDXL Img2Img ===");
    const imagePath = path.join(process.cwd(), 'storage/samples/zhang_ruochen_front.png');
    if (!fs.existsSync(imagePath)) {
        throw new Error(`missing 3-view crop: ${imagePath}`);
    }
    const base64Image = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;

    console.log("Invoking Image Engine (stability-ai/sdxl)...");
    const prompt = "A cinematic close-up of a peerless handsome young man named Zhang Ruochen. He has long silver hair, a cold and determined expression, wearing high-end silver silk Hanfu. Deep purple void background with broken stars. (Masterpiece 3D CGI:1.5), Unreal Engine 5 render, cinematic lighting";

    let firstFrameUrl: string = '';
    try {
        const outImg = await replicate.run(`stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b`, {
            input: {
                prompt: prompt,
                image: base64Image,
                prompt_strength: 0.65 // Lower strength preserves the 3-view face better
            }
        });
        console.log("Image Engine Result:", outImg);
        firstFrameUrl = Array.isArray(outImg) ? String(outImg[0]) : String(outImg);

        const localImgPath = path.join(process.cwd(), 'storage/samples', 'test_i2v_first_frame.png');
        await downloadFile(firstFrameUrl, localImgPath);
        console.log(`Saved first frame to ${localImgPath}`);
    } catch (e: any) {
        console.error("Phase 1 Failed:", e.message);
        return;
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log("\n=== Phase 2: Animate with Image-to-Video Engine (SVD) ===");
    console.log("Sleeping 5 seconds to avoid API Rate Limits (429)...");
    await sleep(5000);
    console.log("Invoking I2V Engine (stability-ai/stable-video-diffusion) with First Frame...");

    // SVD does not take a text prompt, it mathematically animates the pixels of the input image
    try {
        let outVid: any = null;
        for (let i = 0; i < 3; i++) {
            try {
                outVid = await replicate.run("stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438", {
                    input: {
                        input_image: firstFrameUrl,
                        motion_bucket_id: 127,
                        frames_per_second: 12,
                        sizing_strategy: "crop_to_16_9"
                    }
                });
                break; // success
            } catch (e: any) {
                if (e.message && e.message.includes('429')) {
                    console.log(`Rate limited on Phase 2. Retrying in 10s... (${i + 1}/3)`);
                    await sleep(10000);
                } else {
                    throw e; // throw non-429 errors
                }
            }
        }

        console.log("I2V Engine Result:", outVid);
        let videoUrl: string = '';
        if (typeof outVid === 'string') {
            videoUrl = outVid;
        } else if (typeof outVid === 'object' && outVid !== null && 'video' in outVid) {
            videoUrl = String((outVid as any).video);
        } else if (Array.isArray(outVid)) {
            videoUrl = String(outVid[0]);
        } else {
            videoUrl = String(outVid);
        }

        const outDir = path.join(process.cwd(), 'storage/samples');
        const timestamp = Date.now();
        const outFile = path.join(outDir, `wangu_vfx_sample_i2v_${timestamp}.mp4`);

        await downloadFile(videoUrl, outFile);
        console.log(`\nSuccess! High-quality I2V sample generated: ${outFile}`);

    } catch (e: any) {
        console.error("Phase 2 Failed:", e.message);
    }
}

main().catch(console.error);
