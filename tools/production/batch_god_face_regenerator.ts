import Replicate from 'replicate';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

const CHARACTERS = [
    {
        id: "zhang_ruochen",
        prompt: "Perfectly symmetrical close-up portrait of Zhang Ruochen, peerless handsome young man, long silver hair, cold and determined expression, wearing silver silk Hanfu with cloud patterns, cinematic lighting, 3D CGI guoman style, masterpiece, 8k resolution."
    },
    {
        id: "lin_fei",
        prompt: "Perfectly symmetrical close-up portrait of Lin Fei, gentle and beautiful middle-aged woman, simple but elegant light blue Hanfu, soft facial features, sorrowful but loving expression, plain silver hairpin, cinematic lighting, 3D CGI guoman style, masterpiece, 8k resolution."
    },
    {
        id: "eighth_prince",
        prompt: "Perfectly symmetrical close-up portrait of Eighth Prince Zhang Ji, arrogant and sharp young prince, dark imperial robes with metallic ancient bronze embroidery, villainous bishounen face, sinister smirk, cinematic lighting, 3D CGI guoman style, masterpiece, 8k resolution."
    }
];

async function generateBatch() {
    console.log(`\n[Batch-Regenerator] Creating perfect frontal faces for Episode 1 Cast...`);

    for (const char of CHARACTERS) {
        console.log(`\n>>> Generating: ${char.id}`);
        try {
            const output = await replicate.run(
                "black-forest-labs/flux-1.1-pro",
                {
                    input: {
                        prompt: char.prompt,
                        aspect_ratio: "1:1",
                        output_format: "png",
                        safety_tolerance: 2
                    }
                }
            ) as any;

            const url = output;
            const finalPath = path.join(brainDir, `${char.id}_god_face_raw.png`);
            const response = await fetch(url);
            const buffer = await response.buffer();
            fs.writeFileSync(finalPath, buffer);

            console.log(`[Success] Generated: ${finalPath}`);
        } catch (e) {
            console.error(`[Error] Failed for ${char.id}:`, e);
        }
    }
}

generateBatch().catch(console.error);
