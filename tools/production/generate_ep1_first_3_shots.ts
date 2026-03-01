import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const SCRIPT_FILE = path.join(ARTIFACTS_DIR, 'script', 'video_script.json');
const OUT_DIR = path.join(process.cwd(), 'storage', 'videos', 'wangu_ep1_first_3_shots');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CHARACTER_BIBLE: Record<string, string> = {
    // Injecting the V5 ultimate prompts directly into the video pipeline
    "张若尘": "A peerless handsome young man named Zhang Ruochen. Silver hair, cold expression. Wearing supremely highly detailed luxurious multi-layered silver Hanfu clothing, heavy flowing lustrous silk with metallic silver embroidery.",
    "池瑶": "A peerless beautiful Empress named Chi Yao. Majestic aura. Wearing highly detailed luxurious golden royal gown, heavy flowing lustrous silk and translucent fabric with extreme high-end intricate golden embroidery.",
    "林妃": "A fragile yet beautiful and noble royal concubine named Lin Fei. Wearing elegant traditional Hanfu dress, heavy lustrous silk with extreme high-end intricate floral embroidery.",
    "八皇子张济": "A sinister and arrogant young prince with a charismatic evil smirk. Wearing supremely highly detailed 'Jian Lai' Donghua style asymmetrical multi-layered dark imperial robes. Crafted from heavy flowing dark clouds lustrous silk with ancient bronze metallic embroidery and dark metal arm guards. Perfect anatomical proportions.",
    "张济": "A sinister and arrogant young prince. Wearing supremely highly detailed 'Jian Lai' Donghua style asymmetrical multi-layered dark imperial robes with ancient bronze metallic embroidery.",
};

function enhancePromptForAction(originalPrompt: string): string {
    let enhanced = originalPrompt;

    for (const [name, desc] of Object.entries(CHARACTER_BIBLE)) {
        if (enhanced.includes(name)) {
            enhanced = enhanced.replace(new RegExp(name, 'g'), `${name} (${desc})`);
        }
    }

    enhanced = enhanced.replace(/\(Masterpiece 3D CGI:1\.5\),?|\(Seedance-Level Aesthetic:1\.6\),?|\(Unreal Engine 5 high-fidelity render:1\.4\),?/g, '');
    return `${enhanced}. Highly dynamic physical motion, dramatic lighting, masterpiece 3D CGI animation, no facial distortion or morphing.`;
}

async function renderShot(sceneIndex: number, shotIndex: number, prompt: string) {
    const outFile = path.join(OUT_DIR, `s${String(sceneIndex).padStart(2, '0')}_shot${String(shotIndex).padStart(2, '0')}.mp4`);
    if (fs.existsSync(outFile)) {
        console.log(`[Skip] Shot ${sceneIndex}-${shotIndex} already rendered: ${outFile}`);
        return;
    }

    console.log(`\n[Render] Starting Scene ${sceneIndex} Shot ${shotIndex}...`);
    const actionPrompt = enhancePromptForAction(prompt);
    console.log(`[Visual Engine Prompt]: \n  ${actionPrompt}\n`);

    let retries = 5;
    while (retries > 0) {
        try {
            const output = await replicate.run(
                "minimax/video-01",
                {
                    input: {
                        prompt: actionPrompt,
                        prompt_optimizer: true
                    }
                }
            );

            let videoUrl: string = '';
            if (typeof output === 'string') {
                videoUrl = output;
            } else if (typeof output === 'object' && output !== null && 'video' in output) {
                videoUrl = String((output as any).video);
            } else if (Array.isArray(output)) {
                videoUrl = String(output[0]);
            } else {
                videoUrl = String(output);
            }

            console.log(`[Download] Saving Scene ${sceneIndex} Shot ${shotIndex} video...`);
            await downloadFile(videoUrl, outFile);
            console.log(`[Success] Video saved to ${outFile}`);

            console.log("Cooling down minimax/video-01 for 20 seconds to prevent rate limits...");
            await sleep(20000);
            break;

        } catch (e: any) {
            retries--;
            if (e.message && e.message.includes('429')) {
                const delayMs = (5 - retries) * 10000 + 5000;
                console.warn(`[API 429 Error] Retrying in ${delayMs / 1000}s... (Retries left: ${retries})`);
                await sleep(delayMs);
            } else {
                console.error(`[Error] Failed to render Scene ${sceneIndex} Shot ${shotIndex}: ${e.message}`);
                if (retries === 0) throw e;
                await sleep(5000);
            }
        }
    }
}

async function main() {
    console.log("=== Generating Episode 1 - First 3 Shots (V6 Aesthetic & Material Locked) ===");

    if (!fs.existsSync(SCRIPT_FILE)) {
        console.error(`Script not found: ${SCRIPT_FILE}`);
        return;
    }

    const scriptData = JSON.parse(fs.readFileSync(SCRIPT_FILE, 'utf8'));
    let shotsProcessed = 0;

    for (const scene of scriptData) {
        for (const shot of scene.shots) {
            if (shotsProcessed >= 3) break;

            await renderShot(scene.sceneIndex, shot.index, shot.visual_prompt);
            shotsProcessed++;
        }
        if (shotsProcessed >= 3) break;
    }

    console.log("\n=== Finished generating the first 3 shots of EP1 ===");
}

main();
