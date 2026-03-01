import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

let apiKey = process.env.GEMINI_API_KEY || '';
if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
    apiKey = apiKey.slice(1, -1);
}

if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
}

function imageToBase64(filePath: string): string {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
}

async function verifyGuomanStyle(targetImgPath: string, refImgPaths: string[]) {
    console.log(`Verifying target image: ${path.basename(targetImgPath)}...`);
    console.log(`With references: ${refImgPaths.map(p => path.basename(p)).join(', ')}`);

    const targetB64 = imageToBase64(targetImgPath);
    const ref1B64 = imageToBase64(refImgPaths[0]);
    const ref2B64 = imageToBase64(refImgPaths[1]);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `You are the lead Art Director at a high-end 3D Guoman (Chinese Animation) studio like Xuanji or Woliv (e.g. perfect world, battle through the heavens, sword of coming). 
Your task is to review the output of an AI image generator ("Target Image") against standard frames from our actual 3D animation "Jian Lai" ("Reference Images").

Quality Requirements for PASS:
1. It MUST look like a true 3D CGI render, made in Unreal Engine or Octane (like the references).
2. The skin must look like high-end "subsurface scattering" jade-like texture, NOT a flat 2D anime drawing or a realistic Western photo.
3. The lighting must feel volumetric and cinematic.
4. The clothing must feel heavy, textured, and 3D with depth.

If the "Target Image" looks like a cheap 2D sketch, flat anime, typical generic AI 2.5D illustration, or western fantasy art, you must explicitly FAIL it.

Please provide:
1. Detailed Critique (compare lighting, skin, and overall aesthetic against references)
2. Conclusion: "Verdict: PASS" or "Verdict: FAIL"
`
                    },
                    {
                        text: "[Reference Image 1: Jian Lai 3D Donghua Frame]"
                    },
                    {
                        inline_data: { mime_type: "image/png", data: ref1B64 }
                    },
                    {
                        text: "[Reference Image 2: Jian Lai 3D Donghua Frame]"
                    },
                    {
                        inline_data: { mime_type: "image/png", data: ref2B64 }
                    },
                    {
                        text: "[Target Image: AI Generated Zhang Ruochen Turnaround]"
                    },
                    {
                        inline_data: { mime_type: "image/png", data: targetB64 }
                    }
                ]
            }
        ]
    };

    let response;
    let data;
    for (let i = 0; i < 5; i++) {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.warn(`[429] Rate limited by Gemini API. Retrying in 61s... (${i + 1}/5)`);
                await new Promise(r => setTimeout(r, 61000));
                continue;
            }
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${err}`);
        }

        data = await response.json();
        break;
    }

    if (!data) {
        throw new Error("Failed to get validation after retries.");
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text';
}

async function main() {
    const targetPath = path.join(repoRoot, 'storage/characters/zhang_ruochen/anchors/guoman_triview_sheet.png');
    const ref1 = path.join(repoRoot, 'docs/_specs/jianlai/ref_1.png');
    const ref2 = path.join(repoRoot, 'docs/_specs/jianlai/ref_2.png');

    try {
        const critique = await verifyGuomanStyle(targetPath, [ref1, ref2]);
        console.log("\n=== GEMINI 2.0 VISION CRITIQUE ===");
        console.log(critique);
        console.log("==================================\n");

        if (critique.includes('Verdict: FAIL')) {
            console.error("[GATE FAILED] The generated image does NOT meet the 3D Guoman standard.");
            process.exit(1);
        } else {
            console.log("[GATE PASSED] The generated image successfully matches the 3D Guoman visual standard.");
            process.exit(0);
        }
    } catch (e: any) {
        console.error("Verification failed:", e.message);
        process.exit(1);
    }
}

main();
