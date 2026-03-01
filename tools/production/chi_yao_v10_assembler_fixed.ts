import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function assembleV10MasterSheetFixed() {
    console.log(">>> Assembling Chi Yao Master Sheet V10 (Precision Fix) <<<");
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const perfectFacePath = path.join(brainDir, 'chi_yao_v10_final_perfection.png');

    // 1. Prepare Perfect Face (Precise cropping from the 1024x1024 generated portrait)
    // The face is central. Let's take the core features.
    const faceBase = await sharp(perfectFacePath)
        .extract({ left: 362, top: 160, width: 300, height: 300 }) // Core face area
        .resize(110, 110) // Scale down to fit the turnaround sheet head
        .png()
        .toBuffer();

    const mask = await sharp({
        create: { width: 110, height: 110, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{
            input: Buffer.from('<svg><circle cx="55" cy="55" r="48" fill="white" filter="blur(8px)"/></svg>'),
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
    // The frontal view face box in guoman_triview_sheet.png is roughly left:130, top:40, width:220
    // Center it in that box. 130 + (220-110)/2 = 130 + 55 = 185. Top: 40 + (220-110)/2 = 95.
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v10_fixed.png');

    await sharp(sheetPath)
        .composite([{ input: featheredFace, top: 95, left: 185 }])
        .png()
        .toFile(targetPath);

    // 3. Extract final review preview
    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_v10_final_locked.png"));

    console.log(`[Success] Final V10 Master Sheet (Fixed) Saved: ${targetPath}`);
}

assembleV10MasterSheetFixed().catch(console.error);
