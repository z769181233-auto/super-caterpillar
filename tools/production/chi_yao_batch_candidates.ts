import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

async function batchRegenerate(count: number) {
    console.log(`\n[Batch] Generating ${count} candidates for Chi Yao V7...`);
    const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

    for (let i = 1; i <= count; i++) {
        const prompt = `(Candidate ${i}) Perfectly symmetrical character turnaround reference sheet of Chi Yao, peerless beautiful Empress, white jade skin, golden royal gown, imperial phoenix embroidery, high golden crown. Three full body views: symmetrical front view, side profile, back view. 3D CGI guoman style, high fidelity, 8k resolution, neutral grey background, professional concept art. CRITICAL: perfectly symmetrical M-shaped lips, aligned mouth, no smearing under nose.`;

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

            const finalPath = path.join(brainDir, `chi_yao_v7_candidate_${i}.png`);
            const response = await fetch(output);
            const buffer = await response.buffer();
            fs.writeFileSync(finalPath, buffer);
            console.log(`[Success] Candidate ${i} saved.`);
        } catch (e) {
            console.error(`[Error] Candidate ${i} failed.`, e);
        }
    }
}

batchRegenerate(3).catch(console.error);
