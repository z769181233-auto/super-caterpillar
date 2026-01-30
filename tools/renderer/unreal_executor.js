const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * G5 Content Leap: 2.5D Content Synthesizer (Unreal Simulation V4)
 * P0-4: Pure Plan-Driven Executor - No hardcoded oscillation, strictly follows G5 P0 Engines.
 *
 * Usage: node unreal_executor.js <plan_json> <output_mp4> <evidence_dir> <run_tag>
 */

const planPath = process.argv[2];
const outputMp4 = process.argv[3];
const evidenceDir = process.argv[4];
const runTag = process.argv[5] || 'G5_V4';

if (!planPath || !outputMp4 || !evidenceDir) {
  console.error('Usage: node unreal_executor.js <plan_json> <output_mp4> <evidence_dir> <run_tag>');
  process.exit(1);
}

const renderPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const baseDir = path.dirname(planPath);

// 1. Load G5 P0 Plans (Try to find them in evidence dir or same dir as plan)
function loadG5Plan(filename, defaultVal = { assignments: [] }) {
  const p = path.join(baseDir, filename);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  console.warn(`[WARN] G5 Plan ${filename} not found at ${p}. Using empty fallback.`);
  return defaultVal;
}

const dialoguePlan = loadG5Plan('dialogue_plan.json', { dialogues: [] });
const motionPlan = loadG5Plan('motion_plan.json');
const layeringPlan = loadG5Plan('layering_plan.json');

const runtimeDir = path.join(
  process.cwd(),
  '.runtime/unreal_render',
  `${path.basename(outputMp4, '.mp4')}_${runTag}`
);
fs.mkdirSync(runtimeDir, { recursive: true });

const ASSET_BASE = path.join(process.cwd(), 'assets');
const fontPath = '/System/Library/Fonts/STHeiti Medium.ttc';

const IS_HQ = process.argv.includes('--hq');
const DUMP_PRE = process.argv.includes('--dump-pre-encode');
const TIER_4K = process.argv.includes('--tier=4k');
const TIER_8K = process.argv.includes('--tier=8k');
const GRADE = process.argv.find((a) => a.startsWith('--grade='))?.split('=')[1] || 'C';

let RENDER_W = 2560;
let RENDER_H = 1440;
let SCALE_FLAGS = 'bicubic';
let CHAR_SCALE_W = 1200;

if (TIER_8K) {
  RENDER_W = 7680;
  RENDER_H = 4320;
  SCALE_FLAGS = GRADE === 'C' ? 'bicubic' : 'lanczos';
  CHAR_SCALE_W = 6000;
} else if (TIER_4K) {
  RENDER_W = 3840;
  RENDER_H = 2160;
  SCALE_FLAGS = GRADE === 'C' ? 'bicubic' : 'lanczos';
  CHAR_SCALE_W = 3000;
} else if (IS_HQ) {
  RENDER_W = 5120;
  RENDER_H = 2880;
  SCALE_FLAGS = GRADE === 'C' ? 'bicubic' : 'lanczos';
  CHAR_SCALE_W = 2400;
}

async function render() {
  console.log(`=== G5 Content Synthesizer (V4 - ${runTag}) Started ===`);
  console.log(`Root Plan: ${planPath}`);

  const manifest = {
    runTag,
    totalFrames: renderPlan.totalFrames,
    g5_p0_status: {
      dialogue: dialoguePlan.dialogues.length > 0,
      motion: motionPlan.assignments.length > 0,
      layering: layeringPlan.assignments.length > 0,
    },
    shots: [],
  };

  const concatList = [];
  const shots = renderPlan.renderShots || renderPlan.shots || [];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const shotId = shot.id || `shot_${i.toString().padStart(4, '0')}`;
    const shotDir = path.join(runtimeDir, shotId);
    fs.mkdirSync(shotDir, { recursive: true });

    // 1. Resolve Plans for this shot
    const sMotion = motionPlan.assignments.find((a) => a.shotId === shotId) || {
      params: {},
      verticalDrift: 0,
      isStanding: true,
    };
    const sLayering = layeringPlan.assignments.find((a) => a.shotId === shotId) || {
      layers: [],
      shadow: { enabled: false },
    };
    const sDialogue = dialoguePlan.dialogues.filter((d) => d.shotId === shotId);

    // 🟢 COMPLIANCE AUDIT: Zero Drift Rule
    if (sMotion.isStanding && Math.abs(sMotion.verticalDrift) > 0.001) {
      console.error(
        `❌ [COMPLIANCE FAILURE] Shot ${shotId} is STANDING but has dy=${sMotion.verticalDrift}. Terminating.`
      );
      process.exit(1);
    }

    const durationFrames = shot.durationFrames || 48;
    const durationSec = durationFrames / 24;
    const shotMp4 = path.join(shotDir, `${shotId}.mp4`);

    // 2. Resolve Background
    const bgPath = path.join(
      ASSET_BASE,
      'locations',
      shot.locationId ? `${shot.locationId}.png` : 'LO_XueFuYuanZi.png'
    );
    if (!fs.existsSync(bgPath)) {
      console.warn(`[WARN] Background ${bgPath} missing. using stub.`);
    }

    // 3. Build FFMPEG Complex Filter for Layering + Motion
    let inputs = [`-loop 1 -i "${bgPath}"`];
    let filterParts = [`[0:v]scale=${RENDER_W}:${RENDER_H}:flags=${SCALE_FLAGS}[bg]`];
    let lastOutput = 'bg';

    // Add Shadow if enabled (G5_ASSET_LAYER_PROTOCOL)
    if (sLayering.shadow && sLayering.shadow.enabled) {
      const shd = sLayering.shadow.params || { opacity: 0.4, offset: { x: 0, y: 40 } };
      const shdSize = IS_HQ ? '512x128' : '256x64';
      const shdOffset = IS_HQ ? { x: shd.offset.x * 2, y: shd.offset.y * 2 } : shd.offset;
      filterParts.push(
        `color=c=black:s=${shdSize},format=rgba,geq=lum=0:a='255*exp(-((X-${IS_HQ ? 256 : 128})^2/${IS_HQ ? 16000 : 4000}+(Y-${IS_HQ ? 64 : 32})^2/${IS_HQ ? 2000 : 500}))'[shd]`
      );
      filterParts.push(
        `[${lastOutput}][shd]overlay=x=W/2-${IS_HQ ? 256 : 128}+${shdOffset.x}:y=H-${IS_HQ ? 240 : 120}+${shdOffset.y}:alpha=${shd.opacity}[with_shd]`
      );
      lastOutput = 'with_shd';
    }

    // Add Character Layers
    sLayering.layers.forEach((layer, lIdx) => {
      const charId = sLayering.characterId;
      const mappingPath = path.join(ASSET_BASE, 'characters', 'v1', charId, 'mapping.json');
      let mapping = null;
      if (fs.existsSync(mappingPath)) {
        mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      }

      const lInputIdx = inputs.length;

      // 3-VIEW DETERMINATION: If Orbit motion is detected, we use dynamic views
      if (mapping && sMotion.params && sMotion.params.orbit) {
        const orb = sMotion.params.orbit;
        const startAngle = orb.start || 0;
        const endAngle = orb.end || 0;

        // For a 15s Orbit, we need to switch inputs.
        // Since this executor is shot-based-to-FFMPEG-command,
        // we'll implement the switch using multiple inputs + overlay + enable.

        const views = ['front', 'side', 'back'];
        const viewInputs = {};
        views.forEach((v) => {
          const suffix = TIER_8K ? '_8k' : TIER_4K ? '_4k' : '';
          let vFile = mapping.views[v].file;
          let vPath = path.join(
            ASSET_BASE,
            'characters',
            'v1',
            charId,
            vFile.replace('.png', `${suffix}.png`)
          );
          if (!fs.existsSync(vPath)) {
            vPath = path.join(ASSET_BASE, 'characters', 'v1', charId, mapping.views[v].file);
          }
          viewInputs[v] = inputs.length;
          inputs.push(`-loop 1 -i "${vPath}"`);
        });

        // Compute Enable Expressions
        // Rule: Front: [0, 45) | [315, 360), Side: [45, 135) | [225, 315), Back: [135, 225)
        const getAngleExpr = `(${startAngle} + (t/${durationSec}) * (${endAngle - startAngle}))`;
        const normAngle = `mod(mod(${getAngleExpr}, 360) + 360, 360)`;

        const frontEnable = `between(${normAngle},0,45)+between(${normAngle},315,360)`;
        const sideEnable = `between(${normAngle},45,135)+between(${normAngle},225,315)`;
        const backEnable = `between(${normAngle},135,225)`;

        const layerParts = [];
        if (viewInputs.front !== undefined) {
          filterParts.push(
            `[${viewInputs.front}:v]scale=${CHAR_SCALE_W}:-1:flags=${SCALE_FLAGS},format=rgba[v_front_${lIdx}]`
          );
          layerParts.push(`[v_front_${lIdx}]enable='${frontEnable}'`);
        }
        if (viewInputs.side !== undefined) {
          filterParts.push(
            `[${viewInputs.side}:v]scale=${CHAR_SCALE_W}:-1:flags=${SCALE_FLAGS},format=rgba[v_side_${lIdx}]`
          );
          layerParts.push(`[v_side_${lIdx}]enable='${sideEnable}'`);
        }
        if (viewInputs.back !== undefined) {
          filterParts.push(
            `[${viewInputs.back}:v]scale=${CHAR_SCALE_W}:-1:flags=${SCALE_FLAGS},format=rgba[v_back_${lIdx}]`
          );
          layerParts.push(`[v_back_${lIdx}]enable='${backEnable}'`);
        }

        // Sequence of Overlays
        layerParts.forEach((lp, lpIdx) => {
          const [vTag, enable] = lp.split('enable=');
          filterParts.push(
            `[${lastOutput}]${vTag}overlay=x=(W-w)/2:y=H-h-50:enable=${enable}[v${lIdx}_temp_${lpIdx}]`
          );
          lastOutput = `v${lIdx}_temp_${lpIdx}`;
        });
        filterParts.push(`[${lastOutput}]null[v${lIdx}]`);
        lastOutput = `v${lIdx}`;
      } else {
        // Legacy Single View Mode
        inputs.push(`-loop 1 -i "${layer.sourcePath}"`);

        let driftY = sMotion.verticalDrift || 0;
        if (
          sMotion.params &&
          sMotion.params.animation &&
          sMotion.params.animation.type === 'breathing'
        ) {
          const a = sMotion.params.animation;
          driftY += Math.sin((Date.now() / 1000) * 2 * Math.PI * a.frequency) * a.amplitude * 50;
        }

        const feather =
          sLayering.blending && sLayering.blending.feather ? sLayering.blending.feather : 0;
        let layerRef = `${lInputIdx}:v`;
        filterParts.push(
          `[${layerRef}]scale=${CHAR_SCALE_W}:-1:flags=${SCALE_FLAGS},format=rgba${feather > 0 ? `,boxblur=${feather}` : ''}[l${lIdx}_pre]`
        );
        layerRef = `l${lIdx}_pre`;

        filterParts.push(
          `[${lastOutput}][${layerRef}]overlay=x=(W-w)/2+${layer.offset ? layer.offset.x : 0}:y=H-h-50-${driftY.toFixed(3)}[v${lIdx}]`
        );
        lastOutput = `v${lIdx}`;
      }
    });

    // Add Dialogue Text (G5_DIALOGUE_BINDING_SPEC)
    let textOverlay = '';
    const shotStartTime = shot.startSec || 0;
    if (sDialogue.length > 0) {
      sDialogue.forEach((d, dIdx) => {
        const dialogue = d.text.replace(/['"]/g, '').replace(/:/g, '\\:');
        const startRel = Math.max(0, d.startSec - shotStartTime);
        const endRel = Math.min(durationSec, d.endSec - shotStartTime);
        textOverlay += `${dIdx === 0 ? '' : ','}drawtext=text='${dialogue}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-120:fontfile='${fontPath}':box=1:boxcolor=black@0.6:boxborderw=10:enable='between(t,${startRel},${endRel})'`;
      });
      textOverlay = `[${lastOutput}]${textOverlay}[comp_v]`;
    } else {
      textOverlay = `[${lastOutput}]null[comp_v]`;
    }

    let finalPart = '';
    if (TIER_8K || TIER_4K || IS_HQ) {
      // Phase Q4 Final Seal: Pushing to Tier Gate
      // Using 5x5:0.3 Luma-only calibrated for 4K/8K clarity without artifacts.
      if (GRADE !== 'C') {
        const usStr = TIER_8K ? '0.35' : '0.30';
        filterParts.push(`[comp_v]unsharp=5:5:${usStr}:5:5:0.0[out_hq]`);
        finalPart = `[out_hq]null[out_final]`;
      } else {
        finalPart = `[comp_v]null[out_final]`;
      }
    } else {
      finalPart = `[comp_v]null[out_final]`;
    }

    const finalOutput = `${textOverlay};${finalPart}`;

    // 4. Execute FFMPEG (Phase Q3/Q4 Hardened)
    let videoCodec = `-c:v libx264 -preset slow -crf 14 -tune animation -x264-params aq-mode=3:aq-strength=0.9:deblock=-1,-1`;
    if (TIER_8K) {
      videoCodec = `-c:v libx265 -crf 16 -preset slow -tune animation -x265-params aq-mode=3:aq-strength=0.9`;
    } else if (!IS_HQ && !TIER_4K) {
      videoCodec = `-c:v libx264 -preset ultrafast -crf 23`;
    }

    const cmd =
      `ffmpeg -y -threads 1 ${inputs.join(' ')} -f lavfi -i "anullsrc=r=48000:cl=stereo" ` +
      `-filter_complex "${filterParts.join(';')};${finalOutput}" ` +
      `-map "[out_final]" -map ${inputs.length}:a -t ${durationSec} -r 24 ${videoCodec} -pix_fmt ${TIER_8K ? 'yuv420p10le' : 'yuv420p'} -profile:v ${TIER_8K ? 'main10' : 'high'} -level ${TIER_8K ? '5.1' : '4.1'} ` +
      `-bitexact -fflags +bitexact -g 48 -map_metadata -1 "${shotMp4}"`;

    if (DUMP_PRE) {
      const preEncodeDir = path.join(evidenceDir, 'pre_encode_frames');
      if (!fs.existsSync(preEncodeDir)) fs.mkdirSync(preEncodeDir, { recursive: true });

      // Dump 3 frames from this shot (start, mid, end relative)
      const sampleTs = [0.5, durationSec / 2, durationSec - 0.5].map((t) =>
        Math.max(0, Math.min(durationSec, t))
      );
      sampleTs.forEach((ts, idx) => {
        const pngOut = path.join(preEncodeDir, `${shotId}_f${idx}.png`);
        const dumpCmd =
          `ffmpeg -y -threads 1 ${inputs.join(' ')} -f lavfi -i "anullsrc=r=48000:cl=stereo" ` +
          `-filter_complex "${filterParts.join(';')};${finalOutput}" ` +
          `-map "[out_final]" -ss ${ts} -vframes 1 "${pngOut}" -loglevel error`;
        execSync(dumpCmd);
      });
      console.log(`  [Q1] Dumped 3 pre-encode PNGs for ${shotId}`);
    }

    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch (e) {
      console.error(`ERROR rendering ${shotId}:`, e.stderr ? e.stderr.toString() : e.message);
      throw e;
    }

    manifest.shots.push({
      shotId,
      motionTemplate: sMotion.templateId,
      layers: sLayering.layers.length,
      dialogues: sDialogue.length,
      durationSec: parseFloat(durationSec.toFixed(3)),
      hash: crypto.createHash('sha256').update(`${shotId}_${durationFrames}`).digest('hex'),
    });

    concatList.push(`file '${shotMp4}'`);
    if (i % 10 === 0)
      console.log(`  [G5] Rendered Shot ${i}/${shots.length} (Layers: ${sLayering.layers.length})`);
  }

  // 5. Final Concat & Report
  const listPath = path.join(runtimeDir, 'concat_list.txt');
  fs.writeFileSync(listPath, concatList.join('\n'));

  const concatCmd = `ffmpeg -y -threads 1 -f concat -safe 0 -i "${listPath}" -c copy -map_metadata -1 "${outputMp4}"`;
  execSync(concatCmd);

  fs.writeFileSync(
    path.join(evidenceDir, `g5_render_manifest.json`),
    JSON.stringify(manifest, null, 2)
  );

  const auditData = {
    encoder: TIER_8K ? 'libx265' : 'libx264',
    tier: TIER_8K ? '8k' : TIER_4K ? '4k' : IS_HQ ? 'hq' : 'sd',
    resolution: `${RENDER_W}x${RENDER_H}`,
    pix_fmt: TIER_8K ? 'yuv420p10le' : 'yuv420p',
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(evidenceDir, 'encode_audit.json'), JSON.stringify(auditData, null, 2));

  console.log(`✅ [G5] Content Sealing Ready: ${outputMp4}`);
}

render().catch((err) => {
  console.error('❌ G5 Renderer Fatal Error:', err.message);
  process.exit(1);
});
