import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function finalizeChiYaoAsset() {
    console.log(">>> Finalizing Chi Yao Asset with God-Face Inlay <<<");
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const newFacePath = path.join(brainDir, 'chi_yao_new_god_face.png');

    // 1. Prepare the new face (Resize 1024 to roughly 260px width to fit the sheet's head area)
    // The original face ROI was 220x220, but the head+neck area is larger.
    // Let's take the central 800x800 of the 1024 face and resize to 300x300.
    const faceHead = await sharp(newFacePath)
        .extract({ left: 112, top: 112, width: 800, height: 800 })
        .resize(280, 280)
        .png()
        .toBuffer();

    // 2. Composite onto the original sheet
    // Original face was at { left: 130, top: 40, width: 220, height: 220 }
    // We'll center the new 280 buffer around that.
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v6.3.png');

    await sharp(sheetPath)
        .composite([{ input: faceHead, top: 10, left: 100 }]) // Adjusting to cover head/neck area
        .png()
        .toFile(targetPath);

    // 3. Extract frontal torse for review
    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_final_locked_v6_3.png"));

    console.log(`[Success] New Asset Saved: ${targetPath}`);
}

finalizeChiYaoAsset().catch(console.error);
