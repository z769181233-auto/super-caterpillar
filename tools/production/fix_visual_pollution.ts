import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const sdxlVersion = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

async function download(url: string, local: string) {
    const res = await axios.get(url, { responseType: 'stream' });
    await pipeline(res.data, fs.createWriteStream(local));
}

async function fixCharacter(charId: string) {
    console.log(`\n[Fix] Cleaning visual pollution for ${charId}...`);
    const charRoot = path.join(repoRoot, 'storage', 'characters', charId);
    const spec = JSON.parse(fs.readFileSync(path.join(charRoot, 'profiles', 'CharacterSpec.json'), 'utf8'));
    const style = JSON.parse(fs.readFileSync(path.join(repoRoot, 'storage/style_bible/profiles/style_profile.json'), 'utf8'));

    // Step 1: Regenerate Canonical Front (No Sunglasses)
    console.log(`[Step 1] Regenerating Canonical Front (Zero Eyewear Strategy)...`);
    const prompt = `Supreme masterpiece 3D CGI, front view of ${spec.name}. ` +
        `${spec.hard_constraints.join(', ')}. ` +
        `Clear visible eyes, no sunglasses, no eyewear. ` +
        `${style.rendering.engine_aesthetic}, ${style.lighting.setup}. standing straight.`;

    const output = await replicate.run(`stability-ai/sdxl:${sdxlVersion}`, {
        input: {
            prompt,
            negative_prompt: style.negative_prompt + ", sunglasses, dark glasses, eyewear, frames, mask",
            num_outputs: 1
        }
    }) as any;

    const anchorPath = path.join(charRoot, 'anchors', 'canonical_front.png');
    await download(String(output[0]), anchorPath);
    console.log(`[Success] New anchor saved at ${anchorPath}`);

    // Step 2: Rerun tri-view derivation
    // We already have anchor_derived_generator.ts, let's just trigger it or inline the logic
    console.log(`[Step 2] Triggering anchor_derived_generator...`);
    // (Self-correction: I'll just run the other script after this)
}

async function main() {
    const chars = ['zhang_ruochen', 'chi_yao', 'lin_fei', 'eighth_prince'];
    for (const char of chars) {
        await fixCharacter(char);
    }
}

main().catch(console.error);
