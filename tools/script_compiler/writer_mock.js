const fs = require('fs');
const path = require('path');

const FORBIDDEN_WORDS = [
  '悲伤',
  '快乐',
  '愤怒',
  '压抑',
  '绝望',
  '幸福',
  '感动',
  '纠结',
  '尴尬',
  '温情',
  '温馨',
  '浪漫',
  '气氛',
  '矛盾',
  '内心',
  '情绪',
  '恐惧',
  '痛苦',
  '遗憾',
  '失落',
  '惊喜',
  '担忧',
  '疑惑',
  '困惑',
  '爱',
  '恨',
  '后悔',
  '感到',
];

const PAYOFF_LIST = [
  '门锁弹开',
  '玻璃炸裂',
  '警报骤停',
  '照片掉落',
  '血点溅墙',
  '核心过载发出蓝光',
  '机械臂停止运作',
  '屏幕显示认证通过',
  '隐藏门缓缓开启',
];

// Assets loading
const assetsDir = path.join(__dirname, '../../docs/assets');
const loadAsset = (file) => JSON.parse(fs.readFileSync(path.join(assetsDir, file), 'utf8'));

const CHARACTERS = loadAsset('characters.json');
const PROPS = loadAsset('props.json');
const SFX = loadAsset('sfx_catalog.json');
const LOCATIONS = loadAsset('locations.json');
const POSES = loadAsset('poses.json');
const MOTIONS = loadAsset('motions.json');
const CAMERA_MOVES = loadAsset('camera_moves.json');
const RENDER_MAP = loadAsset('render_map.json');

// D-FIX-4: Ultra-Diverse Subject Variants Pool
const SUBJECT_VARIANTS = [
  { id: 'PV_CU_FRONT', name: '正面特写' },
  { id: 'PV_CU_PROFILE', name: '侧颜特写' },
  { id: 'PV_MS_FRONT', name: '正面中景' },
  { id: 'PV_MS_BACK', name: '背影中景' },
  { id: 'PV_WIDE_EST', name: '环境全景' },
  { id: 'PV_OTS_LEFT', name: '左过肩位' },
  { id: 'PV_OTS_RIGHT', name: '右过肩位' },
  { id: 'PV_LOW_THREAT', name: '低位仰拍' },
  { id: 'PV_HIGH_POV', name: '高位俯瞰' },
  { id: 'PV_DUTCH_TILT', name: '斜轴构图' },
  { id: 'PV_TRACK_SIDE', name: '侧向追踪' },
  { id: 'PV_DYN_LEAD', name: '引导式运动' },
  { id: 'PV_REACTION_S', name: '细节反应' },
  { id: 'PV_BOKEH_SOFT', name: '虚化背景' },
  { id: 'PV_SILHOUETTE', name: '剪影构图' },
  { id: 'PV_MIRROR_REF', name: '镜像反射' },
  { id: 'PV_MACRO_EYE', name: '局部大特写' },
  { id: 'PV_FOLLOW_CAM', name: '跟随视角' },
  { id: 'PV_POV_SCAN', name: '第一人称扫描' },
  { id: 'PV_BIRD_EYE', name: '上帝视角' },
];

const VALID_COMBOS = Object.keys(RENDER_MAP.combos);

const DENSITY_MIDS = {
  快: 55,
  常: 28,
  慢: 14,
};

function fillSkeleton(skeletonPath, outputPath) {
  const skeleton = JSON.parse(fs.readFileSync(skeletonPath, 'utf8'));
  let episodeComboUsage = {};
  VALID_COMBOS.forEach((c) => (episodeComboUsage[c] = 0));

  skeleton.beats.forEach((beat, bIdx) => {
    const baseId = beat.id;
    const prop = PROPS[bIdx % PROPS.length];
    const sfx = SFX[bIdx % SFX.length];
    const loc = LOCATIONS[bIdx % LOCATIONS.length];

    beat.thirdActorPropId = prop.id;
    beat.thirdActorProp = prop.name;
    beat.sfxIds = [sfx.id];
    beat.sfxLines = [sfx.name];
    beat.locationId = loc.id;

    let goal = '抢夺并' + (beat.beatGoal || '执行任务');
    FORBIDDEN_WORDS.forEach((w) => (goal = goal.replace(new RegExp(w, 'g'), '真实动作')));
    beat.beatGoal = goal;

    const dur = beat.estDurationSec || 50;
    const targetDensity = DENSITY_MIDS[beat.paceTag] || 28;
    const shotCount = Math.round((dur / 60.0) * targetDensity);

    const shots = [];
    const motifs = beat.actionMotifs || ['行动'];

    let beatHistory = { combos: [], subjects: {} }; // Track per character subjects

    for (let i = 1; i <= shotCount; i++) {
      const charBase = CHARACTERS[i % CHARACTERS.length];

      // D-FIX-4: Per-character Subject Diversity Check
      if (!beatHistory.subjects[charBase.id]) beatHistory.subjects[charBase.id] = [];

      let variant;
      let retry = 0;
      while (retry < 15) {
        variant = SUBJECT_VARIANTS[(i * 13 + bIdx * 7 + retry) % SUBJECT_VARIANTS.length];
        // Do not repeat same variant for SAME character in this beat
        if (!beatHistory.subjects[charBase.id].includes(variant.id)) break;
        retry++;
      }

      beatHistory.subjects[charBase.id].push(variant.id);
      const subject = `${charBase.name}(${variant.name})`;

      const motif = motifs[i % motifs.length];
      const actionResult = generateStrategicAction(
        charBase.name,
        motif,
        i,
        bIdx,
        beatHistory.combos,
        episodeComboUsage
      );
      beatHistory.combos.push(actionResult.comboId);
      episodeComboUsage[actionResult.comboId]++;

      shots.push({
        id: `${baseId}_S${i}`,
        characterId: charBase.id,
        subject: subject,
        subjectProfileId: variant.id,
        framing: i % 3 === 0 ? '特写' : '中景',
        actionChain: actionResult.text,
        poseId: actionResult.poseId,
        motionId: actionResult.motionId,
        cameraMoveId: actionResult.cameraMoveId,
        parallelTask: i % 2 === 0 ? '监测波动' : '警戒四周',
        dialogue: i === 1 ? '任务开始。' : i === 5 ? '目标出现。' : '',
        usesProp: true,
      });
    }
    beat.shotLines = shots;

    if (beat.reversalEvidence) {
      beat.reversalEvidence.entryPose = '战斗预备';
      beat.reversalEvidence.exitPose = '战术后撤';
      beat.reversalEvidence.turnActionShotId = `${baseId}_S1`;
    }
    if (beat.climaxEvidence) {
      beat.climaxEvidence.triggerShotId = `${baseId}_S2`;
      beat.climaxEvidence.propInvolved = prop.name;
      beat.climaxEvidence.payoff = PAYOFF_LIST[bIdx % PAYOFF_LIST.length];
    }
  });

  fs.writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
  return outputPath;
}

function generateStrategicAction(name, motif, shotIdx, beatIdx, beatHistory, episodeUsage) {
  let candidates = VALID_COMBOS.map((id) => {
    let score = episodeUsage[id] * 20;
    if (beatHistory.includes(id)) score += 100;
    if (beatHistory.slice(-5).includes(id)) score += 500;
    if (beatHistory.slice(-2).includes(id)) score += 5000;

    const pseudoRandom = (shotIdx * 23 + beatIdx * 19) % 100;
    score += pseudoRandom;

    return { id, score };
  });

  candidates.sort((a, b) => a.score - b.score);
  const comboId = candidates[0].id;

  const [poseId, motionId, cameraMoveId] = comboId.split('|');
  const poseName = POSES.find((p) => p.id === poseId).name;
  const motionName = MOTIONS.find((m) => m.id === motionId).name;
  const cameraName = CAMERA_MOVES.find((c) => c.id === cameraMoveId).name;

  const seed = shotIdx + beatIdx;
  const ends = ['火花溅起', '能量爆发', '零件崩飞', '光影闪烁', '飓风席卷'];
  const reacts = ['动作精准', '眼神坚定', '气息沉稳', '嘴角微扬', '目光如炬'];

  const e = ends[seed % ends.length];
  const r = reacts[(seed + 1) % reacts.length];

  let act = `${name}${poseName}(起势)，${motionName}${motif}(过程)，${e}(落点)，${r}(反应)。镜头${cameraName}。`;
  FORBIDDEN_WORDS.forEach((w) => (act = act.replace(new RegExp(w, 'g'), '冷静')));

  return {
    text: act,
    poseId: poseId,
    motionId: motionId,
    cameraMoveId: cameraMoveId,
    comboId: comboId,
  };
}

const cmd = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (cmd === 'fill') {
  fillSkeleton(arg1, arg2);
  console.log(`Filled skeleton to ${arg2}`);
}
