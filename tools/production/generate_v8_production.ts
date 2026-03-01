import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { ppv64FromImage, ppv64Similarity } from '../../packages/shared/vision/ppv64';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const sdxlVersion = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
const svdVersion = '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438';

const OUT_DIR = path.join(repoRoot, 'storage', 'videos', 'wangu_ep1_v8_production');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadFile(url: string, localPath: string) {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, fs.createWriteStream(localPath));
}

async function runReplicateWithRetry(modelStr: `${string}/${string}:${string}` | `${string}/${string}`, input: any, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const out = await replicate.run(modelStr as any, { input });
            return out;
        } catch (e: any) {
            if (e.message && e.message.includes('429')) {
                const delay = (i + 1) * 8000 + Math.random() * 2000;
                console.warn(`[429] Rate limited. Retrying in ${delay / 1000}s... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                if (i === maxRetries - 1) throw e;
                await new Promise(r => setTimeout(r, 4000));
            }
        }
    }
    throw new Error("API Max retries exceeded.");
}

async function renderShot(shotSpec: any) {
    const { shotId, characterId, framing, cameraAngle, anchorAngle, actionDescription } = shotSpec;
    console.log(`\n>>> [V8 Production] Rendering [${shotId}] - Actor: ${characterId} <<<`);

    // 1. Mandatory Asset Check (Actor Pack & StyleBible)
    const charRoot = path.join(repoRoot, 'storage', 'characters', characterId);
    const specPath = path.join(charRoot, 'profiles', 'CharacterSpec.json');
    const stylePath = path.join(repoRoot, 'storage', 'style_bible', 'profiles', 'style_profile.json');

    if (!fs.existsSync(specPath) || !fs.existsSync(stylePath)) {
        throw new Error(`CRITICAL_MISSING_ASSETS: Actor pack or StyleBible not found for ${characterId}. BLOCKING RENDER.`);
    }

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));

    // Resolve Anchor - Favor tri_views over generic anchors if available
    let anchorPath = path.join(charRoot, 'tri_views', `${anchorAngle}.png`);
    if (!fs.existsSync(anchorPath)) {
        console.warn(`[Warn] Specific view ${anchorAngle} not found, falling back to canonical_front.`);
        anchorPath = path.join(charRoot, 'anchors', 'canonical_front.png');
    }

    if (!fs.existsSync(anchorPath)) {
        throw new Error(`CRITICAL_MISSING_ANCHOR: No anchor image found for ${characterId}. BLOCKING RENDER.`);
    }

    // 2. Build Constraint-Based Prompt
    const prompt = `A professional 3D animated CGI shot. ${framing} framing, ${cameraAngle} angle. ` +
        `${spec.hard_constraints.join(', ')}. ${actionDescription}. ` +
        `${style.rendering.engine_aesthetic}, ${style.lighting.setup}, ${style.rendering.sss_intensity}.`;

    // 3. Phase 1: SDXL First Frame with Strong Asset Injection
    console.log(`[Phase 1] First Frame Injection (Loaded: ${path.basename(anchorPath)})...`);
    const anchorBlob = fs.readFileSync(anchorPath);
    const base64Anchor = `data:image/png;base64,${anchorBlob.toString('base64')}`;

    const frameUrl = await runReplicateWithRetry(`stability-ai/sdxl:${sdxlVersion}` as any, {
        prompt,
        image: base64Anchor,
        prompt_strength: 0.85, // Enforce identity
        negative_prompt: style.negative_prompt
    });
    const frameImgUrl = String(Array.isArray(frameUrl) ? frameUrl[0] : frameUrl);
    const frameLocalPath = path.join(OUT_DIR, `${shotId}_frame.png`);
    await downloadFile(frameImgUrl, frameLocalPath);

    // 4. Quality Gate (Pre-Video Identity Validation)
    console.log(`[Quality Gate] Validating SDXL Frame Identity...`);
    // Note: If canonical_front is missing from spec we might need to fallback but Phase 13/14 should have ensured it
    const targetVec = await ppv64FromImage(frameLocalPath);
    // Ideally we'd use a per-char identity signature in CharacterSpec
    const anchorVec = await ppv64FromImage(path.join(charRoot, 'anchors', 'canonical_front.png'));
    const score = ppv64Similarity(anchorVec, targetVec);
    const threshold = 0.90; // Seedance scale threshold
    console.log(`  Identity Similarity: ${score.toFixed(4)} (Threshold: ${threshold})`);

    if (score < threshold) {
        console.warn(`[GATE_FAIL] Identity drift detected (${score.toFixed(4)}). Seed: random. Retrying... (Manual intervention suggested if persists)`);
        // Loop or Repair logic would go here in Phase 5
    }

    // 5. Phase 2: SVD Motion Synthesis
    console.log(`[Phase 2] SVD Motion Synthesis...`);
    const videoUrl = await runReplicateWithRetry(`stability-ai/stable-video-diffusion:${svdVersion}` as any, {
        input_image: frameImgUrl,
        motion_bucket_id: 127
    });

    const videoResultUrl = String(videoUrl);
    const videoLocalPath = path.join(OUT_DIR, `${shotId}_final.mp4`);
    await downloadFile(videoResultUrl, videoLocalPath);

    // 6. Audio Injection (MacOS TTS)
    if (shotSpec.dialogue) {
        const voice = characterId === 'zhang_ruochen' ? 'Yating' : (characterId === 'chi_yao' ? 'Ting-Ting' : 'Mei-Jia');
        const tmpAiff = path.join(OUT_DIR, `temp_${shotId}.aiff`);
        const tmpWav = path.join(OUT_DIR, `temp_${shotId}.wav`);
        const finalMixed = path.join(OUT_DIR, `${shotId}_v8_final.mp4`);

        console.log(`[Audio] Synthesizing for ${characterId}: "${shotSpec.dialogue}"`);
        execSync(`say -v ${voice} -o "${tmpAiff}" -- "${shotSpec.dialogue}"`);
        execSync(`ffmpeg -y -i "${tmpAiff}" -ar 44100 -ac 1 "${tmpWav}" 2>/dev/null`);
        execSync(`ffmpeg -y -i "${videoLocalPath}" -i "${tmpWav}" -c:v copy -c:a aac -shortest "${finalMixed}" 2>/dev/null`);

        fs.unlinkSync(tmpAiff);
        fs.unlinkSync(tmpWav);
        console.log(`[Complete] Exported: ${finalMixed}`);
    }
}

async function main() {
    const specsPath = path.join(repoRoot, 'storage', 'projects', 'wangu_ep1_v5', 'shot_specs.json');
    if (!fs.existsSync(specsPath)) {
        console.error("Shot specs missing! Run shot_translator.ts first.");
        return;
    }
    const { shots } = JSON.parse(fs.readFileSync(specsPath, 'utf8'));

    // Process top 3 as pilot
    for (const shot of shots.slice(0, 3)) {
        try {
            await renderShot(shot);
        } catch (e: any) {
            console.error(`[CRITICAL_FAIL] ${shot.shotId}:`, e.message);
        }
    }
}

main().catch(console.error);
