import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const sdxlVersion = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
const svdVersion = '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';

const OUT_DIR = path.join(repoRoot, 'storage', 'videos', 'wangu_ep1_true_i2v');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

async function runReplicateWithRetry(modelStr: `${string}/${string}:${string}`, input: any, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const out = await replicate.run(modelStr, { input });
            return Array.isArray(out) ? String(out[0]) : String((out as any)?.video ?? out);
        } catch (e: any) {
            if (e.message && e.message.includes('429')) {
                const delay = (i + 1) * 10000;
                console.warn(`[429] Rate limited. Retrying in ${delay / 1000}s... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                if (i === maxRetries - 1) throw e;
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    throw new Error("API Max retries exceeded.");
}

async function generateFirstFrame(prompt: string, characterId: string) {
    console.log(`[I2V - Phase 1] Generating locked first frame for ${characterId}...`);
    const anchorPath = path.join(repoRoot, `storage/characters/${characterId}/anchors/canonical_front.png`);
    const frontBlob = fs.readFileSync(anchorPath);
    const base64Anchor = `data:image/png;base64,${frontBlob.toString('base64')}`;

    const outUrl = await runReplicateWithRetry(`stability-ai/sdxl:${sdxlVersion}`, {
        prompt: `A perfect cinematic shot. ${prompt}. High quality masterpiece, 8k.`,
        image: base64Anchor,
        prompt_strength: 0.85 // Give it room to change background but keep the character's facial and structural identity from the Tri-View!
    });
    return outUrl;
}

async function generateVideoFromFrame(imageUrl: string) {
    console.log("[I2V - Phase 2] Generating Video via SVD...");
    const outUrl = await runReplicateWithRetry(`stability-ai/stable-video-diffusion:${svdVersion}`, {
        input_image: imageUrl,
        motion_bucket_id: 127,
        frames_per_second: 12,
        sizing_strategy: "crop_to_16_9"
    });
    return outUrl;
}

function generateTTSAndMix(videoFile: string, text: string, outFile: string, voice: string = "Ting-Ting") {
    console.log(`[TTS] Synthesizing speech: "${text}" with macOS say (${voice})...`);
    const tmpAiff = path.join(OUT_DIR, `temp_${Date.now()}.aiff`);
    const tmpWav = path.join(OUT_DIR, `temp_${Date.now()}.wav`);

    try {
        execSync(`say -v ${voice} -o "${tmpAiff}" -- "${text}"`);
        execSync(`ffmpeg -y -i "${tmpAiff}" -ar 44100 -ac 1 "${tmpWav}" 2>/dev/null`);
        console.log(`[Merge] Merging video with TTS audio...`);
        // Use copy for video, aac for audio
        execSync(`ffmpeg -y -i "${videoFile}" -i "${tmpWav}" -c:v copy -c:a aac -shortest "${outFile}" 2>/dev/null`); // Pad or shortest? svd is short.

        if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff);
        if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
    } catch (e: any) {
        console.error("[TTS/Merge Error]", e.message);
        // Fallback to plain video if audio merge fails
        if (!fs.existsSync(outFile)) fs.copyFileSync(videoFile, outFile);
    }
}

async function main() {
    console.log("=== True I2V & TTS Pipeline: V7 Ultimate ===");

    const shotsToRun = [
        {
            scene: 1, shot: 1, charId: 'zhang_ruochen', voice: 'Yating',
            prompt: "Zhang Ruochen with silver hair and silver Hanfu in a dark purple void with broken stars. Looking angry.",
            dialogue: "池瑶，我待你如挚爱，你为何要杀我？"
        },
        {
            scene: 1, shot: 2, charId: 'chi_yao', voice: 'Ting-Ting',
            prompt: "Chi Yao, Empress in golden royal gown, turning forward decisively in the dark void with sword light.",
            dialogue: "神道无情，斩情绝爱。"
        },
        {
            scene: 2, shot: 1, charId: 'lin_fei', voice: 'Mei-Jia',
            prompt: "Lin Fei, a beautiful royal concubine in elegant traditional flowery dress, pushing open a wooden door in winter. Cold snow.",
            dialogue: "尘儿，你醒了，感觉好些了吗？"
        }
    ];

    for (const data of shotsToRun) {
        const finalFile = path.join(OUT_DIR, `s${String(data.scene).padStart(2, '0')}_shot${String(data.shot).padStart(2, '0')}_final.mp4`);
        if (fs.existsSync(finalFile)) {
            console.log(`[Skip] Already completed: ${finalFile}`);
            continue;
        }

        try {
            console.log(`\n--- Processing Scene ${data.scene} Shot ${data.shot} ---`);
            const firstFrameUrl = await generateFirstFrame(data.prompt, data.charId);
            const frameFile = path.join(OUT_DIR, `s${data.scene}_s${data.shot}_frame.png`);
            await downloadFile(firstFrameUrl, frameFile);

            const videoUrl = await generateVideoFromFrame(firstFrameUrl);
            const rawVideoFile = path.join(OUT_DIR, `s${data.scene}_s${data.shot}_raw.mp4`);
            await downloadFile(videoUrl, rawVideoFile);

            if (data.dialogue) {
                generateTTSAndMix(rawVideoFile, data.dialogue, finalFile, data.voice);
                console.log(`[Success] Saved final mixed video to ${finalFile}`);
            } else {
                fs.copyFileSync(rawVideoFile, finalFile);
            }
        } catch (e: any) {
            console.error(`[Fatal] Failed on S${data.scene} Shot${data.shot}:`, e.message);
        }
    }
}

main();
