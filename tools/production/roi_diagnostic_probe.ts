import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";
const chars = ["zhang_ruochen", "chi_yao", "lin_fei", "eighth_prince"];

async function verifyAssets() {
    console.log(">>> Starting Global Asset ROI Verification (Fixed Paths) <<<");
    if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });

    for (const charId of chars) {
        const sheetPath = path.join(repoRoot, 'storage', 'characters', charId, 'anchors', 'guoman_triview_sheet.png');
        if (!fs.existsSync(sheetPath)) {
            console.error(`[Error] Missing asset for ${charId}`);
            continue;
        }

        try {
            // 1. Crop the Frontal View (Left third: 0, 0, 448, 768)
            await sharp(sheetPath)
                .extract({ left: 0, top: 0, width: 448, height: 768 })
                .resize(448, 768) // Keep full size for detailed inspection
                .png()
                .toFile(path.join(brainDir, `${charId}_front_torso_full.png`));

            // 2. Crop the Current Face Mask Area used in prod (130, 40, 220, 220)
            await sharp(sheetPath)
                .extract({ left: 130, top: 40, width: 220, height: 220 })
                .png()
                .toFile(path.join(brainDir, `${charId}_face_check_v5.png`));

            console.log(`[Success] ${charId} ROIs extracted to brain.`);
        } catch (err: any) {
            console.error(`[Fail] ${charId} extraction error: ${err.message}`);
        }
    }
}

verifyAssets().catch(console.error);
