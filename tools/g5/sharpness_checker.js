const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * G5 Sharpness Auditing Utility (Statistical Laplacian Variance)
 * Extracts N frames from a video and computes statistical metrics.
 */

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor(p * (sorted.length - 1));
  return sorted[index];
}

async function calculateImageSharpness(imagePath) {
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
      '-vf',
      'format=gray',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ]);

    let buffer = Buffer.alloc(0);
    ffmpeg.stdout.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
    });
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg failed: ${code}`));
      const pixels = new Uint8ClampedArray(buffer);
      const laplacian = new Float32Array(width * height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          laplacian[idx] =
            pixels[idx - width] +
            pixels[idx - 1] +
            pixels[idx + 1] +
            pixels[idx + width] -
            4 * pixels[idx];
        }
      }
      let mean = 0;
      for (let i = 0; i < laplacian.length; i++) mean += laplacian[i];
      mean /= laplacian.length;
      let variance = 0;
      for (let i = 0; i < laplacian.length; i++) variance += Math.pow(laplacian[i] - mean, 2);
      resolve(Math.round((variance / laplacian.length) * 100) / 100);
    });
  });
}

/**
 * Audits a video file for sharpness.
 * @param {string} videoPath
 * @param {number} nFrames Number of frames to sample
 * @returns {Promise<Object>} Sharpness report
 */
async function auditVideoSharpness(videoPath, nFrames = 30) {
  if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`);

  // 1. Get duration
  const duration = parseFloat(
    execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    )
      .toString()
      .trim()
  );

  // 2. Determine sample timestamps
  const timestamps = [];
  const interval = duration / (nFrames + 1);
  for (let i = 1; i <= nFrames; i++) {
    timestamps.push(i * interval);
  }

  const tmpDir = path.join(
    process.cwd(),
    '.runtime',
    'sharpness_tmp',
    Math.random().toString(36).substring(7)
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  const scores = [];
  for (let i = 0; i < timestamps.length; i++) {
    const framePath = path.join(tmpDir, `f_${i}.png`);
    execSync(
      `ffmpeg -y -ss ${timestamps[i]} -i "${videoPath}" -vframes 1 "${framePath}" -loglevel error`
    );
    const score = await calculateImageSharpness(framePath);
    scores.push(score);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    video_path: videoPath,
    sample_count: scores.length,
    method: 'Laplacian Variance',
    stats: {
      p10: getPercentile(scores, 0.1),
      p50: getPercentile(scores, 0.5),
      p90: getPercentile(scores, 0.9),
      mean: Math.round(mean * 100) / 100,
      min: Math.min(...scores),
      max: Math.max(...scores),
    },
    raw_scores: scores,
    timestamp: new Date().toISOString(),
  };
}

if (require.main === module) {
  const video = process.argv[2];
  if (!video) {
    console.error('Usage: node sharpness_checker.js <video_path>');
    process.exit(1);
  }
  auditVideoSharpness(video)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { auditVideoSharpness, calculateImageSharpness };
