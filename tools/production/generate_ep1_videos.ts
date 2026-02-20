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

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts');
const SCRIPT_FILE = path.join(ARTIFACTS_DIR, 'script', 'video_script.json');
const OUT_DIR = path.join(process.cwd(), 'storage', 'videos', 'wangu_ep1');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CHARACTER_BIBLE: Record<string, string> = {
    "张若尘": "A peerless handsome young man named Zhang Ruochen with long silver hair, a cold and determined expression, wearing high-end silver silk Hanfu",
    "池瑶": "A peerless beautiful Empress named Chi Yao with a majestic aura, wearing a luxurious golden royal gown",
    "林妃": "A fragile yet beautiful and noble royal concubine named Lin Fei, wearing elegant traditional dress",
    "八皇子": "A sinister and arrogant young prince with a python robe",
    "张济": "A sinister and arrogant young prince with a python robe",
    "林泞姗": "A beautiful, petite and arrogant upper-class young swordswoman",
    "林奉先": "A middle-aged arrogant noble lord"
};

function enhancePromptForAction(originalPrompt: string): string {
    let enhanced = originalPrompt;

    // 1. Replace character names with their consistent appearance descriptions
    for (const [name, desc] of Object.entries(CHARACTER_BIBLE)) {
        if (enhanced.includes(name)) {
            enhanced = enhanced.replace(new RegExp(name, 'g'), `${name} (${desc})`);
        }
    }

    // 2. Remove static or overly abstract aesthetic tags that confuse the video model
    enhanced = enhanced.replace(/\(Masterpiece 3D CGI:1\.5\),?|\(Seedance-Level Aesthetic:1\.6\),?|\(Unreal Engine 5 high-fidelity render:1\.4\),?/g, '');

    // 3. Append dynamic rendering instructions without forcing camera angles
    return `${enhanced}. Highly dynamic, continuous physical motion, realistic physics, dramatic cinematic lighting, masterpiece 3D CGI animation.`;
}

async function renderShot(sceneIndex: number, shotIndex: number, prompt: string) {
    const outFile = path.join(OUT_DIR, `s${String(sceneIndex).padStart(2, '0')}_shot${String(shotIndex).padStart(2, '0')}.mp4`);
    if (fs.existsSync(outFile)) {
        console.log(`[Skip] Shot ${sceneIndex}-${shotIndex} already rendered: ${outFile}`);
        return;
    }

    console.log(`[Render] Starting Scene ${sceneIndex} Shot ${shotIndex}...`);
    const actionPrompt = enhancePromptForAction(prompt);
    console.log(`[Prompt] ${actionPrompt}`);

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

            console.log(`[Download] Saving Scene ${sceneIndex} Shot ${shotIndex}...`);
            await downloadFile(videoUrl, outFile);
            console.log(`[Success] Saved to ${outFile}`);

            // Wait 20 seconds between successful renders to cool down API limits
            console.log("Cooling down for 20s...");
            await sleep(20000);
            break;

        } catch (e: any) {
            console.error(`[Error] Failed Scene ${sceneIndex} Shot ${shotIndex}:`, e.message);
            if (e.message && e.message.includes('429')) {
                console.log("Rate limited (429). Retrying in 30 seconds...");
                await sleep(30000);
            } else if (e.message && e.message.includes('500')) {
                console.log("Server error (500). Retrying in 15 seconds...");
                await sleep(15000);
            } else {
                console.log("Unrecoverable error. Skipping this shot.");
                break;
            }
        }
        retries--;
    }
}

async function main() {
    console.log("Parsing full script for EP1 Batch Video Gen...");
    const script = JSON.parse(fs.readFileSync(SCRIPT_FILE, 'utf-8'));
    let totalShots = 0;

    // Calculate total shots
    for (const scene of script) {
        totalShots += scene.shots.length;
    }
    console.log(`\nTotal Shots to Render: ${totalShots}`);

    for (const scene of script) {
        console.log(`\n=== SCENE ${scene.sceneIndex} ===`);
        for (const shot of scene.shots) {
            await renderShot(scene.sceneIndex, shot.index, shot.visual_prompt);
        }
    }

    console.log("All rendering tasks completed!");
}

main().catch(console.error);
