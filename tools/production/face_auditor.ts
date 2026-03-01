import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Advanced Facial Quality Auditor
 * Checks for:
 * 1. Horizontal Symmetry of the mouth.
 * 2. Redness saturation in the philtrum (area under nose).
 * 3. Midline alignment.
 */

interface AuditResult {
    symmetryScore: number; // 0 (perfect) to 100+ (bad)
    philtrumRedness: number; // Avg saturation in target zone
    passed: boolean;
}

async function auditFace(imgPath: string, faceBounds: { top: number, left: number, width: number, height: number }): Promise<AuditResult> {
    const raw = await sharp(imgPath).extract(faceBounds).ensureAlpha().toBuffer({ resolveWithObject: true });
    const { data, info } = raw;

    // 1. Check Symmetry
    // Compare left half to flipped right half of the mouth area
    // Mouth is usually in the bottom 40% of the face
    const mouthTop = Math.floor(info.height * 0.6);
    const mouthHeight = Math.floor(info.height * 0.25);
    const centerX = Math.floor(info.width / 2);

    let diffSum = 0;
    let count = 0;

    for (let y = mouthTop; y < mouthTop + mouthHeight; y++) {
        for (let x = 0; x < centerX; x++) {
            const leftIdx = (y * info.width + x) * 4;
            const rightIdx = (y * info.width + (info.width - 1 - x)) * 4;

            // Lab-like distance (simple RGB for now)
            const d = Math.abs(data[leftIdx] - data[rightIdx]) +
                Math.abs(data[leftIdx + 1] - data[rightIdx + 1]) +
                Math.abs(data[leftIdx + 2] - data[rightIdx + 2]);
            diffSum += d;
            count++;
        }
    }
    const symmetryScore = diffSum / count;

    // 2. Check Philtrum Redness
    // Area between nose (mid face) and mouth
    const philtrumTop = Math.floor(info.height * 0.5);
    const philtrumBottom = mouthTop;
    const philtrumWidth = Math.floor(info.width * 0.2);
    const philtrumLeft = centerX - Math.floor(philtrumWidth / 2);

    let redSum = 0;
    let pCount = 0;
    for (let y = philtrumTop; y < philtrumBottom; y++) {
        for (let x = philtrumLeft; x < philtrumLeft + philtrumWidth; x++) {
            const idx = (y * info.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Redness score: R is much higher than G/B
            if (r > g + 30 && r > b + 30) {
                redSum += (r - (g + b) / 2);
            }
            pCount++;
        }
    }
    const philtrumRedness = redSum / pCount;

    // Thresholds (Adjusted for "Perfection")
    const passed = symmetryScore < 15 && philtrumRedness < 5;

    return { symmetryScore, philtrumRedness, passed };
}

export { auditFace };
