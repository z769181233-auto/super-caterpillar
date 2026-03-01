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

async function main() {
    const characterId = 'zhang_ruochen';
    const charDir = path.join(repoRoot, `storage/characters/${characterId}`);
    const anchorsDir = path.join(charDir, 'anchors');
    const profilesDir = path.join(charDir, 'profiles');

    fs.mkdirSync(anchorsDir, { recursive: true });

    const specPath = path.join(profilesDir, 'CharacterSpec.json');
    if (!fs.existsSync(specPath)) {
        console.error("CharacterSpec.json not found!");
        return;
    }

    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

    // 結合人物 DNA 與三視圖的結構約束
    const prompt = `Standard 3D character design turnaround reference sheet. Wide canvas showing the exact same character three times side-by-side: Front view, Side profile view, and Back view. Full body standing straight in A-pose. Plain neutral mid-grey background, clean layout. ${spec.canonical_prompt}`;

    console.log("Generating Professional Guoman Tri-View Sheet...");
    console.log(`Prompt: ${prompt}\n`);

    const maxRetries = 10;

    let imageUrl = "";

    for (let i = 0; i < maxRetries; i++) {
        try {
            const outImg = await replicate.run("black-forest-labs/flux-1.1-pro", {
                input: {
                    prompt: prompt,
                    aspect_ratio: "16:9", // Wide for Turnaround sheet
                    output_format: "png",
                    output_quality: 100,
                    prompt_upsampling: false
                }
            });
            imageUrl = Array.isArray(outImg) ? String(outImg[0]) : String(outImg);
            break;
        } catch (e: any) {
            if (e.message && e.message.includes('429')) {
                const delay = Math.pow(2, i) * 5000 + Math.random() * 2000;
                console.warn(`[429] Rate limited. Retrying in ${Math.round(delay / 1000)}s... (${i + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }

    if (!imageUrl) {
        throw new Error("Failed to generate Character Sheet after retries.");
    }

    const localImgPath = path.join(anchorsDir, 'guoman_triview_sheet.png');
    await downloadFile(imageUrl, localImgPath);
    console.log(`\n[SUCCESS] Saved Guoman Turnaround Sheet to ${localImgPath}`);
}

main();
