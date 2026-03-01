import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function finalizeChiYaoAssetPrecision() {
    console.log(">>> Finalizing Chi Yao Asset with PRECISION God-Face Inlay <<<");
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const newFacePath = path.join(brainDir, 'chi_yao_new_god_face.png');

    // 1. Prepare Fixed-Scale New Face (Shrink to 200px to match head size)
    const faceBase = await sharp(newFacePath)
        .extract({ left: 212, top: 150, width: 600, height: 600 })
        .resize(200, 200)
        .png()
        .toBuffer();

    // 2. Strong Radial Alpha Mask
    const alphaMask = await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([{
            input: Buffer.from('<svg><circle cx="100" cy="100" r="85" fill="white" filter="blur(18px)"/></svg>'),
            blend: 'over'
        }])
        .ensureAlpha()
        .extractChannel(0)
        .png()
        .toBuffer();

    const featheredFace = await sharp(faceBase)
        .joinChannel(alphaMask)
        .png()
        .toBuffer();

    // 3. Composite with Offset (Shifted to align mouth and eyes)
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v6.5.png');

    // Shift slightly to the RIGHT (130 -> 150) and DOWN (40 -> 60)
    await sharp(sheetPath)
        .composite([{ input: featheredFace, top: 60, left: 145 }])
        .png()
        .toFile(targetPath);

    // 4. Extract frontal torso for review
    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_final_sealed_v6_5.png"));

    console.log(`[Success] Precision Asset Saved: ${targetPath}`);
}

finalizeChiYaoAssetPrecision().catch(console.error);
