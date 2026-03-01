import { execSync } from 'child_process';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function analyzeMotion(videoPath: string, label: string) {
    console.log(`\n[Motion-Probe] Analyzing: ${videoPath}`);

    const frame1 = path.join(brainDir, `${label}_f1.png`);
    const frameLast = path.join(brainDir, `${label}_flast.png`);

    // 1. Extract First and Last Frames
    try {
        execSync(`ffmpeg -y -i "${videoPath}" -frames:v 1 "${frame1}" 2>/dev/null`);
        execSync(`ffmpeg -y -sseof -1 -i "${videoPath}" -frames:v 1 "${frameLast}" 2>/dev/null`);
    } catch (e) {
        console.error("FFmpeg extraction failed", e);
        return;
    }

    // 2. Load and Compare
    const img1 = sharp(frame1);
    const meta = await img1.metadata();

    if (!meta.width || !meta.height) {
        console.error("Invalid image metadata");
        return;
    }

    const firstBuf = await img1.ensureAlpha().toBuffer();
    const lastBuf = await sharp(frameLast).resize(meta.width, meta.height).ensureAlpha().toBuffer();

    // 3. Simple Pixel Diff
    let diffSum = 0;
    const pixels = meta.width * meta.height;

    // Safety check buffer sizes
    const len = Math.min(firstBuf.length, lastBuf.length);
    for (let i = 0; i < len; i += 4) {
        diffSum += Math.abs(firstBuf[i] - lastBuf[i]);     // R
        diffSum += Math.abs(firstBuf[i + 1] - lastBuf[i + 1]); // G
        diffSum += Math.abs(firstBuf[i + 2] - lastBuf[i + 2]); // B
    }

    const avgDiff = diffSum / (pixels * 3);
    console.log(`[Result] Label: ${label}, Average Pixel Drift: ${avgDiff.toFixed(2)}`);

    // 4. Generate Diff Image (Visual proof)
    const diffMap = Buffer.alloc(pixels * 3);
    for (let i = 0, j = 0; i < pixels * 4 && j < pixels * 3; i += 4, j += 3) {
        diffMap[j] = Math.min(255, Math.abs(firstBuf[i] - lastBuf[i]) * 3); // Boost for visibility
        diffMap[j + 1] = Math.min(255, Math.abs(firstBuf[i + 1] - lastBuf[i + 1]) * 3);
        diffMap[j + 2] = Math.min(255, Math.abs(firstBuf[i + 2] - lastBuf[i + 2]) * 3);
    }

    await sharp(diffMap, { raw: { width: meta.width, height: meta.height, channels: 3 } })
        .png()
        .toFile(path.join(brainDir, `motion_diff_${label}.png`));

    return avgDiff;
}

const videoDir = "storage/videos/wangu_ep1_true_i2v";
const sampleVideo = path.join(process.cwd(), videoDir, "s01_shot01_final.mp4");

if (fs.existsSync(sampleVideo)) {
    analyzeMotion(sampleVideo, "s01_shot01").catch(console.error);
} else {
    console.error("Path not found: " + sampleVideo);
}
