const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Stub Renderer (Phase E) - V4 High-Fidelity Mock
 * Generates a preview MP4 with background image and audio stream.
 */

// Use generated background if exists
const MOCK_BG = 'ancient_chinese_mansion_bg_jpg_1769609041912.png';

function renderStub(planPath, rawOutputMp4, eviDir) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const episodeId = plan.episodeId;
  const runtimeDir = path.join(__dirname, '../../.runtime/previews', episodeId);
  fs.mkdirSync(runtimeDir, { recursive: true });

  // Solve Absolute Path for Output (since we switch CWD)
  const outputMp4 = path.resolve(rawOutputMp4);

  const concatFilePath = path.join(runtimeDir, 'concat_list.txt');
  const concatLines = [];

  console.log(`Starting Hi-Fi Stub Render for ${episodeId}...`);
  console.log(`Runtime Dir: ${runtimeDir}`);
  console.log(`Output Target: ${outputMp4}`);

  plan.renderShots.forEach((shot, idx) => {
    const shotFilename = `shot_${idx}.mp4`;
    const shotFile = path.join(runtimeDir, shotFilename);
    const durationSec = shot.durationFrames / 24;

    // SANITIZED Overlay Text (ASCII only)
    const overlayText = `SHOT: ${shot.shotId} | CHAR: ${shot.characterId} | TEMPLATE: ${shot.templateId}`;
    const safeText = overlayText
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/'/g, '')
      .replace(/:/g, '-');

    // FFmpeg Logic:
    // 1. Input: Color or Image?
    let inputSource = `-f lavfi -i color=c=black:s=1280x720:d=${durationSec}:r=24`;
    if (fs.existsSync(MOCK_BG)) {
      inputSource = `-loop 1 -i "${MOCK_BG}"`;
    }

    // 2. Filter: Scale background + DrawText
    const videoFilter = `scale=1280:720,drawtext=text='${safeText}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.7`;

    // 3. Audio: Add silent stream (anullsrc)
    const audioSource = `-f lavfi -i anullsrc=r=44100:cl=stereo`;

    const cmd =
      `ffmpeg -y ${inputSource} ${audioSource} ` +
      `-vf "${videoFilter}" ` +
      `-c:v libx264 -preset ultrafast -t ${durationSec} -pix_fmt yuv420p ` +
      `-c:a aac -shortest ` +
      `-flags +bitexact -fflags +bitexact "${shotFile}"`;

    try {
      execSync(cmd, { stdio: 'ignore' });
      concatLines.push(`file '${shotFilename}'`);
      if (idx % 20 === 0) console.log(`  Rendered shot ${idx}/${plan.renderShots.length}`);
    } catch (e) {
      console.error(`Error rendering shot ${shot.shotId}:`, e.message);
      process.exit(1);
    }
  });

  fs.writeFileSync(concatFilePath, concatLines.join('\n'));

  console.log('Stitching shots together (Switching CWD)...');
  // Concatenate shots (Video + Audio)
  const finalCmd = `ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy "${outputMp4}"`;

  try {
    execSync(finalCmd, {
      stdio: 'inherit',
      cwd: runtimeDir,
    });
    console.log(`✅ Stub Render Complete: ${outputMp4}`);
  } catch (e) {
    console.warn('⚠️ FFmpeg Concat Failed (Soft Fail):', e.message);
    console.warn('Skipping concatenation meta-audit. Individual shots are preserved in .runtime.');
    return;
  }

  // PLAN-3: Output Metadata Audit
  if (eviDir) {
    fs.mkdirSync(eviDir, { recursive: true });
    console.log('Generating ffprobe audit...');
    try {
      const probeCmd = `ffprobe -v error -show_format -show_streams -print_format json "${outputMp4}"`;
      const probeResult = execSync(probeCmd).toString();
      fs.writeFileSync(path.join(eviDir, 'preview_ffprobe.json'), probeResult);
      console.log('ffprobe audit saved.');
    } catch (e) {
      console.error('ffprobe audit failed (Stub):', e.message);
    }
  }
}

const inputPlan = process.argv[2];
const outputMp4 = process.argv[3];
const eviDir = process.argv[4];
if (inputPlan && outputMp4) {
  renderStub(inputPlan, outputMp4, eviDir);
} else {
  console.log('Usage: node stub_renderer.js <input.render_plan.json> <output.mp4> [evidence_dir]');
}
