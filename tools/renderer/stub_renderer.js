const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Stub Renderer (Phase E) - V2 Industrial Sealing
 * Generates a preview MP4 and its ffprobe metadata audit.
 */

function renderStub(planPath, outputMp4, eviDir) {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const episodeId = plan.episodeId;
    const runtimeDir = path.join(__dirname, '../../.runtime/previews', episodeId);
    fs.mkdirSync(runtimeDir, { recursive: true });

    const concatFilePath = path.join(runtimeDir, 'concat_list.txt');
    const concatLines = [];

    console.log(`Starting Stub Render for ${episodeId}...`);

    plan.renderShots.forEach((shot, idx) => {
        const shotFile = path.join(runtimeDir, `shot_${idx}.mp4`);
        const durationSec = shot.durationFrames / 24;

        const text = `ID: ${shot.shotId}\nTemplate: ${shot.templateId}\nChar: ${shot.characterId}\nLoc: ${shot.locationId}\nCombo: ${shot.comboKey}\nFrames: ${shot.durationFrames}`;
        const escapedText = text.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/\n/g, "\r");

        const cmd = `ffmpeg -y -f lavfi -i color=c=gray:s=1280x720:d=${durationSec}:r=24 ` +
            `-vf "drawtext=text='${escapedText}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5" ` +
            `-c:v libx264 -t ${durationSec} -pix_fmt yuv420p "${shotFile}"`;

        try {
            execSync(cmd, { stdio: 'ignore' });
            concatLines.push(`file '${shotFile}'`);
            if (idx % 20 === 0) console.log(`  Rendered shot ${idx}/${plan.renderShots.length}`);
        } catch (e) {
            console.error(`Error rendering shot ${shot.shotId}:`, e.message);
            process.exit(1);
        }
    });

    fs.writeFileSync(concatFilePath, concatLines.join('\n'));

    console.log("Stitching shots together...");
    const finalCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputMp4}"`;
    execSync(finalCmd, { stdio: 'ignore' });

    console.log(`✅ Stub Render Complete: ${outputMp4}`);

    // PLAN-3: Output Metadata Audit
    if (eviDir) {
        fs.mkdirSync(eviDir, { recursive: true });
        console.log("Generating ffprobe audit...");
        try {
            const probeCmd = `ffprobe -v error -show_format -show_streams -print_format json "${outputMp4}"`;
            const probeResult = execSync(probeCmd).toString();
            fs.writeFileSync(path.join(eviDir, 'preview_ffprobe.json'), probeResult);
            console.log("ffprobe audit saved.");
        } catch (e) {
            console.error("ffprobe audit failed:", e.message);
        }
    }
}

const inputPlan = process.argv[2];
const outputMp4 = process.argv[3];
const eviDir = process.argv[4];
if (inputPlan && outputMp4) {
    renderStub(inputPlan, outputMp4, eviDir);
} else {
    console.log("Usage: node stub_renderer.js <input.render_plan.json> <output.mp4> [evidence_dir]");
}
