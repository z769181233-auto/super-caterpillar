import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';

// Load env
const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log("Starting High-Quality VFX Sample Generation (Walking Retry)...");

    // 核心動作 Prompt：去除過多靜態描述，強調雙腿的交替、身體的推進、衣服的物理擺動，確保 AI 專注於生成「走路」的連續幀。
    const prompt = "A wide full-body shot. A Chinese fantasy swordsman is vividly WALKING forward through a snowy courtyard. He is taking clear, heavy continuous steps, his legs literally moving one after the other. His arms swing naturally with his stride. His body moves forward through space. His silver silk robes flutter intensely with the physical momentum of his walk. The camera physically tracks backwards in front of him as he strides directly towards the lens. Highly dynamic, continuous physical walking motion, realistic striding animation.";

    console.log("Invoking Real Video Engine: minimax/video-01 ...");

    let retries = 5;
    while (retries > 0) {
        try {
            const output = await replicate.run(
                "minimax/video-01",
                {
                    input: {
                        prompt: prompt,
                        prompt_optimizer: true
                    }
                }
            );

            console.log("VFX Engine Result:", output);
            const videoUrl = Array.isArray(output) ? output[0] : output;

            const outDir = path.join(process.cwd(), 'storage/samples');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

            const timestamp = Date.now();
            const outFile = path.join(outDir, `wangu_vfx_sample_true_walking_${timestamp}.mp4`);

            console.log(`Downloading sample to: ${outFile}...`);
            await downloadFile(videoUrl, outFile);

            console.log("Success! High-quality 'true walking' vfx sample generated.");
            console.log(`File: ${outFile}`);
            break;

        } catch (e: any) {
            console.error("VFX Generation Failed with Minimax:", e.message);
            if (e.message && e.message.includes('429')) {
                console.log("Rate limited (429). Retrying in 15 seconds...");
                await sleep(15000);
            } else {
                break;
            }
        }
        retries--;
    }
}

main().catch(console.error);
