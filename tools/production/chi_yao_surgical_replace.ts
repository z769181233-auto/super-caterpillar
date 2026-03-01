import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function surgicalFaceReplace() {
    console.log(">>> Surgical Face Replacement: Finalizing V10 <<<");
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const perfectFacePath = path.join(brainDir, 'chi_yao_v10_final_perfection.png');

    // 1. Prepare candidate face from v10 (1024x1024)
    // Extract face core and resize to exactly 220x220
    const faceROI = await sharp(perfectFacePath)
        .extract({ left: 300, top: 120, width: 424, height: 424 })
        .resize(220, 220)
        .png()
        .toBuffer();

    // 2. Composite onto the original 220x220 ROI box
    // Original ROI location: left:130, top:40, width:220, height:220
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v10_final.png');

    await sharp(sheetPath)
        .composite([{ input: faceROI, top: 40, left: 130 }]) // Precise pixel swap
        .png()
        .toFile(targetPath);

    // 3. Extract final high-res preview for the user
    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_final_proof_v10.png"));

    console.log(`[Success] Surgical Repair Complete: ${targetPath}`);
}

surgicalFaceReplace().catch(console.error);
