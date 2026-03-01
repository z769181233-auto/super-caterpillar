const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function getImagePixels(imagePath) {
  const probe = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 "${imagePath}"`
  )
    .toString()
    .trim()
    .split('\n');
  const width = parseInt(probe[0]);
  const height = parseInt(probe[1]);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      imagePath,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ]);
    let buffer = Buffer.alloc(0);
    ffmpeg.stdout.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
    });
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg failed: ${code}`));
      resolve({ width, height, data: new Uint8Array(buffer) });
    });
  });
}

/**
 * Compares two images using absolute difference.
 */
function comparePixels(p1, p2) {
  if (p1.width !== p2.width || p1.height !== p2.height) {
    throw new Error(`Dimension mismatch: ${p1.width}x${p1.height} vs ${p2.width}x${p2.height}`);
  }
  const d1 = p1.data;
  const d2 = p2.data;
  let sumDiff = 0;
  let maxDiff = 0;
  const diffData = new Uint8Array(d1.length);

  for (let i = 0; i < d1.length; i++) {
    const diff = Math.abs(d1[i] - d2[i]);
    sumDiff += diff;
    if (diff > maxDiff) maxDiff = diff;
    diffData[i] = diff;
  }

  const meanDiff = sumDiff / d1.length;
  return { meanDiff, maxDiff, diffData };
}

async function trace(epDir, videoPath) {
  const preDir = path.join(epDir, 'pre_encode_frames');
  const mp4Dir = path.join(epDir, 'mp4_frames');
  if (!fs.existsSync(mp4Dir)) fs.mkdirSync(mp4Dir, { recursive: true });

  const preFiles = fs.readdirSync(preDir).filter((f) => f.endsWith('.png'));
  const results = [];

  // Timestamps corresponding to f0, f1, f2 in unreal_executor.js
  // [0.5, durationSec / 2, durationSec - 0.5]
  const duration = parseFloat(
    execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    )
      .toString()
      .trim()
  );
  const sampleTs = [0.5, duration / 2, duration - 0.5].map((t) =>
    Math.max(0, Math.min(duration, t))
  );

  for (let i = 0; i < preFiles.length; i++) {
    const preFile = preFiles[i];
    const shotId = preFile.split('_f')[0];
    const idx = parseInt(preFile.split('_f')[1]);

    const mp4Png = path.join(mp4Dir, `${shotId}_f${idx}_mp4.png`);
    execSync(
      `ffmpeg -y -ss ${sampleTs[idx]} -i "${videoPath}" -vframes 1 "${mp4Png}" -loglevel error`
    );

    log(`Comparing ${preFile} vs ${path.basename(mp4Png)}...`);
    const pPre = await getImagePixels(path.join(preDir, preFile));
    const pMp4 = await getImagePixels(mp4Png);

    const diffResults = comparePixels(pPre, pMp4);

    // Save diff image for manual audit
    const diffPng = path.join(epDir, `diff_${shotId}_f${idx}.png`);
    const ffmpegDiff = spawn('ffmpeg', [
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${pPre.width}x${pPre.height}`,
      '-i',
      'pipe:0',
      '-vframes',
      '1',
      diffPng,
    ]);
    ffmpegDiff.stdin.write(diffResults.diffData);
    ffmpegDiff.stdin.end();

    results.push({
      shotId,
      frameIdx: idx,
      meanDiff: diffResults.meanDiff,
      maxDiff: diffResults.maxDiff,
    });
  }

  const avgMeanDiff = results.reduce((acc, r) => acc + r.meanDiff, 0) / results.length;
  let verdict = 'UNKNOWN';

  // Threshold for "Encoding is Dirty"
  // Usually, meanDiff > 2-3 in a high-bitrate encode might be suspicious,
  // but here we are comparing Lanczos-processed lossless vs final.
  if (avgMeanDiff > 2.0) {
    verdict = 'ENCODE_DIRTY';
  } else {
    verdict = 'ASSET_OR_PREENCODE_DIRTY';
  }

  const finalReport = {
    verdict,
    avgMeanDiff,
    details: results,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(epDir, 'origin_trace_verdict.json'),
    JSON.stringify(finalReport, null, 2)
  );
  return finalReport;
}

function log(msg) {
  console.log(`[Q1-TRACE] ${msg}`);
}

if (require.main === module) {
  const epDir = process.argv[2];
  const video = process.argv[3];
  if (!epDir || !video) {
    console.error('Usage: node quality_origin_trace.js <ep_dir> <video_path>');
    process.exit(1);
  }
  trace(epDir, video).then((r) => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { trace };
