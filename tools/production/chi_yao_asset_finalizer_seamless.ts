import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar";
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function finalizeChiYaoAssetSeamlessFixed() {
    console.log(">>> Finalizing Chi Yao Asset with SEAMLESS God-Face Inlay (Fixed Channels) <<<");
    const sheetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_sheet.png');
    const newFacePath = path.join(brainDir, 'chi_yao_new_god_face.png');

    // 1. Prepare New Face (Extract central face area)
    const faceBase = await sharp(newFacePath)
        .extract({ left: 212, top: 150, width: 600, height: 600 })
        .resize(220, 220)
        .png()
        .toBuffer();

    // 2. Create Alpha Mask for Feathering (Using 3 channels then converting to alpha)
    const alphaMask = await sharp({
        create: {
            width: 220,
            height: 220,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
        .composite([{
            input: Buffer.from('<svg><circle cx="110" cy="110" r="100" fill="white" filter="blur(15px)"/></svg>'),
            blend: 'over'
        }])
        .ensureAlpha()
        .extractChannel(0) // Extract R channel as alpha
        .png()
        .toBuffer();

    const featheredFace = await sharp(faceBase)
        .joinChannel(alphaMask)
        .png()
        .toBuffer();

    // 3. Composite onto the original sheet
    const targetPath = path.join(repoRoot, 'storage', 'characters', 'chi_yao', 'anchors', 'guoman_triview_repaired_v6.4.png');

    await sharp(sheetPath)
        .composite([{ input: featheredFace, top: 40, left: 130 }])
        .png()
        .toFile(targetPath);

    // 4. Extract frontal torso for review
    await sharp(targetPath)
        .extract({ left: 0, top: 0, width: 448, height: 768 })
        .toFile(path.join(brainDir, "chi_yao_final_sealed_v6_4.png"));

    console.log(`[Success] Seamless Asset Saved: ${targetPath}`);
}

finalizeChiYaoAssetSeamlessFixed().catch(console.error);
