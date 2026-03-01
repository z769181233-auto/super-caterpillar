import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

/**
 * God Face Regenerator (Chi Yao)
 * Fixed Path to absolute Artifacts directory.
 */

async function regenerateGodFace() {
    console.log(`\n[Regenerator] Creating perfect frontal face for Chi Yao...`);
    // Absolute Artifact Path from System Instructions
    const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";
    if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });

    const prompt = "Perfectly symmetrical close-up portrait of Chi Yao, peerless beautiful Empress, long black hair, shining golden crown, white jade skin, wearing imperial golden royal gown with phoenix embroidery, cold and majestic expression, looking straight at camera, high fidelity 3D CGI guoman style, masterpiece, 8k resolution, cinematic lighting.";

    try {
        const output = await replicate.run(
            "black-forest-labs/flux-1.1-pro",
            {
                input: {
                    prompt: prompt,
                    aspect_ratio: "1:1",
                    output_format: "png",
                    safety_tolerance: 2
                }
            }
        ) as any;

        const url = output;
        const finalPath = path.join(brainDir, 'chi_yao_new_god_face.png');
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(finalPath, buffer);

        console.log(`[Success] New God Face Generated: ${finalPath}`);
    } catch (e) {
        console.error(`[Fatal] Regeneration failed:`, e);
    }
}

regenerateGodFace().catch(console.error);
