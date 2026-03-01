import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { ppv64FromImage, ppv64Similarity } from '../../packages/shared/vision/ppv64';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const fluxVersion = 'black-forest-labs/flux-1.1-pro'; // or sdxl with ref

async function download(url: string, local: string) {
    const res = await axios.get(url, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(local));
}

async function generateDerivedView(charId: string, viewName: 'side' | 'back', characterSpec: any, styleBible: any) {
    const CHAR_ROOT = path.join(repoRoot, 'storage', 'characters', charId);
    const ANCHOR_FRONT = path.join(CHAR_ROOT, 'anchors', 'canonical_front.png');
    const TRI_VIEW_DIR = path.join(CHAR_ROOT, 'tri_views');
    if (!fs.existsSync(TRI_VIEW_DIR)) fs.mkdirSync(TRI_VIEW_DIR, { recursive: true });

    console.log(`\n[Phase 3] Generating ${viewName} view for ${charId}...`);

    const anchorBlob = fs.readFileSync(ANCHOR_FRONT);
    const base64Anchor = `data:image/png;base64,${anchorBlob.toString('base64')}`;

    // Prompt construction logic: Anchor + View + Style
    const prompt = `3D CGI turnaround sheet, ${viewName} view of the same character. ` +
        `${characterSpec.hard_constraints.join(', ')}. ` +
        `${styleBible.rendering.engine_aesthetic}, ${styleBible.lighting.setup}. ` +
        `Standing straight in A-pose. High fidelity, masterpiece.`;

    // Strategy: Img2Img or Reference-heavy generation to lock identity
    // Using Flux or SDXL with high prompt strength
    const output = await replicate.run("stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", {
        input: {
            prompt,
            image: base64Anchor,
            prompt_strength: 0.75, // Enough to change pose but keep face/outfit essence
            negative_prompt: styleBible.negative_prompt
        }
    }) as any;

    const imgUrl = String(Array.isArray(output) ? output[0] : output);
    const localPath = path.join(TRI_VIEW_DIR, `${viewName}.png`);
    await download(imgUrl, localPath);

    // Identity Gate
    console.log(`[Gate] Validating ${viewName} view identity...`);
    const anchorVec = characterSpec.identity?.embedding_v1 || await ppv64FromImage(ANCHOR_FRONT);
    const derivedVec = await ppv64FromImage(localPath);
    const score = ppv64Similarity(anchorVec, derivedVec);

    const result = {
        view: viewName,
        score,
        pass: score > 0.88,
        timestamp: new Date().toISOString()
    };

    console.log(`  Similarity Score: ${score.toFixed(4)} - ${result.pass ? 'PASS' : 'FAIL'}`);
    return result;
}

async function processCharacter(charId: string) {
    const charRoot = path.join(repoRoot, 'storage', 'characters', charId);
    const spec = JSON.parse(fs.readFileSync(path.join(charRoot, 'profiles', 'CharacterSpec.json'), 'utf8'));
    const style = JSON.parse(fs.readFileSync(path.join(repoRoot, 'storage/style_bible/profiles/style_profile.json'), 'utf8'));

    const results = [];
    results.push(await generateDerivedView(charId, 'side', spec, style));
    results.push(await generateDerivedView(charId, 'back', spec, style));

    const gatePath = path.join(charRoot, 'evidence', 'tri_view_gate.json');
    fs.mkdirSync(path.dirname(gatePath), { recursive: true });
    fs.writeFileSync(gatePath, JSON.stringify(results, null, 4));
    console.log(`\n[Success] Tri-view evidence recorded at ${gatePath}`);
}

async function main() {
    const chars = ['zhang_ruochen', 'chi_yao', 'lin_fei', 'eighth_prince'];
    for (const char of chars) {
        await processCharacter(char);
    }
}

main().catch(console.error);
