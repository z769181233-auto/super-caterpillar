import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function extractCandidatePreviews() {
    const candidates = [1, 2];
    for (const i of candidates) {
        const sheetPath = path.join(brainDir, `chi_yao_v7_candidate_${i}.png`);
        if (!fs.existsSync(sheetPath)) continue;

        // Extract Frontal Full Body (Middle panel roughly, as Flux 16:9 often puts front in middle or slightly left)
        // Let's take the middle slice
        await sharp(sheetPath)
            .extract({ left: 448, top: 0, width: 448, height: 768 })
            .toFile(path.join(brainDir, `chi_yao_v7_cand_${i}_front_full.png`));

        // Extract Face Close-up
        // Assuming face is around 448+130=578, top: 40
        await sharp(sheetPath)
            .extract({ left: 578, top: 40, width: 220, height: 220 })
            .resize(440) // Double for clear inspection
            .toFile(path.join(brainDir, `chi_yao_v7_cand_${i}_face_zoom.png`));
    }
}

extractCandidatePreviews().catch(console.error);
