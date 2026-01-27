const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// --- Configuration & Constants (SSOT-derived) ---
const ajv = new Ajv({ allErrors: true });

// Check environment for Evidence Path
const EVI_PATH = process.env.EVI || '.';
const SCHEMA_PATH = path.join(__dirname, '../../docs/script_spec/shot_spec.schema.json');
const ASSETS_DIR = path.join(__dirname, '../../docs/assets');

// Load Assets for ID verification
const loadAssetIds = (file) => {
    const p = path.join(ASSETS_DIR, file);
    if (!fs.existsSync(p)) return new Set();
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return new Set(data.map(i => i.id));
};

const VALID_CHAR_IDS = loadAssetIds('characters.json');
const VALID_PROP_IDS = loadAssetIds('props.json');
const VALID_SFX_IDS = loadAssetIds('sfx_catalog.json');
const VALID_LOC_IDS = loadAssetIds('locations.json');
const VALID_POSE_IDS = loadAssetIds('poses.json');
const VALID_MOTION_IDS = loadAssetIds('motions.json');
const VALID_CAM_IDS = loadAssetIds('camera_moves.json');

// Store mappings for consistency checks
const SFX_MAP = JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, 'sfx_catalog.json'), 'utf8')).reduce((acc, cur) => {
    acc[cur.id] = cur.name;
    return acc;
}, {});

const RENDER_MAP = JSON.parse(fs.readFileSync(path.join(ASSETS_DIR, 'render_map.json'), 'utf8'));
const RENDERABLE_POSES = new Set(Object.keys(RENDER_MAP.poses));
const RENDERABLE_MOTIONS = new Set(Object.keys(RENDER_MAP.motions));
const RENDERABLE_CAMERAS = new Set(Object.keys(RENDER_MAP.cameraMoves));
const VALID_COMBOS = new Set(Object.keys(RENDER_MAP.combos || {}));

// B0.1-4: Transition Tag Enum (redundant with Schema but good for specific error extraction)
const VALID_TRANSITIONS = ["声音匹配", "动作匹配", "光影匹配", "画面匹配", "物件匹配"];

// B0.1-5: Abstract Words (Extended)
const FORBIDDEN_ABSTRACT_WORDS = [
    // Emotion Nouns
    "悲伤", "快乐", "愤怒", "压抑", "绝望", "幸福", "感动",
    "纠结", "尴尬", "温情", "温馨", "浪漫", "气氛", "矛盾",
    "内心", "情绪", "恐惧", "痛苦", "遗憾", "失落", "惊喜",
    "担忧", "疑惑", "困惑", "爱", "恨", "后悔",
    // Process Verbs acting as abstract states
    "觉得", "感到", "认为", "以为", "想", "思考", "犹豫",
    // Patterns (simple inclusion check covers most)
    "关系", "心理"
];

// B0.1-1: Generic Prop Ban
const FORBIDDEN_PROP_WORDS = ["道具", "物品", "东西", "物体"];

// B0.1-2: Action Chain Strict Markers
const ACTION_MARKERS = ["(起势)", "(过程)", "(落点)", "(反应)"];

// B0.1-3: Beat Goal Verb Check (Regex for common verbs at start or part of goal)
// Simple heuristic: must contain at least one strong verb
const STRONG_VERBS = [
    "逼", "让", "抢", "夺", "压", "撕", "摔", "按", "推", "拉", "拽", "逼问",
    "追", "逃", "揭", "砸", "扇", "跪", "交出", "引爆", "封", "退", "击", "杀",
    "救", "挡", "抱", "吻", "咬", "踢", "抓", "扔", "烧", "埋"
];

const PLACEHOLDER_REGEX = /\[占位|TODO|TBD|\[核心道具\]|\[视觉奇观\]|\[待填充|\[待确定|\[主角\]|\[起势姿态\]|\[落点姿态\]|\[占位音效\]|\[待填充台词\]/;

function checkPlaceholder(val, path, errors, beatId, shotId) {
    if (typeof val === 'string' && PLACEHOLDER_REGEX.test(val)) {
        errors.push({
            ruleId: "NO_PLACEHOLDER_TOKEN",
            beatId,
            shotId,
            message: `Found placeholder in ${path}: "${val}"`
        });
    } else if (Array.isArray(val)) {
        val.forEach((item, i) => checkPlaceholder(item, `${path}[${i}]`, errors, beatId, shotId));
    } else if (val !== null && typeof val === 'object') {
        Object.keys(val).forEach(key => checkPlaceholder(val[key], `${path}.${key}`, errors, beatId, shotId));
    }
}


function lintShotSpec(filePath) {
    // 0. Load & Parse
    let content;
    try {
        content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return [{ ruleId: "JSON_VALID", message: `Invalid JSON: ${e.message}` }];
    }

    const errors = [];

    // B0.1-0: AJV Schema Validation
    if (fs.existsSync(SCHEMA_PATH)) {
        const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
        const validate = ajv.compile(schema);
        const valid = validate(content);
        if (!valid) {
            validate.errors.forEach(err => {
                errors.push({
                    ruleId: "JSON_SCHEMA_FAIL",
                    message: `${err.instancePath} ${err.message}`
                });
            });
            // Schema fail is P0 blocking, but we continue liniting logic if structure permits
        }
    } else {
        console.warn(`[WARN] Schema file not found at ${SCHEMA_PATH}`);
    }

    // Structure sanity check for logic lint
    if (!content.beats || !Array.isArray(content.beats)) {
        return errors; // Schema would have caught this
    }

    content.beats.forEach((beat, bIdx) => {
        const beatId = beat.id || `beat_${bIdx}`;

        // B0.1-3: Beat Goal Verb
        if (beat.beatGoal) {
            const hasVerb = STRONG_VERBS.some(v => beat.beatGoal.includes(v));
            if (!hasVerb) {
                errors.push({ ruleId: "BEAT_GOAL_VERB", beatId, message: `beatGoal must contain a strong verb (e.g., 逼, 抢, 摔). Found: "${beat.beatGoal}"` });
            }
            // Sanity check for abstract words in goal too?
            FORBIDDEN_ABSTRACT_WORDS.forEach(word => {
                if (beat.beatGoal.includes(word)) {
                    errors.push({ ruleId: "NO_ABSTRACT", beatId, message: `beatGoal contains abstract word: ${word}` });
                }
            });
        }

        // B0.1-1: Third Actor Prop
        if (!beat.thirdActorProp || beat.thirdActorProp.trim() === "") {
            errors.push({ ruleId: "PROP_REQ", beatId, message: "thirdActorProp must be present and non-empty" });
        } else {
            FORBIDDEN_PROP_WORDS.forEach(word => {
                if (beat.thirdActorProp.includes(word)) {
                    errors.push({ ruleId: "PROP_SPECIFIC", beatId, message: `thirdActorProp contains generic word: "${word}". Must be specific.` });
                }
            });
        }

        // B0.1-4: Transition Tag Enum
        if (beat.transitionTag && !VALID_TRANSITIONS.includes(beat.transitionTag)) {
            errors.push({ ruleId: "TRANSITION_ENUM", beatId, message: `Invalid transitionTag: "${beat.transitionTag}". Allowed: ${VALID_TRANSITIONS.join(', ')}` });
        }

        // B1.1-2: Reversal & Climax Evidence Check
        if (beat.reversalTag === true) {
            if (!beat.reversalEvidence) {
                errors.push({ ruleId: "REVERSAL_EVIDENCE_REQ", beatId, message: "reversalTag=true but reversalEvidence missing" });
            }
        }
        if (beat.climaxTag && beat.climaxTag !== null) {
            if (!beat.climaxEvidence) {
                errors.push({ ruleId: "CLIMAX_EVIDENCE_REQ", beatId, message: `climaxTag=${beat.climaxTag} but climaxEvidence missing` });
            }
        }

        if (beat.locationId && !VALID_LOC_IDS.has(beat.locationId)) {
            errors.push({ ruleId: "ASSET_ID_VALID", beatId, message: `Invalid locationId: "${beat.locationId}". Not found in locations.json.` });
        } else if (!beat.locationId) {
            errors.push({ ruleId: "ASSET_ID_MISSING", beatId, message: "Required locationId is missing." });
        }

        if (beat.thirdActorPropId && !VALID_PROP_IDS.has(beat.thirdActorPropId)) {
            errors.push({ ruleId: "ASSET_ID_VALID", beatId, message: `Invalid thirdActorPropId: "${beat.thirdActorPropId}". Not found in props.json.` });
        } else if (!beat.thirdActorPropId) {
            errors.push({ ruleId: "ASSET_ID_MISSING", beatId, message: "Required thirdActorPropId is missing." });
        }

        if (beat.sfxIds && Array.isArray(beat.sfxIds)) {
            beat.sfxIds.forEach((id, idx) => {
                if (!VALID_SFX_IDS.has(id)) {
                    errors.push({ ruleId: "ASSET_ID_VALID", beatId, message: `Invalid sfxId: "${id}". Not found in sfx_catalog.json.` });
                } else if (beat.sfxLines && beat.sfxLines[idx]) {
                    // Consistency check: sfxLines[idx] should match the name of sfxIds[idx]
                    const expectedName = SFX_MAP[id];
                    if (beat.sfxLines[idx] !== expectedName) {
                        errors.push({
                            ruleId: "SFX_CONSISTENCY",
                            beatId,
                            message: `SFX name mismatch: id "${id}" is "${expectedName}", but sfxLines[${idx}] says "${beat.sfxLines[idx]}"`
                        });
                    }
                }
            });
        } else {
            errors.push({ ruleId: "ASSET_ID_MISSING", beatId, message: "Required sfxIds is missing." });
        }

        // B1.2-1: Duration Field Requirement
        if (beat.estDurationSec === undefined || beat.estDurationSec === null) {
            errors.push({ ruleId: "DURATION_BEAT_REQ", beatId, message: "Missing estDurationSec in beat" });
        }

        if (beat.shotLines && Array.isArray(beat.shotLines)) {
            beat.shotLines.forEach((shot, sIdx) => {
                const shotId = shot.id || `${beatId}_s${sIdx}`;

                // B0.1-2: Action Chain Strict Markers
                if (shot.actionChain) {
                    const missingMarkers = ACTION_MARKERS.filter(m => !shot.actionChain.includes(m));
                    if (missingMarkers.length > 0) {
                        errors.push({ ruleId: "ACTION_CHAIN_STRUCT", beatId, shotId, message: `Missing ActionChain markers: ${missingMarkers.join(', ')}. Must have (起势)(过程)(落点)(反应)` });
                    }

                    // B0.1-5: Abstract Words Ban
                    FORBIDDEN_ABSTRACT_WORDS.forEach(word => {
                        if (shot.actionChain.includes(word)) {
                            errors.push({ ruleId: "NO_ABSTRACT", beatId, shotId, message: `actionChain contains abstract word: "${word}"` });
                        }
                    });
                }

                // B1.1-0: Standing Still Ban & Dialogue Length
                if (shot.dialogue && shot.dialogue.trim().length > 0) {
                    // Check 1: Dialogue Length
                    if (shot.dialogue.length > 15) {
                        errors.push({ ruleId: "DIALOGUE_LEN", beatId, shotId, message: `Dialogue too long (${shot.dialogue.length} > 15).` });
                    }
                    // Check 2: Parallel Task
                    if (!shot.parallelTask || shot.parallelTask.trim().length === 0) {
                        errors.push({ ruleId: "NO_ZHANZHUANG", beatId, shotId, message: "Dialogue exists but parallelTask is empty (Standing Still Ban)." });
                    }
                    // D2: Dialogue must have Pose & Motion
                    if (!shot.poseId || !shot.motionId) {
                        errors.push({ ruleId: "DIALOGUE_ACTION_REQ", beatId, shotId, message: "Dialogue exists but poseId or motionId is missing (D2 Rule)." });
                    }
                }

                // C0: Character ID Verification
                if (shot.characterId && !VALID_CHAR_IDS.has(shot.characterId)) {
                    errors.push({ ruleId: "ASSET_ID_VALID", beatId, shotId, message: `Invalid characterId: "${shot.characterId}". Not found in characters.json.` });
                } else if (!shot.characterId) {
                    errors.push({ ruleId: "ASSET_ID_MISSING", beatId, shotId, message: "Required characterId is missing in shot." });
                }

                // D2: Pose/Motion/Camera ID Verification \u0026 Renderability
                if (shot.poseId) {
                    if (!VALID_POSE_IDS.has(shot.poseId)) {
                        errors.push({ ruleId: "ASSET_ID_VALID", beatId, shotId, message: `Invalid poseId: "${shot.poseId}". Not found in poses.json.` });
                    } else if (!RENDERABLE_POSES.has(shot.poseId)) {
                        errors.push({ ruleId: "RENDER_RESOLVE_FAIL", beatId, shotId, message: `poseId "${shot.poseId}" exists but has no entry in render_map.json.` });
                    }
                }
                if (shot.motionId) {
                    if (!VALID_MOTION_IDS.has(shot.motionId)) {
                        errors.push({ ruleId: "ASSET_ID_VALID", beatId, shotId, message: `Invalid motionId: "${shot.motionId}". Not found in motions.json.` });
                    } else if (!RENDERABLE_MOTIONS.has(shot.motionId)) {
                        errors.push({ ruleId: "RENDER_RESOLVE_FAIL", beatId, shotId, message: `motionId "${shot.motionId}" exists but has no entry in render_map.json.` });
                    }
                }
                if (shot.cameraMoveId) {
                    if (!VALID_CAM_IDS.has(shot.cameraMoveId)) {
                        errors.push({ ruleId: "ASSET_ID_VALID", beatId, shotId, message: `Invalid cameraMoveId: "${shot.cameraMoveId}". Not found in camera_moves.json.` });
                    } else if (!RENDERABLE_CAMERAS.has(shot.cameraMoveId)) {
                        errors.push({ ruleId: "RENDER_RESOLVE_FAIL", beatId, shotId, message: `cameraMoveId "${shot.cameraMoveId}" exists but has no entry in render_map.json.` });
                    }
                }

                // D-Contract: Combo Validation for Dialogue Shots
                if (shot.dialogue && shot.dialogue.trim().length > 0) {
                    if (shot.poseId && shot.motionId && shot.cameraMoveId) {
                        const comboKey = `${shot.poseId}|${shot.motionId}|${shot.cameraMoveId}`;
                        if (!VALID_COMBOS.has(comboKey)) {
                            errors.push({
                                ruleId: "RENDER_COMBO_RESOLVE_FAIL",
                                beatId,
                                shotId,
                                message: `Combo key "${comboKey}" is not defined in render_map.combos. This combination cannot be rendered.`
                            });
                        }
                    } else {
                        // Covered by DIALOGUE_ACTION_REQ but reinforcing for consistency
                        errors.push({ ruleId: "DIALOGUE_ACTION_REQ", beatId, shotId, message: "Dialogue exists but structural action IDs (pose/motion/camera) are incomplete." });
                    }
                }

                // C1: Placeholder Check for the entire shot
                checkPlaceholder(shot, "shot", errors, beatId, shotId);
            });
        }

        // C1: Placeholder Check for the entire beat (including evidence/goals)
        checkPlaceholder(beat, "beat", errors, beatId);
    });

    // B1.2-1: Total Duration Consistency (±5s)
    if (content.episodeMeta && content.episodeMeta.durationSec) {
        const sumBeatSec = content.beats.reduce((sum, b) => sum + (b.estDurationSec || 0), 0);
        const diff = Math.abs(sumBeatSec - content.episodeMeta.durationSec);
        if (diff > 5) {
            errors.push({
                ruleId: "DURATION_SUM_MISMATCH",
                message: `Sum of beat estDurationSec (${sumBeatSec}s) mismatch with episodeMeta.durationSec (${content.episodeMeta.durationSec}s). Diff: ${diff}s (> 5s allowed)`
            });
        }
    } else {
        errors.push({ ruleId: "DURATION_META_MISSING", message: "episodeMeta.durationSec is missing or zero at root" });
    }

    return errors;
}

// --- Main Execution ---
const targetFile = process.argv[2];

// Regression Mode
if (!targetFile) {
    const exampleDir = path.join(__dirname, '../../docs/script_spec/examples');
    if (fs.existsSync(exampleDir)) {
        console.log("Running P0 Regression on examples...");
        const files = fs.readdirSync(exampleDir).filter(f => f.endsWith('.shot.json'));
        let hasFail = false;
        const regressionReport = [];

        files.forEach(f => {
            const errs = lintShotSpec(path.join(exampleDir, f));
            if (errs.length > 0) {
                console.error(`Example ${f} FAILED:`);
                errs.forEach(e => console.error(`  [${e.ruleId}] ${e.message}`));
                hasFail = true;
            } else {
                console.log(`Example ${f} PASSED.`);
            }
            regressionReport.push({ file: f, errors: errs });
        });

        if (hasFail) process.exit(1);
        process.exit(0);
    } else {
        console.error("No input file and no examples found.");
        process.exit(1);
    }
}

// Single File Lint
const violations = lintShotSpec(targetFile);

// B0.1-6: Output to Evidence
const reportJsonPath = path.join(EVI_PATH, 'lint_report.json');
const reportMdPath = path.join(EVI_PATH, 'lint_report.md');

const reportData = {
    targetFile: path.basename(targetFile),
    timestamp: new Date().toISOString(),
    violations
};

fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2));

let mdContent = `# P0 Lint Report\n\n**File**: ${path.basename(targetFile)}\n**Time**: ${reportData.timestamp}\n\n`;
if (violations.length > 0) {
    mdContent += "| Rule | Location | Message |\n|---|---|---|\n";
    violations.forEach(v => {
        mdContent += `| ${v.ruleId} | ${v.beatId || 'root'} ${v.shotId || ''} | ${v.message} |\n`;
    });
    mdContent += `\n**RESULT: FAILED (${violations.length} violations)**\n`;
} else {
    mdContent += "**RESULT: PASSED** ✅\n";
}
fs.writeFileSync(reportMdPath, mdContent);

console.log(`Lint Report written to ${EVI_PATH}`);
if (violations.length > 0) {
    console.error(`❌ P0 Lint FAILED with ${violations.length} violations.`);
    process.exit(1);
} else {
    console.log("✅ P0 Lint PASSED.");
    process.exit(0);
}
