import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

let apiToken = process.env.REPLICATE_API_TOKEN || '';
if (apiToken.startsWith('"') && apiToken.endsWith('"')) {
    apiToken = apiToken.slice(1, -1);
}

if (!apiToken) {
    console.error("Missing REPLICATE_API_TOKEN");
    process.exit(1);
}

const replicate = new Replicate({
    auth: apiToken,
});

async function downloadFile(url: string, destPath: string) {
    const writer = fs.createWriteStream(destPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
    });
}

async function renderCharacterTurnaround(characterId: string) {
    const charDir = path.join(repoRoot, `storage/characters/${characterId}`);
    const anchorsDir = path.join(charDir, 'anchors');
    const profilesDir = path.join(charDir, 'profiles');

    fs.mkdirSync(anchorsDir, { recursive: true });

    const specPath = path.join(profilesDir, 'CharacterSpec.json');
    if (!fs.existsSync(specPath)) {
        console.warn(`[Skip] CharacterSpec.json not found for ${characterId}`);
        return;
    }

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

    const prompt = `Professional 3D character design turnaround concept art sheet. Wide canvas showing the EXACT SAME high-definition character THREE TIMES side-by-side: Front view, Side profile view, and Back view. THREE DISTINCT SEPARATE FULL-BODY FIGURES, NO OVERLAPPING, standing straight in A-pose with perfect anatomical proportions and perfect symmetrical facial features. Ultra HD 8k masterpiece. Plain neutral mid-grey background, clean spacing between each figure. ${spec.canonical_prompt}`;

    console.log(`\n=== Generating Turnaround for: ${spec.name} ===`);
    console.log(`Prompt preview: ${prompt.substring(0, 150)}...`);

    const maxRetries = 10;
    let imageUrl = "";

    for (let i = 0; i < maxRetries; i++) {
        try {
            const outImg = await replicate.run("black-forest-labs/flux-1.1-pro", {
                input: {
                    prompt: prompt,
                    aspect_ratio: "16:9", // Reverted to valid 16:9, relying on strong prompt constraints to prevent fusion
                    output_format: "png",
                    output_quality: 100,
                    prompt_upsampling: false
                }
            });
            imageUrl = Array.isArray(outImg) ? String(outImg[0]) : String(outImg);
            break;
        } catch (e: any) {
            if (e.message && e.message.includes('429')) {
                const delay = Math.pow(2, i) * 6000 + Math.random() * 2000;
                console.warn(`[429] Rate limited. Retrying in ${Math.round(delay / 1000)}s... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }

    if (!imageUrl) {
        throw new Error(`Failed to generate Character Sheet for ${spec.name} after retries.`);
    }

    const localImgPath = path.join(anchorsDir, 'guoman_triview_sheet.png');
    await downloadFile(imageUrl, localImgPath);
    console.log(`[SUCCESS] Saved Guoman Turnaround Sheet to ${localImgPath}`);

    // Safety delay between successful generations to respect free tier
    console.log("Cooling down for 10s...");
    await new Promise(r => setTimeout(r, 10000));
}

async function main() {
    console.log("Starting EP1 Core Characters Batch Tri-View Generation (Flux 1.1 Pro)");

    // We already regenerated zhang_ruochen, but we will redo it with the ultimate refined prompt if the user requests it.
    // The user requested "这一次的可以服饰在精细化，然后在生成第一集所需要的核心人物"
    // Generating true high-definition 21:9 turnaround sheets for all characters with the new anti-distortion prompt architecture.
    const characters = ['zhang_ruochen', 'chi_yao', 'lin_fei', 'eighth_prince'];

    for (const charId of characters) {
        try {
            await renderCharacterTurnaround(charId);
        } catch (e: any) {
            console.error(`[FATAL ERROR] generation failed for ${charId}: ${e.message}`);
        }
    }

    console.log("\n=== ALL CORE CHARACTER SHEETS GENERATED ===");
}

main();
