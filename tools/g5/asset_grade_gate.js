const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { checkSkinCleanliness } = require('./skin_cleanliness_checker');

/**
 * G5 Asset Grade Gate
 * Determines the grade (A, B, C) of a character's assets.
 */

async function getResolution(imagePath) {
  const probe = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 "${imagePath}"`
  )
    .toString()
    .trim()
    .split('\n');
  return { w: parseInt(probe[0]), h: parseInt(probe[1]) };
}

async function getLineartDensity(imagePath, roi = null) {
  const res = await getResolution(imagePath);
  const w = roi ? roi.w : res.w;
  const h = roi ? roi.h : res.h;
  const cropFilter = roi ? `crop=${roi.w}:${roi.h}:${roi.x}:${roi.y},` : '';

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      imagePath,
      '-vf',
      `${cropFilter}edgedetect=low=0.1:high=0.4,format=gray`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ]);

    let chunks = [];
    ffmpeg.stdout.on('data', (d) => chunks.push(d));
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(`FFmpeg edgedetect failed`));
      const data = Buffer.concat(chunks);
      let edgePixels = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 10) edgePixels++; // Threshold for edge
      }
      const density = edgePixels / (w * h);
      resolve(density);
    });
  });
}

async function gradeCharacter(characterId, outputReportPath = null) {
  const assetBase = path.join(process.cwd(), 'assets/characters/v1', characterId);
  if (!fs.existsSync(assetBase)) {
    throw new Error(`Character ${characterId} not found at ${assetBase}`);
  }

  const views = ['front.png', 'side.png', 'back.png'];
  const assetStats = [];
  let overallGrade = 'A';
  const admitTier = ['1440p'];
  const reasons = [];

  // ROI for face (approximated for density/cleanliness)
  // Note: This relies on the 8K/4K/SD scaling. For consistency, we'll try to find the face.
  // For now, we'll use a centered-top-ish ROI as a proxy if not specified.

  for (const view of views) {
    const viewPath = path.join(assetBase, view);
    if (!fs.existsSync(viewPath)) continue;

    const res = await getResolution(viewPath);
    const minSide = Math.min(res.w, res.h);

    // Face ROI (top-center, approx 1/3 of image)
    const roi = {
      x: Math.floor(res.w * 0.35),
      y: Math.floor(res.h * 0.1),
      w: Math.floor(res.w * 0.3),
      h: Math.floor(res.h * 0.3),
    };

    const cleanliness = await checkSkinCleanliness(viewPath, roi);
    const density = await getLineartDensity(viewPath, roi);

    assetStats.push({
      view,
      resolution: `${res.w}x${res.h}`,
      minSide,
      spotCount: cleanliness.spotCount,
      lineartDensity: parseFloat(density.toFixed(4)),
    });
  }

  // Grading Logic
  const avgMinSide = assetStats.reduce((sum, s) => sum + s.minSide, 0) / assetStats.length;
  const maxSpotCount = Math.max(...assetStats.map((s) => s.spotCount));
  const minDensity = Math.min(...assetStats.map((s) => s.lineartDensity));
  const worstView =
    assetStats.find((s) => s.spotCount === maxSpotCount || s.lineartDensity === minDensity)?.view ||
    'front.png';

  if (avgMinSide < 4096) {
    overallGrade = 'C';
    reasons.push(`native resolution insufficient: avg_min_side ${avgMinSide.toFixed(0)} < 4096`);
  }
  if (maxSpotCount > 0) {
    overallGrade = 'C';
    reasons.push(`face cleanliness failed: max_spot_count ${maxSpotCount}`);
  }
  if (minDensity < 0.06) {
    overallGrade = 'C';
    reasons.push(`low lineart density: min_density ${(minDensity * 100).toFixed(2)}% < 6%`);
  }

  // Refine to B if resolution is 4K but not 8K
  if (overallGrade !== 'C') {
    if (avgMinSide < 8192) {
      overallGrade = 'B';
      admitTier.push('4k');
      reasons.push(`8K-Ready failed: avg_min_side ${avgMinSide.toFixed(0)} < 8192`);
    } else {
      overallGrade = 'A';
      admitTier.push('4k', '8k');
    }
  }

  const report = {
    characterId,
    timestamp: new Date().toISOString(),
    grade: overallGrade,
    admitTier,
    reasons,
    evidenceFramePath: path.join(assetBase, worstView),
    assetStats,
  };

  if (outputReportPath) {
    fs.writeFileSync(outputReportPath, JSON.stringify(report, null, 2));
  }

  return report;
}

async function main() {
  const charIdArg = process.argv.find((a) => a.startsWith('--character='));
  const outPathArg = process.argv.find((a) => a.startsWith('--out='));

  const charId = charIdArg ? charIdArg.split('=')[1] : null;
  const outPath = outPathArg ? outPathArg.split('=')[1] : null;

  if (!charId) {
    console.error(
      'Usage: node tools/g5/asset_grade_gate.js --character=<charId> --out=<report_path>'
    );
    process.exit(1);
  }

  try {
    const report = await gradeCharacter(charId, outPath);
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('Grade Gate Fatal Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { gradeCharacter };
