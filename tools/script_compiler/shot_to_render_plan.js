const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ShotSpec to RenderPlan Compiler (Phase E) - V3 Industrial Sealing
 * Inputs: *.shot.json, render_map.json
 * Output: *.render_plan.json + Evidence Package
 */

const FPS = 24;
const assetsDir = path.join(__dirname, '../../docs/assets');

// Load Render Map and calculate its SHA
const renderMapPath = path.join(assetsDir, 'render_map.json');
const renderMapContent = fs.readFileSync(renderMapPath, 'utf8');
const RENDER_MAP = JSON.parse(renderMapContent);
const RENDER_MAP_SHA = crypto.createHash('sha256').update(renderMapContent).digest('hex');

function compile(shotSpecPath, outputPath, eviDir) {
    const shotSpecContent = fs.readFileSync(shotSpecPath, 'utf8');
    const shotSpec = JSON.parse(shotSpecContent);
    const shotSpecSha = crypto.createHash('sha256').update(shotSpecContent).digest('hex');

    const episodeId = shotSpec.id || path.basename(shotSpecPath, '.shot.json');

    let currentFrame = 0;
    const renderShots = [];
    const continuityLog = [];

    shotSpec.beats.forEach((beat) => {
        const beatTargetSec = beat.estDurationSec || 0;
        const beatTargetFrames = Math.round(beatTargetSec * FPS);

        const locationId = beat.locationId;
        const sfxIds = beat.sfxIds || [];
        const shots = beat.shotLines || [];

        let totalBaseFrames = 0;
        shots.forEach(s => {
            const motionAsset = RENDER_MAP.motions[s.motionId];
            totalBaseFrames += (motionAsset ? motionAsset.durationFrames : 30);
        });

        const scaleFactor = totalBaseFrames > 0 ? (beatTargetFrames / totalBaseFrames) : 1;
        let beatElapsedFrames = 0;

        shots.forEach((shot, idx) => {
            const comboKey = `${shot.poseId}|${shot.motionId}|${shot.cameraMoveId}`;
            const comboEntry = RENDER_MAP.combos[comboKey];

            if (shot.dialogue && (!comboEntry || !comboEntry.templateId)) {
                console.error(`[ERROR] Render resolution failed for shot ${shot.id}. Combo ${comboKey} not found.`);
                process.exit(1);
            }

            const templateId = comboEntry ? comboEntry.templateId : "STUB_TEMPLATE";
            const motionAsset = RENDER_MAP.motions[shot.motionId];
            const baseDuration = motionAsset ? motionAsset.durationFrames : 30;

            let durationFrames;
            if (idx === shots.length - 1) {
                durationFrames = beatTargetFrames - beatElapsedFrames;
            } else {
                durationFrames = Math.round(baseDuration * scaleFactor);
            }

            const speed = durationFrames > 0 ? (baseDuration / durationFrames) : 1.0;
            const startFrame = currentFrame + beatElapsedFrames;

            renderShots.push({
                shotId: shot.id,
                characterId: shot.characterId,
                locationId: locationId,
                comboKey: comboKey,
                templateId: templateId,
                startFrame: startFrame,
                durationFrames: durationFrames,
                speed: parseFloat(speed.toFixed(3)),
                sfxIds: sfxIds,
                dialogue: shot.dialogue || ""
            });

            continuityLog.push({
                shotId: shot.id,
                startFrame: startFrame,
                endFrame: startFrame + durationFrames,
                duration: durationFrames
            });

            beatElapsedFrames += durationFrames;
        });

        currentFrame += beatTargetFrames;
    });

    const renderPlan = {
        episodeId: episodeId,
        renderContractVersion: RENDER_MAP.renderContractVersion || "0.0.0",
        renderMapSha256: RENDER_MAP_SHA,
        totalFrames: currentFrame,
        renderShots: renderShots
    };

    fs.writeFileSync(outputPath, JSON.stringify(renderPlan, null, 2));
    const renderPlanSha = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex');

    console.log(`Successfully compiled RenderPlan: ${outputPath}`);

    // Output Evidence Package if eviDir provided
    if (eviDir) {
        fs.mkdirSync(eviDir, { recursive: true });
        fs.writeFileSync(path.join(eviDir, 'shot_sha256.txt'), `${shotSpecSha}  ${path.basename(shotSpecPath)}`);
        fs.writeFileSync(path.join(eviDir, 'render_plan_sha256.txt'), `${renderPlanSha}  ${path.basename(outputPath)}`);

        // Frame Continuity Report
        const continuityReport = {
            episodeId: episodeId,
            totalFrames: currentFrame,
            continuityVerified: true,
            log: continuityLog
        };
        // Verify continuity in memory
        for (let i = 1; i < continuityLog.length; i++) {
            if (continuityLog[i].startFrame !== continuityLog[i - 1].endFrame) {
                continuityReport.continuityVerified = false;
                continuityReport.error = `Gap detected between ${continuityLog[i - 1].shotId} and ${continuityLog[i].shotId}`;
            }
        }
        if (continuityLog.length > 0 && continuityLog[continuityLog.length - 1].endFrame !== currentFrame) {
            continuityReport.continuityVerified = false;
            continuityReport.error = `Final frame mismatch: ${continuityLog[continuityLog.length - 1].endFrame} vs ${currentFrame}`;
        }

        fs.writeFileSync(path.join(eviDir, 'frame_continuity_report.json'), JSON.stringify(continuityReport, null, 2));

        // Resolve Report
        const stubCount = renderShots.filter(s => s.templateId === "STUB_TEMPLATE").length;
        const resolveReport = {
            shotCount: renderShots.length,
            templateHitRate: (renderShots.length - stubCount) / renderShots.length,
            durationPlanSeconds: currentFrame / FPS,
            totalFrames: currentFrame,
            passed: stubCount === 0 && continuityReport.continuityVerified
        };
        fs.writeFileSync(path.join(eviDir, 'resolve_report.json'), JSON.stringify(resolveReport, null, 2));
        console.log(`Evidence package generated in ${eviDir}`);
    }

    return outputPath;
}

const input = process.argv[2];
const output = process.argv[3];
const evi = process.argv[4]; // Optional evidence dir
if (input && output) {
    compile(input, output, evi);
} else {
    console.log("Usage: node shot_to_render_plan.js <input.shot.json> <output.render_plan.json> [evidence_dir]");
}
