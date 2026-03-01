import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { auditFace } from './face_auditor';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function huntForPerfection(maxAttempts: number) {
    console.log(`\n[HUNT] Starting high-precision hunt for Chi Yao's perfect face...`);

    // Better prompt focusing on pure symmetry and clean philtrum
    const prompt = "Hyper-realistic 8k close-up portrait of Chi Yao, peerless beautiful Empress, perfectly symmetrical face, perfectly aligned M-shaped lips, natural healthy skin color for the philtrum, no red markings under nose, white jade skin, cold majestic aura, high fidelity 3D CGI guoman style, cinematographic lighting, masterpiece.";
    const negative_prompt = "crooked mouth, asymmetrical lips, red smear under nose, red philtrum, distorted nose base, skin irritation, rash, low quality, double mouth, messy lipstick, skewed, tilted head.";

    for (let i = 1; i <= maxAttempts; i++) {
        console.log(`\n[Attempt ${i}/${maxAttempts}] Generating candidate...`);
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

            const candPath = path.join(brainDir, `hunt_cand_${i}.png`);
            const response = await fetch(output);
            const buffer = await response.buffer();
            fs.writeFileSync(candPath, buffer);

            // Audit the face (it's a 1:1 portrait, so face is mostly the whole image)
            const audit = await auditFace(candPath, { left: 200, top: 100, width: 624, height: 800 });
            console.log(`[Audit] Symmetry: ${audit.symmetryScore.toFixed(2)}, Philtrum Redness: ${audit.philtrumRedness.toFixed(2)}`);

            if (audit.passed || (audit.symmetryScore < 10 && audit.philtrumRedness < 2)) {
                console.log(`\n[SUCCESS] Candidate ${i} passes the perfection gate!`);
                fs.copyFileSync(candPath, path.join(brainDir, "chi_yao_v8_perfect_face.png"));
                return true;
            } else {
                console.log(`[Fail] Quality gate rejected candidate.`);
            }
        } catch (e) {
            console.error(`[Error] Attempt ${i} failed.`, e);
        }
    }
    return false;
}

huntForPerfection(5).catch(console.error);
