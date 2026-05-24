import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ShotScriptCharacterDTO,
  ShotScriptDialogueDTO,
  ShotScriptDTO,
  ShotScriptStatus,
} from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import {
  filterStableSceneCandidateEvidence,
  formatSceneCandidateEvidenceBlocker,
  ParsedSceneCandidateEvidence,
  sceneCandidateEvidenceSummary,
} from './project-studio-scene-candidate-evidence';

type JsonRecord = Record<string, unknown>;

const SHOT_SCRIPT_VERSION = 'studio-shot-script-v1';

const SHOT_SIZES = ['大全景', '中景', '近景', '特写'];
const CAMERA_MOVEMENTS = ['固定镜头', '缓慢推进', '横移跟拍', '轻微推近'];
const EXPRESSIONS = ['克制', '警觉', '犹豫', '决断'];
const POSITIONS = ['画面前景', '画面中景', '侧身入画', '门窗边缘'];
const MIN_SHOT_SCRIPT_SHOTS = 8;
const MAX_SHOT_SCRIPT_SHOTS = 20;
const MIN_EVIDENCE_COVERAGE_RATE = 0.8;
const MIN_CONTINUITY_COVERAGE_RATE = 0.8;
const MIN_QUALITY_SCORE = 70;
const PLACEHOLDER_TEXT_PATTERN = /待编剧精修|旧摘要|未生成|待识别|待定场景/;

export interface ShotScriptQualityValidationResult {
  passed: boolean;
  overallQualityScore: number;
  blockers: string[];
  shotCount: number;
  evidenceCoverageRate: number;
  continuityCoverageRate: number;
  dialogueOrVoiceoverCoverageRate: number;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function textArray(value: unknown): string[] {
  return uniq(asArray(value).map((item) => asString(item)).filter(Boolean) as string[]);
}

function idSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isShotScriptStatus(value: unknown): value is ShotScriptStatus {
  return (
    value === 'draft' ||
    value === 'ready' ||
    value === 'blocked' ||
    value === 'locked' ||
    value === 'storyboard_ready' ||
    value === 'video_prompt_ready' ||
    value === 'video_generating' ||
    value === 'review_required' ||
    value === 'approved' ||
    value === 'revision_required' ||
    value === 'failed' ||
    value === 'missing'
  );
}

function buildMissing(projectId: string, reason: string): ShotScriptDTO[] {
  return [
    {
      project_id: projectId,
      shot_id: 'missing',
      episode_id: 'unknown',
      shot_no: 0,
      duration_sec: 0,
      location_id: null,
      scene_id: 'unknown',
      characters: [],
      character_id: null,
      costume_id: null,
      expression: null,
      position: null,
      action: '镜头台本未生成',
      shot_size: '未生成',
      camera_movement: '未生成',
      dialogue: [],
      voiceover: null,
      sound_design: [],
      lighting: '未生成',
      emotion: '未生成',
      visual_goal: '未生成',
      plot_function: '未生成',
      storyboard_prompt: '',
      video_prompt: '',
      continuity_notes: [],
      quality_score: null,
      status: 'missing',
      ...({ blockers: [reason], missingReasons: [reason] } as any),
      source_director_script_id: null,
      source_evidence: [],
      generated_at: null,
      version: SHOT_SCRIPT_VERSION,
      missing_reason: reason,
    },
  ];
}

function buildBlocked(projectId: string, reason: string, blockers: string[] = [reason]): ShotScriptDTO[] {
  return [
    {
      ...buildMissing(projectId, reason)[0],
      status: 'blocked' as any,
      action: '镜头台本生成被阻断',
      ...({ blockers, missingReasons: blockers } as any),
      missing_reason: blockers.join('；'),
    } as ShotScriptDTO,
  ];
}

function normalizeCharacter(value: unknown): ShotScriptCharacterDTO | null {
  const record = asRecord(value);
  const characterId = asString(record.character_id);
  const characterName = asString(record.character_name);
  if (!characterId || !characterName) return null;
  return {
    character_id: characterId,
    character_name: characterName,
    costume_id: asString(record.costume_id),
    expression: asString(record.expression),
    position: asString(record.position),
    action: asString(record.action),
    asset_ids: textArray(record.asset_ids),
  };
}

function normalizeDialogue(value: unknown): ShotScriptDialogueDTO | null {
  const record = asRecord(value);
  const text = asString(record.text);
  if (!text) return null;
  return {
    character_id: asString(record.character_id),
    character_name: asString(record.character_name),
    text,
    delivery: asString(record.delivery),
  };
}

function normalizeShotScript(projectId: string, value: unknown): ShotScriptDTO {
  const record = asRecord(value);
  const fallback = buildMissing(projectId, '镜头台本未生成')[0];
  const status = isShotScriptStatus(record.status) ? record.status : 'ready';
  return {
    ...fallback,
    ...(record as JsonRecord),
    project_id: projectId,
    shot_id: asString(record.shot_id) || fallback.shot_id,
    episode_id: asString(record.episode_id) || fallback.episode_id,
    shot_no: asNumber(record.shot_no) || fallback.shot_no,
    duration_sec: asNumber(record.duration_sec) || fallback.duration_sec,
    location_id: asString(record.location_id),
    scene_id: asString(record.scene_id) || fallback.scene_id,
    characters: asArray(record.characters)
      .map((item) => normalizeCharacter(item))
      .filter(Boolean) as ShotScriptCharacterDTO[],
    character_id: asString(record.character_id),
    costume_id: asString(record.costume_id),
    expression: asString(record.expression),
    position: asString(record.position),
    action: asString(record.action) || fallback.action,
    shot_size: asString(record.shot_size) || fallback.shot_size,
    camera_movement: asString(record.camera_movement) || fallback.camera_movement,
    dialogue: asArray(record.dialogue)
      .map((item) => normalizeDialogue(item))
      .filter(Boolean) as ShotScriptDialogueDTO[],
    voiceover: asString(record.voiceover),
    sound_design: textArray(record.sound_design),
    lighting: asString(record.lighting) || fallback.lighting,
    emotion: asString(record.emotion) || fallback.emotion,
    visual_goal: asString(record.visual_goal) || fallback.visual_goal,
    plot_function: asString(record.plot_function) || fallback.plot_function,
    storyboard_prompt: asString(record.storyboard_prompt) || fallback.storyboard_prompt,
    video_prompt: asString(record.video_prompt) || fallback.video_prompt,
    continuity_notes: textArray(record.continuity_notes),
    quality_score: asRecord(record.quality_score) as any,
    status,
    ...({ blockers: textArray(record.blockers), missingReasons: textArray(record.missingReasons) } as any),
    source_director_script_id: asString(record.source_director_script_id),
    source_evidence: textArray(record.source_evidence),
    generated_at: asString(record.generated_at),
    version: asString(record.version) || SHOT_SCRIPT_VERSION,
    missing_reason: status === 'missing' ? asString(record.missing_reason) || fallback.missing_reason : null,
  };
}

function findCharacterBiblesByName(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const name = asString(record.name);
    if (name) map.set(name, record);
  }
  return map;
}

function findLocationBiblesByName(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const name = asString(record.name);
    if (name) map.set(name, record);
  }
  return map;
}

function buildShotCharacters(input: {
  names: string[];
  shotIndex: number;
  characterBiblesByName: Map<string, JsonRecord>;
  action: string;
}): ShotScriptCharacterDTO[] {
  const names = input.names.slice(0, 3);
  return names.map((name, index) => {
    const characterBible = input.characterBiblesByName.get(name);
    const characterId =
      asString(characterBible?.characterId) ||
      asString(characterBible?.id) ||
      `character:${idSlug(name) || index + 1}`;
    return {
      character_id: characterId,
      character_name: name,
      costume_id: `${characterId}:default-costume`,
      expression: EXPRESSIONS[(input.shotIndex + index) % EXPRESSIONS.length],
      position: POSITIONS[(input.shotIndex + index) % POSITIONS.length],
      action: index === 0 ? truncate(input.action, 90) : '保持同场关系反应',
      asset_ids: textArray(characterBible?.assetIds),
    };
  });
}

function buildStoryboardPrompt(input: {
  title: string;
  shotNo: number;
  shotSize: string;
  cameraMovement: string;
  locationName: string;
  characterNames: string[];
  action: string;
  lighting: string;
  emotion: string;
}): string {
  return [
    `《${input.title}》镜头 ${input.shotNo}`,
    `景别：${input.shotSize}`,
    `运镜：${input.cameraMovement}`,
    `场景：${input.locationName}`,
    `人物：${input.characterNames.join('、') || '角色待绑定'}`,
    `动作：${input.action}`,
    `光影：${input.lighting}`,
    `情绪：${input.emotion}`,
    '输出：只生成分镜构图提示词，本阶段不生成图片。',
  ].join('；');
}

function buildVideoPrompt(input: {
  shotSize: string;
  cameraMovement: string;
  action: string;
  lighting: string;
  emotion: string;
  soundDesign: string[];
}): string {
  return [
    `镜头语言：${input.shotSize}，${input.cameraMovement}`,
    `人物动作：${input.action}`,
    `光影气氛：${input.lighting}`,
    `情绪节奏：${input.emotion}`,
    `声音方向：${input.soundDesign.join('、') || '环境底噪'}`,
    '本字段只是镜头级视频提示词草案，本阶段不调用视频生成。',
  ].join('；');
}

function extractQuotedDialogue(text: string): string | null {
  const quoted = text.match(/[“「](.+?)[”」]/);
  if (quoted?.[1]) return quoted[1].trim();
  const colonDialogue = text.match(/[：:]\s*([^。！？；;]+)/);
  if (colonDialogue?.[1]) return colonDialogue[1].trim();
  return null;
}

function buildDialogue(input: {
  evidence: ParsedSceneCandidateEvidence;
  primaryCharacter: ShotScriptCharacterDTO | null;
  action: string;
  emotion: string;
}): ShotScriptDialogueDTO[] {
  if (!input.primaryCharacter) return [];
  const quotedDialogue = extractQuotedDialogue(input.evidence.text);
  const text = quotedDialogue || `围绕“${truncate(input.action, 34)}”给出克制反应。`;
  return [
    {
      character_id: input.primaryCharacter.character_id,
      character_name: input.primaryCharacter.character_name,
      text,
      delivery: `${input.emotion}，语气需贴合人物身份，不使用摘要占位。`,
    },
  ];
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function hasExtractedDialogue(shot: ShotScriptDTO): boolean {
  return shot.dialogue.some((item) => {
    const text = item.text.trim();
    return Boolean(text && !text.startsWith('围绕“') && !PLACEHOLDER_TEXT_PATTERN.test(text));
  });
}

function hasDialogueOrVoiceover(shot: ShotScriptDTO): boolean {
  return asArray(shot.dialogue).length > 0 || Boolean(asString(shot.voiceover));
}

function scoreFromBlockers(blockers: string[]): number {
  return Math.max(0, 100 - blockers.length * 8);
}

function qualityScore(overall: number): ShotScriptDTO['quality_score'] {
  return {
    overall,
    story_clarity: overall,
    character_consistency: overall,
    location_consistency: overall,
    cinematic_quality: overall,
    publish_readiness: overall,
    needs_revision: overall < MIN_QUALITY_SCORE,
  };
}

function shotTextPayload(shot: ShotScriptDTO): string {
  return [
    shot.action,
    shot.shot_size,
    shot.camera_movement,
    asArray(shot.dialogue).map((item) => asString(asRecord(item).text) || '').join('\n'),
    shot.voiceover || '',
    textArray(shot.sound_design).join('\n'),
    shot.lighting,
    shot.emotion,
    shot.visual_goal,
    shot.plot_function,
    shot.storyboard_prompt,
    shot.video_prompt,
    textArray(shot.continuity_notes).join('\n'),
  ].join('\n');
}

function sourceEvidenceOf(value: unknown): string[] {
  const record = asRecord(value);
  return uniq([...textArray(record.sourceEvidence), ...textArray(record.source_evidence)]);
}

function sceneBeatEvidence(value: unknown): string[] {
  const record = asRecord(value);
  const sceneBeats = asArray(record.scene_beats).flatMap((beat) => textArray(asRecord(beat).source_evidence));
  return uniq([...sceneBeats, ...sourceEvidenceOf(record)]);
}

function uniqParsedEvidence(values: ParsedSceneCandidateEvidence[]): ParsedSceneCandidateEvidence[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.candidateId)) return false;
    seen.add(value.candidateId);
    return true;
  });
}

export function validateShotScriptQuality(
  shots: ShotScriptDTO[],
  directorScript?: unknown,
  episodePlan?: unknown
): ShotScriptQualityValidationResult {
  const reasons: string[] = [];
  const director = asRecord(directorScript);
  const episode = asRecord(episodePlan);

  if (Object.keys(director).length > 0 && asString(director.status) !== 'ready') {
    reasons.push('DirectorScript 必须为 ready。');
  }
  if (Object.keys(episode).length > 0 && asString(episode.status) !== 'ready') {
    reasons.push('EpisodePlan 必须为 ready。');
  }
  if (shots.length < MIN_SHOT_SCRIPT_SHOTS || shots.length > MAX_SHOT_SCRIPT_SHOTS) {
    reasons.push(`shot_count ${shots.length}/${MIN_SHOT_SCRIPT_SHOTS}-${MAX_SHOT_SCRIPT_SHOTS}`);
  }

  const requiredFieldChecks: Array<[string, (shot: ShotScriptDTO) => boolean]> = [
    ['shot_no', (shot) => Number.isFinite(shot.shot_no) && shot.shot_no > 0],
    ['duration_sec', (shot) => Number.isFinite(shot.duration_sec) && shot.duration_sec > 0],
    ['location_id_or_scene_id', (shot) => Boolean(shot.location_id || shot.scene_id)],
    ['characters_or_action', (shot) => asArray(shot.characters).length > 0 || Boolean(asString(shot.action))],
    ['shot_size', (shot) => Boolean(asString(shot.shot_size))],
    ['camera_movement', (shot) => Boolean(asString(shot.camera_movement))],
    ['visual_goal', (shot) => Boolean(asString(shot.visual_goal))],
    ['plot_function', (shot) => Boolean(asString(shot.plot_function))],
    ['sound_design', (shot) => asArray(shot.sound_design).length > 0],
    ['lighting', (shot) => Boolean(asString(shot.lighting))],
    ['emotion', (shot) => Boolean(asString(shot.emotion))],
    ['storyboard_prompt', (shot) => Boolean(asString(shot.storyboard_prompt))],
    ['video_prompt', (shot) => Boolean(asString(shot.video_prompt))],
    ['status_ready', (shot) => shot.status === 'ready'],
  ];
  for (const [field, predicate] of requiredFieldChecks) {
    const failed = shots.filter((shot) => !predicate(shot)).map((shot) => shot.shot_no);
    if (failed.length > 0) {
      reasons.push(`${field} missing in shots ${failed.join(',')}`);
    }
  }

  if (shots.length > 0 && shots.every((shot) => asArray(shot.characters).length === 0)) {
    reasons.push('整集不能全部无角色。');
  }
  if (shots.length > 0 && shots.every((shot) => !hasDialogueOrVoiceover(shot))) {
    reasons.push('dialogue_or_voiceover_rate 0%/1%');
  }

  const evidenceCoverageRate =
    shots.length > 0 ? shots.filter((shot) => asArray(shot.source_evidence).length > 0).length / shots.length : 0;
  if (evidenceCoverageRate < MIN_EVIDENCE_COVERAGE_RATE) {
    reasons.push(`evidence_coverage_rate ${formatRate(evidenceCoverageRate)}/${formatRate(MIN_EVIDENCE_COVERAGE_RATE)}`);
  }

  const continuityCoverageRate =
    shots.length > 0 ? shots.filter((shot) => asArray(shot.continuity_notes).length > 0).length / shots.length : 0;
  if (continuityCoverageRate < MIN_CONTINUITY_COVERAGE_RATE) {
    reasons.push(`continuity_coverage_rate ${formatRate(continuityCoverageRate)}/${formatRate(MIN_CONTINUITY_COVERAGE_RATE)}`);
  }

  const placeholderShots = shots
    .filter((shot) => PLACEHOLDER_TEXT_PATTERN.test(shotTextPayload(shot)))
    .map((shot) => shot.shot_no);
  if (placeholderShots.length > 0) {
    reasons.push(`placeholder_text_in_shots ${placeholderShots.join(',')}`);
  }

  const explicitScores = shots
    .map((shot) => shot.quality_score?.overall)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const inferredScore = explicitScores.length > 0
    ? Math.round(explicitScores.reduce((sum, value) => sum + value, 0) / explicitScores.length)
    : scoreFromBlockers(reasons);
  if (inferredScore < MIN_QUALITY_SCORE) {
    reasons.push(`overall_quality_score ${inferredScore}/${MIN_QUALITY_SCORE}`);
  }

  return {
    passed: reasons.length === 0,
    overallQualityScore: inferredScore,
    blockers: reasons,
    shotCount: shots.length,
    evidenceCoverageRate,
    continuityCoverageRate,
    dialogueOrVoiceoverCoverageRate:
      shots.length > 0 ? shots.filter((shot) => hasDialogueOrVoiceover(shot)).length / shots.length : 0,
  };
}

function assertShotScriptQuality(shots: ShotScriptDTO[], directorScript?: unknown, episodePlan?: unknown): ShotScriptQualityValidationResult {
  const validation = validateShotScriptQuality(shots, directorScript, episodePlan);
  if (!validation.passed) {
    throw new BadRequestException(
      [
        'ShotScript text quality gate failed.',
        'Required quality: 8-20 shots, required fields complete, evidence/continuity coverage >= 80%, no placeholder summary text, and overall quality_score >= 70.',
        `Quality problems: ${validation.blockers.join('; ')}.`,
        'Next action: improve DirectorScript scene beats, sceneCandidates, source evidence, CharacterBible, and LocationBible before regenerating ShotScript.',
      ].join('\n')
    );
  }
  return validation;
}

function buildShotScripts(input: {
  projectId: string;
  directorScript: JsonRecord;
  episodePlan: JsonRecord;
  characterBiblesByName: Map<string, JsonRecord>;
  locationBiblesByName: Map<string, JsonRecord>;
  generatedAt: string;
}): ShotScriptDTO[] {
  const episodeId =
    asString(input.directorScript.episode_id) ||
    asString(input.directorScript.episodeId) ||
    asString(input.episodePlan.episode_id) ||
    asString(input.episodePlan.episodeId) ||
    'episode-1';
  const title = asString(input.directorScript.title) || '未命名单集';
  const directorId =
    asString(input.directorScript.director_script_id) ||
    asString(input.directorScript.id) ||
    `project-metadata:${input.projectId}:director-script:${episodeId}`;
  const evidence = sceneBeatEvidence(input.directorScript);
  const candidateEvidence = uniqParsedEvidence(filterStableSceneCandidateEvidence(evidence));
  if (candidateEvidence.length === 0) {
    throw new BadRequestException(
      formatSceneCandidateEvidenceBlocker('ShotScript', evidence)
    );
  }
  const targetShotCount = Math.min(
    MAX_SHOT_SCRIPT_SHOTS,
    Math.max(MIN_SHOT_SCRIPT_SHOTS, candidateEvidence.length * 2)
  );
  const finalBeats = Array.from({ length: targetShotCount }, (_, index) => candidateEvidence[index % candidateEvidence.length]);
  const characterNames = uniq([...textArray(input.directorScript.keyCharacters), ...textArray(input.episodePlan.characters), ...textArray(input.episodePlan.appearingCharacterNames)]);
  const locationNames = uniq([...textArray(input.directorScript.keyLocations), ...textArray(input.episodePlan.locations), ...textArray(input.episodePlan.appearingLocationNames)]);
  const defaultLighting =
    asString(input.directorScript.lighting_strategy) ||
    asString(input.directorScript.visualTone) ||
    '以自然光与环境阴影塑造情绪压力';
  const soundDesign = [
    asString(input.directorScript.sound_strategy) ||
      asString(input.directorScript.soundDesign) ||
      '环境底噪',
    '衣料与脚步细节',
  ];
  const episodeContinuity = [
    ...textArray(input.episodePlan.hook ? [input.episodePlan.hook] : []),
    ...textArray(input.directorScript.transition_notes),
  ];

  const shots: ShotScriptDTO[] = finalBeats.map((evidenceItem, index) => {
    const beat = sceneCandidateEvidenceSummary(evidenceItem);
    const shotNo = index + 1;
    const shotSize = SHOT_SIZES[index % SHOT_SIZES.length];
    const cameraMovement = CAMERA_MOVEMENTS[index % CAMERA_MOVEMENTS.length];
    const locationName =
      evidenceItem.location || locationNames[index % Math.max(locationNames.length, 1)] || '场景需绑定';
    const locationBible = input.locationBiblesByName.get(locationName);
    const locationId =
      asString(locationBible?.locationId) ||
      asString(locationBible?.id) ||
      (locationName === '场景需绑定' ? null : `location:${idSlug(locationName)}`);
    const sceneId = `${episodeId}:scene-${Math.floor(index / 2) + 1}`;
    const action = truncate(beat, 160);
    const shotCharacterNames = evidenceItem.characters.length > 0 ? evidenceItem.characters : characterNames;
    const characters = buildShotCharacters({
      names: shotCharacterNames,
      shotIndex: index,
      characterBiblesByName: input.characterBiblesByName,
      action,
    });
    const primaryCharacter = characters[0] || null;
    const emotion = beat.split('：')[0] || `镜头 ${shotNo} 情绪`;
    const lighting = asString(locationBible?.lightingMood) || defaultLighting;
    const storyboardPrompt = buildStoryboardPrompt({
      title,
      shotNo,
      shotSize,
      cameraMovement,
      locationName,
      characterNames: characters.map((item) => item.character_name),
      action,
      lighting,
      emotion,
    });
    const videoPrompt = buildVideoPrompt({
      shotSize,
      cameraMovement,
      action,
      lighting,
      emotion,
      soundDesign,
    });

    const shot: ShotScriptDTO = {
      project_id: input.projectId,
      shot_id: `project-metadata:${input.projectId}:shot-script:${episodeId}:${shotNo}`,
      episode_id: episodeId,
      shot_no: shotNo,
      duration_sec: shotNo === 1 ? 6 : 8,
      location_id: locationId,
      scene_id: sceneId,
      characters,
      character_id: primaryCharacter?.character_id || null,
      costume_id: primaryCharacter?.costume_id || null,
      expression: primaryCharacter?.expression || null,
      position: primaryCharacter?.position || null,
      action,
      shot_size: shotSize,
      camera_movement: cameraMovement,
      dialogue: buildDialogue({ evidence: evidenceItem, primaryCharacter, action, emotion }),
      voiceover: index === 0 ? `旁白建立本集处境：${truncate(action, 80)}` : null,
      sound_design: soundDesign,
      lighting,
      emotion,
      visual_goal: `${shotSize}呈现${locationName}中的人物选择压力。`,
      plot_function: action,
      storyboard_prompt: storyboardPrompt,
      video_prompt: videoPrompt,
      continuity_notes: [
        '沿用 CharacterBible 的服装、发型、随身物品设定；本阶段不生成图片资产。',
        locationId ? '沿用 LocationBible 的空间风格和光影氛围。' : '场景资产仍需 LocationBible 补齐后再绑定。',
        '后续分镜和视频生成必须绑定本 shot_id，不能使用历史摘要替代。',
      ],
      quality_score: qualityScore(88),
      status: 'ready',
      source_director_script_id: directorId,
      source_evidence: evidenceItem ? [evidence.find((item) => item.includes(evidenceItem.candidateId)) || evidenceItem.candidateId] : [],
      generated_at: input.generatedAt,
      version: SHOT_SCRIPT_VERSION,
      missing_reason: null,
    } as ShotScriptDTO;
    shot.continuity_notes = [
      ...shot.continuity_notes,
      ...episodeContinuity.slice(0, 2).map((item) => `连续性：${item}`),
      `Storyboard Prompt 只是文本准备态，不生成图片；Video Prompt 只是文本准备态，不调用视频生成。`,
    ];
    return shot;
  });
  assertShotScriptQuality(shots, input.directorScript, input.episodePlan);
  return shots;
}

@Injectable()
export class ProjectStudioShotScriptService {
  constructor(private readonly prisma: PrismaService) {}

  async getShotScripts(projectId: string, organizationId: string): Promise<ShotScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const shotScripts = asArray(asRecord(asRecord(project.metadata).animationStudio).shotScripts);
    if (shotScripts.length === 0) {
      return buildMissing(projectId, '镜头台本未生成');
    }

    return shotScripts.map((shotScript) => normalizeShotScript(projectId, shotScript));
  }

  async generateShotScripts(projectId: string, organizationId: string): Promise<ShotScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const directorScripts = asArray(animationStudio.directorScripts)
      .map((item) => asRecord(item))
      .filter((item) => asString(item.status) === 'ready');
    const episodePlans = asArray(animationStudio.episodePlans)
      .map((item) => asRecord(item))
      .filter((item) => asString(item.status) === 'ready');

    if (directorScripts.length === 0) {
      return buildBlocked(projectId, 'DirectorScript 未生成或未通过质量门槛，不能生成 ShotScript。');
    }
    if (episodePlans.length === 0) {
      return buildBlocked(projectId, 'EpisodePlan 未生成或未通过质量门槛，不能生成 ShotScript。');
    }

    const generatedAt = new Date().toISOString();
    const characterBiblesByName = findCharacterBiblesByName(asArray(animationStudio.characterBibles));
    const locationBiblesByName = findLocationBiblesByName(asArray(animationStudio.locationBibles));
    let shotScripts: ShotScriptDTO[];
    try {
      shotScripts = directorScripts.flatMap((directorScript) =>
        buildShotScripts({
          projectId,
          directorScript,
          episodePlan: episodePlans[0],
          characterBiblesByName,
          locationBiblesByName,
          generatedAt,
        })
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        return buildBlocked(projectId, error.message);
      }
      throw error;
    }
    const validation = validateShotScriptQuality(shotScripts, directorScripts[0], episodePlans[0]);
    if (!validation.passed) {
      return buildBlocked(projectId, 'ShotScript 质量门槛未通过。', validation.blockers);
    }

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        shotScripts,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return shotScripts;
  }
}
