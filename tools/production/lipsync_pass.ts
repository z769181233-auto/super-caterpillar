import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

async function runLipSync(videoPath: string, text: string, voice: string, outPath: string) {
    console.log(`\n[LipSync-Pass] Starting for: ${text}`);

    // 1. Generate TTS Wav
    const tmpWav = path.join(brainDir, `temp_sync_${Date.now()}.wav`);
    const tmpAiff = path.join(brainDir, `temp_sync_${Date.now()}.aiff`);
    try {
        execSync(`say -v ${voice} -o "${tmpAiff}" -- "${text}"`);
        execSync(`ffmpeg -y -i "${tmpAiff}" -ar 16000 -ac 1 "${tmpWav}" 2>/dev/null`);
    } catch (e) {
        console.error("TTS failed", e);
        return;
    }

    // 2. Run Replicate LipSync
    console.log("[Replicate] Running sync/lipsync-2...");

    try {
        // Many replicate models allow Passing file buffers directly or URLs.
        // sync/lipsync-2 expectes { audio, video }
        const output = await replicate.run(
            "sync/lipsync-2",
            {
                input: {
                    video: fs.readFileSync(videoPath),
                    audio: fs.readFileSync(tmpWav),
                    temperature: 0.5,
                    sync_mode: "loop"
                }
            }
        ) as any;

        const url = Array.isArray(output) ? output[0] : (output.video || output);
        await downloadFile(url, outPath);

        console.log(`[Success] LipSynced video saved to: ${outPath}`);
    } catch (e) {
        console.log("[Error] Replicate run failed. Trying fallback model lucataco/wav2lip...");
        try {
            const output = await replicate.run(
                "lucataco/wav2lip:122ce2e2ddcc7265f80b2d6a50b8686f059cb6ec261ed238053787752e519e9e",
                {
                    input: {
                        face: fs.readFileSync(videoPath),
                        audio: fs.readFileSync(tmpWav)
                    }
                }
            ) as any;
            const url = Array.isArray(output) ? output[0] : output;
            await downloadFile(url, outPath);
            console.log(`[Success] LipSynced video saved to (fallback): ${outPath}`);
        } catch (e2) {
            console.error("[Fatal] All LipSync models failed.", e2);
        }
    } finally {
        if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
        if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff);
    }
}

const inputVideo = path.join(brainDir, "s01_shot01_zoomed.mp4");
const dialogue = "池瑶，我待你如摯愛，你為何要殺我？";
const finalOutput = path.join(brainDir, "s01_shot01_performance_final.mp4");

if (fs.existsSync(inputVideo)) {
    runLipSync(inputVideo, dialogue, "Yating", finalOutput).catch(console.error);
} else {
    console.error("Input video not found: " + inputVideo);
}
