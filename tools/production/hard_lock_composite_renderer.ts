import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, '.env') });

/**
 * Hard-Lock Renderer V5.2
 * Explicit buffer formatting for sharp.
 */

const CORE_CHARACTERS = ["zhang_ruochen", "chi_yao", "lin_fei", "eighth_prince"];

async function createInpaintMask(outPath: string, roiWidth: number, roiHeight: number, targetTop: number, targetLeft: number) {
    const faceShield = await sharp({
        create: { width: roiWidth, height: roiHeight, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer(); // Explicitly set format to PNG

    await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
        .composite([{ input: faceShield, top: targetTop, left: targetLeft }])
        .png()
        .toFile(outPath);
}

async function executeHardLockComposite(charId: string, shotId: string) {
    console.log(`\n>>> [Phase 7] Hard-Lock & Mask Generation for ${charId} <<<`);

    const charRoot = path.join(repoRoot, 'storage', 'characters', charId);
    const sheetPath = path.join(charRoot, 'anchors', 'guoman_triview_sheet.png');

    if (!fs.existsSync(sheetPath)) {
        console.warn(`[Skip] Core asset missing for ${charId}: ${sheetPath}`);
        return;
    }

    const outDir = path.join(repoRoot, 'storage', 'videos', `hardlock_${shotId}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const faceROI = { left: 130, top: 40, width: 220, height: 220 };
    const targetTop = 180;
    const targetLeft = 352;

    const faceBuffer = await sharp(sheetPath)
        .extract(faceROI)
        .resize(320, 320)
        .png() // Explicitly set format
        .toBuffer();

    const platePath = path.join(outDir, `${charId}_plate.png`);
    await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: 35, g: 35, b: 40 } }
    }).png().toFile(platePath);

    const compositePath = path.join(outDir, `${charId}_v6_locked.png`);
    await sharp(platePath)
        .composite([{ input: faceBuffer, top: targetTop, left: targetLeft }])
        .png()
        .toFile(compositePath);

    const maskPath = path.join(outDir, `${charId}_inpaint_mask.png`);
    await createInpaintMask(maskPath, 320, 320, targetTop, targetLeft);

    console.log(`[Success] ${charId} Composite and Mask generated.`);
}

async function runGlobalPilot() {
    for (const charId of CORE_CHARACTERS) {
        await executeHardLockComposite(charId, "global_alignment_pilot");
    }
}

runGlobalPilot().catch(console.error);
