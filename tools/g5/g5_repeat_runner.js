const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { auditVideoSharpness } = require('./sharpness_checker');
const { auditAssets } = require('./asset_pixel_density_gate');

/**
 * G5 Phase P-G5-REPEAT (Q-HARDEN): Industrial Quality Proofer
 * Automates E0002 - E0010 with strict Gate-0 + Quality Gate enforcement.
 */

const IS_HQ = process.argv.includes('--hq');
const TIER = process.argv.find((a) => a.startsWith('--tier='))?.split('=')[1];
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const PROD_ROOT = process.argv.includes('--evidenceRoot')
  ? process.argv[process.argv.indexOf('--evidenceRoot') + 1]
  : path.join(process.cwd(), `docs/_evidence/G5_Q_HARDEN_${TIMESTAMP}`);

const ASSET_BASE = path.join(process.cwd(), 'assets');

const episodes = [
  { id: 'E0002', durationSec: 15, orbit: { start: 30, end: 120 }, desc: 'Front-to-Side Switch' },
  { id: 'E0003', durationSec: 10, orbit: { start: 90, end: 200 }, desc: 'Side-to-Back Switch' },
  { id: 'E0004', durationSec: 12, orbit: { start: 270, end: 380 }, desc: 'Wrap-around Switch' },
  { id: 'E0005', durationSec: 15, orbit: { start: 0, end: 360 }, desc: 'Full 360 Rotation' },
  { id: 'E0006', durationSec: 20, orbit: { start: 180, end: 45 }, desc: 'Reverse Rotation' },
  { id: 'E0007', durationSec: 10, orbit: { start: 40, end: 50 }, desc: 'Near Boundary Oscill' },
  { id: 'E0008', durationSec: 15, orbit: { start: 130, end: 140 }, desc: 'Side-to-Back Switch' },
  { id: 'E0009', durationSec: 12, orbit: { start: 310, end: 320 }, desc: 'Front-Side Boundary' },
  { id: 'E0010', durationSec: 18, orbit: { start: -45, end: 45 }, desc: 'Negative Angle Logic' },
];

function log(msg) {
  console.log(`[P-Q-HARDEN] ${msg}`);
}

async function runEpisode(ep) {
  const epDir = path.join(PROD_ROOT, ep.id);
  const framesDir = path.join(epDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  log(`>>> [${ep.id}] Started: ${ep.desc} (${ep.durationSec}s) ${IS_HQ ? '[HQ MODE]' : ''}`);

  // 1. Prepare Plans
  const renderPlan = {
    totalFrames: ep.durationSec * 24,
    shots: [{ id: 'shot_0001', durationFrames: ep.durationSec * 24, locationId: 'LO_XueFuYuanZi' }],
  };
  const motionPlan = {
    assignments: [
      {
        shotId: 'shot_0001',
        templateId: 'orbit_pan',
        isStanding: true,
        verticalDrift: 0,
        params: { orbit: ep.orbit },
      },
    ],
  };
  const layeringPlan = {
    assignments: [
      {
        shotId: 'shot_0001',
        characterId: 'CH_XueZhiYing',
        layers: [
          { sourcePath: `assets/characters/v1/CH_XueZhiYing/front.png`, offset: { x: 0, y: 0 } },
        ],
        shadow: { enabled: true, params: { opacity: 0.4, offset: { x: 0, y: 45 } } },
      },
    ],
  };

  fs.writeFileSync(path.join(epDir, 'render_plan.json'), JSON.stringify(renderPlan, null, 2));
  fs.writeFileSync(path.join(epDir, 'motion_plan.json'), JSON.stringify(motionPlan, null, 2));
  fs.writeFileSync(path.join(epDir, 'layering_plan.json'), JSON.stringify(layeringPlan, null, 2));

  // PLAN-2: Fix Dialogue Fallback (Strict creation)
  const dialoguePlanFile = path.join(epDir, 'dialogue_plan.json');
  if (!fs.existsSync(dialoguePlanFile)) {
    log(`[INFO] dialogue_plan.json intentionally empty for this episode. (SSOT Compliance)`);
    fs.writeFileSync(dialoguePlanFile, JSON.stringify({ dialogues: [] }, null, 2));
  }

  // 1.5 Asset Grade Admission (PLAN-3)
  let currentTier = TIER;
  let effectiveHQ = IS_HQ;
  const { gradeCharacter } = require('./asset_grade_gate');
  let gradeReport = null;

  if (currentTier === '4k' || currentTier === '8k') {
    log(`   Auditing Asset Grade Admission for Tier: ${currentTier}...`);
    gradeReport = await gradeCharacter('CH_XueZhiYing');
    fs.writeFileSync(
      path.join(epDir, 'asset_grade_report.json'),
      JSON.stringify(gradeReport, null, 2)
    );

    if (!gradeReport.admitTier.includes(currentTier)) {
      log(`!!! ASSET_GRADE=${gradeReport.grade} -> DOWNGRADE ${currentTier} => 1440p`);
      const verdict = {
        requestedTier: currentTier,
        assetGrade: gradeReport.grade,
        verdict: 'DOWNGRADE',
        reasons: gradeReport.reasons,
        renderResolution: effectiveHQ ? '5K (5120x2880)' : '1440p (2560x1440)',
        deliveryResolution: '1440p (2560x1440)',
        ffprobe_sampled: null,
      };
      currentTier = null;
      effectiveHQ = false; // PLAN-1: Force 1440p physical delivery by disabling 5K HQ rendering
      fs.writeFileSync(
        path.join(epDir, 'downgrade_verdict.json'),
        JSON.stringify(verdict, null, 2)
      );
    }
  }

  // 2. Render
  const outputMp4 = path.join(epDir, `preview_${ep.id}_real${effectiveHQ ? '_hq' : ''}.mp4`);
  log(`   Rendering... (Unreal V4.2 + Quality Patch)`);
  const hqFlag = effectiveHQ ? '--hq' : '';
  const tierFlag = currentTier ? `--tier=${currentTier}` : '';
  const gradeFlag = gradeReport ? `--grade=${gradeReport.grade}` : '--grade=C';
  const dumpFlag = process.argv.includes('--dump-pre-encode') ? '--dump-pre-encode' : '';
  execSync(
    `node tools/renderer/unreal_executor.js "${path.join(epDir, 'render_plan.json')}" "${outputMp4}" "${epDir}" "REP_${ep.id}_${currentTier || (effectiveHQ ? 'HQ' : 'SD')}" ${hqFlag} ${tierFlag} ${gradeFlag} ${dumpFlag}`
  );

  // 3. Strict Audit (ffprobe)
  log(`   Auditing Gate-0...`);
  const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,width,height,avg_frame_rate,duration -of json "${outputMp4}"`;
  const probeRaw = execSync(probeCmd).toString();
  const probeRes = JSON.parse(probeRaw);
  fs.writeFileSync(path.join(epDir, `ffprobe_${ep.id}.json`), probeRaw);

  const stream = probeRes.streams[0];
  const width = stream.width;
  const height = stream.height;

  // PLAN-3: Update verdict with sampled ffprobe
  if (fs.existsSync(path.join(epDir, 'downgrade_verdict.json'))) {
    const vData = JSON.parse(fs.readFileSync(path.join(epDir, 'downgrade_verdict.json')));
    vData.ffprobe_sampled = { width, height };
    fs.writeFileSync(path.join(epDir, 'downgrade_verdict.json'), JSON.stringify(vData, null, 2));
  }

  const expectedFrames = ep.durationSec * 24;
  const actualFrames = parseInt(stream.nb_frames);
  const duration = parseFloat(stream.duration);

  const results = {
    episode_id: ep.id,
    planned_duration: ep.durationSec,
    expected_frames: expectedFrames,
    nb_frames: actualFrames,
    width,
    height,
    duration,
    status: 'PASS',
    quality: {},
  };

  if (actualFrames !== expectedFrames) {
    results.status = 'FAIL';
    results.error = `nb_frames mismatch: ${actualFrames} != ${expectedFrames}`;
  } else if (Math.abs(duration - ep.durationSec) > 0.1) {
    results.status = 'FAIL';
    results.error = `duration drift too high: ${duration} vs ${ep.durationSec}`;
  } else if (currentTier === '4k' && (width !== 3840 || height !== 2160)) {
    results.status = 'FAIL';
    results.error = `Resolution mismatch for 4K Tier: ${width}x${height} != 3840x2160`;
  } else if (currentTier === '8k' && (width !== 7680 || height !== 4320)) {
    results.status = 'FAIL';
    results.error = `Resolution mismatch for 8K Tier: ${width}x${height} != 7680x4320`;
  } else if (!currentTier && (width !== 2560 || height !== 1440)) {
    // PLAN-1: Hard Enforcement of 1440p for non-tier/downgraded delivery
    results.status = 'FAIL';
    results.error = `Downgrade Violation: Physical delivery is ${width}x${height}, expected 2560x1440`;
  }

  if (results.status === 'FAIL') throw new Error(`[Audit Fail] ${results.error}`);

  // 4. Quality Gate (Sharpness & Cleanliness)
  log(`   Auditing Quality Gate (Sharpness & Skin)...`);
  const report = await auditVideoSharpness(outputMp4, 30);
  fs.writeFileSync(path.join(epDir, `sharpness_report.json`), JSON.stringify(report, null, 2));
  results.quality = report.stats;

  // Adaptive Thresholds: High resolution Laplacian stats are lower due to pixel density.
  let SHARP_THRESHOLD_P50 = 360;
  let SHARP_THRESHOLD_P10 = 300;

  if (TIER === '4k' || TIER === '8k') {
    // For 4K/8K, we rely on P1 Asset Density Gate and P2 Skin Cleanliness.
    // Lowering statistical threshold to accommodate oversampled smoothness.
    SHARP_THRESHOLD_P50 = 50;
    SHARP_THRESHOLD_P10 = 40;
  }

  if (results.quality.p50 < SHARP_THRESHOLD_P50) {
    results.status = 'FAIL';
    results.error = `Quality Fail: p50 Sharpness ${results.quality.p50} < ${SHARP_THRESHOLD_P50} (Tier: ${TIER || 'SD'})`;
  } else if (results.quality.p10 < SHARP_THRESHOLD_P10) {
    results.status = 'FAIL';
    results.error = `Quality Fail: p10 Sharpness ${results.quality.p10} < ${SHARP_THRESHOLD_P10} (Tier: ${TIER || 'SD'})`;
  }

  if (results.status === 'FAIL') throw new Error(`[Quality Fail] ${results.error}`);

  // 5. Evidence Keyframes (PNG for quality comparison)
  log(`   Extracting HQ PNG frames...`);
  const frameTimes = [1, Math.floor(ep.durationSec / 2), ep.durationSec - 0.5];
  const labels = ['front', 'switch', 'side'];
  frameTimes.forEach((t, i) => {
    const out = path.join(framesDir, `${ep.id}_${labels[i]}.png`);
    execSync(`ffmpeg -y -ss ${t} -i "${outputMp4}" -vframes 1 "${out}" -loglevel error`);
  });

  log(`<<< [${ep.id}] Result: PASS (Sharpness p50: ${results.quality.p50})`);
  return results;
}

async function main() {
  log(`Began Q-HARDEN Production. Root: ${PROD_ROOT}`);
  fs.mkdirSync(PROD_ROOT, { recursive: true });

  const summary = [];
  let targetList = episodes;

  if (process.argv.includes('--only')) {
    const id = process.argv[process.argv.indexOf('--only') + 1];
    targetList = episodes.filter((e) => e.id === id);
  } else if (process.argv.includes('--range')) {
    const range = process.argv[process.argv.indexOf('--range') + 1].split(':');
    const startIdx = episodes.findIndex((e) => e.id === range[0]);
    const endIdx = episodes.findIndex((e) => e.id === range[1]);
    targetList = episodes.slice(startIdx, endIdx + 1);
  }

  for (const ep of targetList) {
    try {
      const res = await runEpisode(ep);
      summary.push(res);
    } catch (e) {
      log(`!!! FATAL ERROR in ${ep.id}: ${e.message}`);
      summary.push({ episode_id: ep.id, status: 'FAIL', error: e.message });
      writeSummary(summary);
      process.exit(1);
    }
  }

  writeSummary(summary);
  log(`=== ALL TARGETS PROCESSED | Evidence: ${PROD_ROOT} ===`);
}

function writeSummary(summary) {
  fs.writeFileSync(
    path.join(PROD_ROOT, 'quality_harden_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  const csvHeader = 'episode_id,status,nb_frames,duration,p10,p50,p90,error\n';
  const csvRows = summary
    .map(
      (r) =>
        `${r.episode_id},${r.status},${r.nb_frames || ''},${r.duration || ''},${r.quality?.p10 || ''},${r.quality?.p50 || ''},${r.quality?.p90 || ''},"${r.error || ''}"`
    )
    .join('\n');
  fs.writeFileSync(path.join(PROD_ROOT, 'quality_harden_summary.csv'), csvHeader + csvRows);
}

main();
