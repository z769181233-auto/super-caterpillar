import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function assembleV10MasterSheet() {
    console.log(">>> Assembling Chi Yao Master Sheet V10 <<<");
    // Use the original high-quality sheet as the base for clothing
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const perfectFacePath = path.join(brainDir, 'chi_yao_v10_final_perfection.png');

    // 1. Prepare Perfect Face (Crop and feathered edge)
    const faceBase = await sharp(perfectFacePath)
        .extract({ left: 300, top: 180, width: 440, height: 440 }) // Face core
        .resize(210, 210) // Precise fit for sheet head
        .png()
        .toBuffer();

    const mask = await sharp({
        create: { width: 210, height: 210, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{
            input: Buffer.from('<svg><circle cx="105" cy="105" r="95" fill="white" filter="blur(15px)"/></svg>'),
            blend: 'over'
        }])
        .ensureAlpha()
        .extractChannel(0)
        .png()
        .toBuffer();

    const featheredFace = await sharp(faceBase)
        .joinChannel(mask)
        .png()
        .toBuffer();

    // 2. Composite onto original sheet
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v10.png');

    await sharp(sheetPath)
        .composite([{ input: featheredFace, top: 45, left: 135 }]) // Adjusted for V10 scale
        .png()
        .toFile(targetPath);

    // 3. Extract audit preview
    await sharp(targetPath)
        .extract({ left: 130, top: 40, width: 220, height: 220 })
        .resize(600)
        .toFile(path.join(brainDir, "chi_yao_v10_audit_zoom.png"));

    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_v10_frontal_full.png"));

    console.log(`[Success] Final V10 Master Sheet Saved: ${targetPath}`);
}

assembleV10MasterSheet().catch(console.error);
