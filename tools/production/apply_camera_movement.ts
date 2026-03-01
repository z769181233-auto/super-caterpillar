import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const repoRoot = process.cwd();
const brainDir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2";

async function applyZoom(inputPath: string, outLabel: string) {
    const outputPath = path.join(brainDir, `${outLabel}_zoomed.mp4`);
    console.log(`\n[Camera-Movement] Applying Zoom to: ${inputPath}`);

    // FFmpeg Ken Burns: Zoom from 1.0 to 1.1 over the duration
    // zoompan filter: z='min(zoom+0.001,1.1)'
    // Note: zoompan is often tricky with aspect ratios and flickering.
    // A simpler way for a clean zoom:
    const filter = "scale=1280:720,zoompan=z='zoom+0.001':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=125:s=1280x720";

    try {
        // d=125 means 125 frames (approx 5s at 25fps). We should match the input duration if possible.
        // For simplicity in this probe fix, we use a fixed filter.
        execSync(`ffmpeg -y -i "${inputPath}" -vf "${filter}" -c:v libx264 -pix_fmt yuv420p "${outputPath}" 2>/dev/null`);
        console.log(`[Success] Zoomed video saved to: ${outputPath}`);
    } catch (e) {
        console.error("FFmpeg Zoom failed", e);
    }
}

const videoDir = "storage/videos/wangu_ep1_true_i2v";
const sampleVideo = path.join(repoRoot, videoDir, "s01_shot01_final.mp4");

if (fs.existsSync(sampleVideo)) {
    applyZoom(sampleVideo, "s01_shot01").catch(console.error);
} else {
    console.error("Path not found: " + sampleVideo);
}
