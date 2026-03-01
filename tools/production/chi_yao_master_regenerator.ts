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
 * Master Asset Regenerator (Chi Yao)
 * Solves inherent asymmetry by creating a new, perfect V6 sheet.
 */

async function regenerateMasterSheet() {
    console.log(`\n[Regenerator] Creating new symmetrical master tri-view for Chi Yao...`);
    const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

    // Emphasis on "Perfectly Symmetrical" and "Symmetric Front View"
    const prompt = "Perfectly symmetrical character turnaround reference sheet of Chi Yao, peerless beautiful Empress, white jade skin, golden royal gown, imperial phoenix embroidery, high golden crown. Three full body views: symmetrical front view, side profile, back view. 3D CGI guoman style, high fidelity, 8k resolution, neutral grey background, professional concept art.";

    try {
        const output = await replicate.run(
            "black-forest-labs/flux-1.1-pro",
            {
                input: {
                    prompt: prompt,
                    aspect_ratio: "16:9",
                    output_format: "png",
                    safety_tolerance: 2
                }
            }
        ) as any;

        const url = output;
        const finalPath = path.join(brainDir, 'chi_yao_new_master_sheet_v7.png');
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(finalPath, buffer);

        console.log(`[Success] New Master Sheet Generated: ${finalPath}`);

        // Extract front view for preview
        try {
            const frontView = await import('sharp').then(s => s.default(buffer)
                .extract({ left: 30, top: 0, width: 440, height: 768 }) // Estimated front view spot
                .toFile(path.join(brainDir, "chi_yao_v7_front_preview.png")));
        } catch (e) { /* ignore sharp error here */ }

    } catch (e) {
        console.error(`[Fatal] Sheet regeneration failed:`, e);
    }
}

regenerateMasterSheet().catch(console.error);
