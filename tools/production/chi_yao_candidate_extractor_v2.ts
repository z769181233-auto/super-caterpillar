import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function extractPrecisePreviews() {
    const candidates = [1, 2];
    for (const i of candidates) {
        const sheetPath = path.join(brainDir, `chi_yao_v7_candidate_${i}.png`);
        if (!fs.existsSync(sheetPath)) continue;

        const metadata = await sharp(sheetPath).metadata();
        const width = metadata.width || 1344;
        const panelWidth = Math.floor(width / 3);

        // Extract Front View (Left Panel)
        await sharp(sheetPath)
            .extract({ left: 0, top: 0, width: panelWidth, height: 768 })
            .toFile(path.join(brainDir, `chi_yao_v7_cand_${i}_frontal_full.png`));

        // Let's also extract a wide Face zoom (center of the left panel)
        await sharp(sheetPath)
            .extract({ left: Math.floor(panelWidth * 0.25), top: 20, width: 250, height: 250 })
            .resize(500)
            .toFile(path.join(brainDir, `chi_yao_v7_cand_${i}_face_zoom_v2.png`));
    }
}

extractPrecisePreviews().catch(console.error);
