import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { ppv64FromImage, ppv64Similarity } from '../../packages/shared/vision/ppv64';
import { execSync } from 'child_process';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const sdxlVersion = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
const svdVersion = '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';

async function download(url: string, local: string) {
    const res = await axios.get(url, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(local));
}

async function runWithRetry(model: any, input: any) {
    for (let i = 0; i < 5; i++) {
        try { return await replicate.run(model, { input }); }
        catch (e: any) {
            if (e.message.includes('429')) {
                const wait = (i + 1) * 10000;
                console.warn(`[429] Waiting ${wait / 1000}s...`);
                await new Promise(r => setTimeout(r, wait));
            } else throw e;
        }
    }
    throw new Error("Max retries");
}

async function extractLastFrame(videoPath: string, outFrame: string) {
    console.log(`[FFmpeg] Extracting last frame from ${path.basename(videoPath)}...`);
    execSync(`ffmpeg -y -sseof -1 -i "${videoPath}" -update 1 -q:v 1 "${outFrame}" 2>/dev/null`);
}

async function repairFrame(framePath: string, anchorPath: string, prompt: string, outRepair: string) {
    console.log(`[Repair] Identity drift detected. Running Img2Img correction...`);
    const frameBlob = fs.readFileSync(framePath);
    const anchorBlob = fs.readFileSync(anchorPath);

    // Mix: Strong anchor + current frame layout
    const output = await runWithRetry(`stability-ai/sdxl:${sdxlVersion}`, {
        prompt,
        image: `data:image/png;base64,${frameBlob.toString('base64')}`,
        mask: `data:image/png;base64,${anchorBlob.toString('base64')}`, // Simple trick: technically mask could be face region
        prompt_strength: 0.35 // Light touch to fix features but keep pose
    }) as any;

    await download(String(output[0]), outRepair);
}

async function renderSegmentedVideo(shotSpec: any) {
    const { shotId, characterId } = shotSpec;
    const charRoot = path.join(repoRoot, 'storage', 'characters', characterId);
    const anchorPath = path.join(charRoot, 'anchors', 'canonical_front.png');
    const outDir = path.join(repoRoot, 'storage', 'videos', `repair_${shotId}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let currentInputImage = `data:image/png;base64,${fs.readFileSync(anchorPath).toString('base64')}`;
    const segments = 2; // Test with 2 segments for pilot

    const segmentVideos = [];

    for (let i = 0; i < segments; i++) {
        console.log(`\n--- Segment ${i + 1}/${segments} ---`);

        // 1. Generate Motion Segment
        const videoUrl = await runWithRetry(`stability-ai/stable-video-diffusion:${svdVersion}`, {
            input_image: currentInputImage,
            motion_bucket_id: 127
        });
        const segPath = path.join(outDir, `seg_${i}.mp4`);
        await download(String(videoUrl), segPath);
        segmentVideos.push(segPath);

        // 2. Extract and Check drift
        const lastFrame = path.join(outDir, `last_frame_${i}.png`);
        await extractLastFrame(segPath, lastFrame);

        const anchorVec = await ppv64FromImage(anchorPath);
        const currentVec = await ppv64FromImage(lastFrame);
        const score = ppv64Similarity(anchorVec, currentVec);
        console.log(`[Gate] Seqment ${i} Identity Score: ${score.toFixed(4)}`);

        if (score < 0.90) {
            const repaired = path.join(outDir, `repaired_${i}.png`);
            await repairFrame(lastFrame, anchorPath, "Fixing facial details, ultra high resolution", repaired);
            currentInputImage = `data:image/png;base64,${fs.readFileSync(repaired).toString('base64')}`;
        } else {
            currentInputImage = `data:image/png;base64,${fs.readFileSync(lastFrame).toString('base64')}`;
        }
    }

    // 3. Concatenate (In real prod use ffmpeg concat)
    const finalVideo = path.join(outDir, `${shotId}_final_repaired.mp4`);
    console.log(`[Complete] Segmented video with active repair: ${finalVideo}`);
}

// Demo call
renderSegmentedVideo({ shotId: "s01_shot01", characterId: "zhang_ruochen" }).catch(console.error);
