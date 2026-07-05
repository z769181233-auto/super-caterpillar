import { Injectable, NotFoundException } from '@nestjs/common';
import { VideoPromptDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const VIDEO_PROMPT_VERSION = 'studio-video-prompt-v1';
const MIN_VIDEO_PROMPT_BINDING_RATE = 0.9;
const MIN_VIDEO_PROMPT_CONTINUITY_RATE = 0.9;
const MIN_VIDEO_PROMPT_QUALITY_SCORE = 70;
const VIDEO_PROMPT_PLACEHOLDER_PATTERN =
  /待定|未生成|旧摘要|待识别角色|景别待定|运镜待定|动作待定|画面目标待定|光影待定/;

export interface VideoPromptQualityValidationResult {
  passed: boolean;
  blockers: string[];
  promptCount: number;
  shotCoverageRate: number;
  storyboardBindingRate: number;
  characterBindingRate: number;
  locationBindingRate: number;
  continuityCoverageRate: number;
  qualityScore: number;
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

function characterNames(value: unknown): string[] {
  return uniq(
    asArray(value)
      .map((item) => asString(asRecord(item).character_name) || asString(asRecord(item).name))
      .filter(Boolean) as string[]
  );
}

function dialogueCue(value: unknown): string | null {
  const lines = asArray(value)
    .map((item) => {
      const record = asRecord(item);
      const text = asString(record.text);
      if (!text) return null;
      const name = asString(record.character_name);
      return name ? `${name}：${text}` : text;
    })
    .filter(Boolean) as string[];
  return lines.length > 0 ? truncate(lines.join(' / '), 220) : null;
}

function buildMissing(projectId: string, reason: string): VideoPromptDTO[] {
  return [
    {
      id: null,
      projectId,
      shotId: null,
      episodeId: null,
      shotNo: null,
      sceneId: null,
      locationId: null,
      status: 'missing',
      prompt: null,
      negativePrompt: null,
      durationSec: null,
      aspectRatio: null,
      cameraLanguage: null,
      characters: [],
      dialogueCue: null,
      soundCue: null,
      lightingCue: null,
      motionCue: null,
      sourceShotScriptId: null,
      sourceStoryboardAssetId: null,
      sourceStoryboardPrompt: null,
      continuityNotes: [],
      qualityScore: null,
      blockers: [],
      missingReasons: [reason],
      shotCoverageRate: null,
      storyboardBindingRate: null,
      characterBindingRate: null,
      locationBindingRate: null,
      continuityCoverageRate: null,
      generatedAt: null,
      version: VIDEO_PROMPT_VERSION,
      missingReason: reason,
    } as VideoPromptDTO,
  ];
}

function normalizeVideoPrompt(projectId: string, value: unknown): VideoPromptDTO {
  const record = asRecord(value);
  const fallback = buildMissing(projectId, '视频提示词未生成')[0];
  const status = asString(record.status);
  return {
    ...fallback,
    ...(record as JsonRecord),
    id: asString(record.id),
    projectId,
    shotId: asString(record.shotId),
    episodeId: asString(record.episodeId),
    shotNo: asNumber(record.shotNo),
    sceneId: asString(record.sceneId),
    locationId: asString(record.locationId),
    status:
      status === 'done' ||
      status === 'missing' ||
      status === 'running' ||
      status === 'failed' ||
      status === 'blocked'
        ? status
        : 'done',
    prompt: asString(record.prompt),
    negativePrompt: asString(record.negativePrompt),
    durationSec: asNumber(record.durationSec),
    aspectRatio: asString(record.aspectRatio),
    cameraLanguage: asString(record.cameraLanguage),
    characters: textArray(record.characters),
    dialogueCue: asString(record.dialogueCue),
    soundCue: asString(record.soundCue),
    lightingCue: asString(record.lightingCue),
    motionCue: asString(record.motionCue),
    sourceShotScriptId: asString(record.sourceShotScriptId),
    sourceStoryboardAssetId: asString(record.sourceStoryboardAssetId),
    sourceStoryboardPrompt: asString(record.sourceStoryboardPrompt),
    continuityNotes: textArray(record.continuityNotes),
    qualityScore: asNumber(record.qualityScore),
    blockers: textArray(record.blockers),
    missingReasons: textArray(record.missingReasons),
    shotCoverageRate: asNumber(record.shotCoverageRate),
    storyboardBindingRate: asNumber(record.storyboardBindingRate),
    characterBindingRate: asNumber(record.characterBindingRate),
    locationBindingRate: asNumber(record.locationBindingRate),
    continuityCoverageRate: asNumber(record.continuityCoverageRate),
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || VIDEO_PROMPT_VERSION,
    missingReason: status === 'missing' ? asString(record.missingReason) || fallback.missingReason : null,
  } as VideoPromptDTO;
}

function buildBlocked(
  projectId: string,
  reason: string,
  quality?: Partial<VideoPromptQualityValidationResult>
): VideoPromptDTO[] {
  const missing = buildMissing(projectId, reason)[0];
  return [
    {
      ...missing,
      status: 'blocked',
      blockers: quality?.blockers || [reason],
      missingReasons: [reason],
      qualityScore: quality?.qualityScore ?? null,
      shotCoverageRate: quality?.shotCoverageRate ?? null,
      storyboardBindingRate: quality?.storyboardBindingRate ?? null,
      characterBindingRate: quality?.characterBindingRate ?? null,
      locationBindingRate: quality?.locationBindingRate ?? null,
      continuityCoverageRate: quality?.continuityCoverageRate ?? null,
      missingReason: reason,
    } as VideoPromptDTO,
  ];
}

function readyStoryboardByShotId(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const shotId = asString(record.shotId) || asString(record.sourceShotScriptId);
    const isTextBinding = asString(record.assetKind) === 'text_binding';
    const isReady = asString(record.status) === 'done';
    const hasImageAsset = Boolean(asString(record.assetUrl) || asString(record.assetStorageKey));
    if (shotId && isReady && isTextBinding && !hasImageAsset) map.set(shotId, record);
  }
  return map;
}

function idSet(items: unknown[], key: string): Set<string> {
  return new Set(
    items.map((item) => asString(asRecord(item)[key])).filter(Boolean) as string[]
  );
}

function hasPlaceholder(value: VideoPromptDTO): boolean {
  return [
    value.prompt,
    value.negativePrompt,
    value.cameraLanguage,
    value.soundCue,
    value.lightingCue,
    value.motionCue,
    value.sourceStoryboardPrompt,
    ...value.continuityNotes,
  ].some((item) => Boolean(item && VIDEO_PROMPT_PLACEHOLDER_PATTERN.test(item)));
}

function promptQualityScore(input: {
  shotCoverageRate: number;
  storyboardBindingRate: number;
  characterBindingRate: number;
  locationBindingRate: number;
  continuityCoverageRate: number;
  hasPlaceholders: boolean;
}): number {
  const score =
    input.shotCoverageRate * 25 +
    input.storyboardBindingRate * 25 +
    input.characterBindingRate * 15 +
    input.locationBindingRate * 15 +
    input.continuityCoverageRate * 20;
  return Math.max(0, Math.round(score - (input.hasPlaceholders ? 30 : 0)));
}

function buildVideoPrompt(
  projectId: string,
  shotScript: JsonRecord,
  storyboardAsset: JsonRecord | undefined,
  generatedAt: string
): VideoPromptDTO {
  const shotId = asString(shotScript.shot_id) || 'unknown-shot';
  const names = characterNames(shotScript.characters);
  const durationSec = asNumber(shotScript.duration_sec) || 4;
  const shotNo = asNumber(shotScript.shot_no);
  const shotSize = asString(shotScript.shot_size) || '景别待定';
  const cameraMovement = asString(shotScript.camera_movement) || '运镜待定';
  const action = asString(shotScript.action) || '动作待定';
  const visualGoal = asString(shotScript.visual_goal) || '画面目标待定';
  const lighting = asString(shotScript.lighting) || '光影待定';
  const emotion = asString(shotScript.emotion) || '情绪待定';
  const sound = textArray(shotScript.sound_design).join('；') || '环境声保持克制，突出人物情绪';
  const storyboardPrompt = asString(storyboardAsset?.prompt) || asString(shotScript.storyboard_prompt);
  const basePrompt = asString(shotScript.video_prompt);
  const prompt =
    basePrompt ||
    [
      `镜头 ${shotNo || '-'}，${durationSec} 秒，16:9 动漫镜头`,
      `画面：${storyboardPrompt || visualGoal}`,
      `人物：${names.join('、') || '待识别角色'}`,
      `动作：${action}`,
      `景别与运镜：${shotSize}，${cameraMovement}`,
      `光影：${lighting}`,
      `情绪：${emotion}`,
      `声音：${sound}`,
      '保持角色造型、服装、发型、道具和场景连续性；本阶段只输出视频提示词，不创建视频任务。',
    ].join('。');

  return {
    id: `project-metadata:${projectId}:video-prompt:${shotId}`,
    projectId,
    shotId,
    episodeId: asString(shotScript.episode_id),
    shotNo,
    sceneId: asString(shotScript.scene_id),
    locationId: asString(shotScript.location_id),
    status: 'done',
    prompt,
    negativePrompt: '避免角色变脸、服装错乱、手指畸形、场景跳变、字幕乱码、画面闪烁、镜头穿帮、低清晰度。',
    durationSec,
    aspectRatio: '16:9',
    cameraLanguage: `${shotSize} / ${cameraMovement}`,
    characters: names,
    dialogueCue: dialogueCue(shotScript.dialogue),
    soundCue: sound,
    lightingCue: lighting,
    motionCue: `${cameraMovement}；${action}`,
    sourceShotScriptId: shotId,
    sourceStoryboardAssetId: asString(storyboardAsset?.id),
    sourceStoryboardPrompt: storyboardPrompt,
    continuityNotes: [
      ...textArray(shotScript.continuity_notes).slice(0, 4),
      storyboardAsset
        ? 'VideoPrompt 已绑定 StoryboardAsset 文本层，但未创建 VideoJob。'
        : 'VideoPrompt 从 ShotScript 直接生成，缺少 StoryboardAsset 绑定。',
      '后续视频生成必须单独创建 VideoJob，并写回镜头级任务状态。',
    ],
    qualityScore: null,
    blockers: [],
    missingReasons: [],
    shotCoverageRate: null,
    storyboardBindingRate: null,
    characterBindingRate: null,
    locationBindingRate: null,
    continuityCoverageRate: null,
    generatedAt,
    version: VIDEO_PROMPT_VERSION,
    missingReason: null,
  } as VideoPromptDTO;
}

export function validateVideoPromptQuality(
  videoPrompts: unknown,
  shotScripts: unknown,
  storyboardAssets: unknown,
  characterBibles: unknown,
  locationBibles: unknown
): VideoPromptQualityValidationResult {
  const prompts = asArray(videoPrompts).map((item) => normalizeVideoPrompt('validation', item));
  const shots = asArray(shotScripts)
    .map((item) => asRecord(item))
    .filter((item) => asString(item.status) === 'ready' && asString(item.shot_id));
  const readyStoryboardAssets = readyStoryboardByShotId(asArray(storyboardAssets));
  const characterIds = idSet(asArray(characterBibles), 'characterId');
  const locationIds = idSet(asArray(locationBibles), 'locationId');
  const promptShotIds = new Set(prompts.map((prompt) => prompt.sourceShotScriptId || prompt.shotId).filter(Boolean) as string[]);
  const expectedShotIds = new Set(shots.map((shot) => asString(shot.shot_id)).filter(Boolean) as string[]);
  const promptCount = prompts.filter((prompt) => prompt.status !== 'missing').length;
  const blockers: string[] = [];

  if (shots.length === 0) blockers.push('缺少 ready ShotScript，不能生成 VideoPrompt。');
  if (readyStoryboardAssets.size === 0) blockers.push('缺少 ready StoryboardAsset 文本绑定。');
  if (characterIds.size === 0) blockers.push('缺少 ready CharacterBible 角色绑定。');
  if (locationIds.size === 0) blockers.push('缺少 ready LocationBible 场景绑定。');

  const shotCoverageRate =
    expectedShotIds.size === 0
      ? 0
      : Array.from(expectedShotIds).filter((shotId) => promptShotIds.has(shotId)).length /
        expectedShotIds.size;
  const storyboardBindingRate =
    promptCount === 0
      ? 0
      : prompts.filter((prompt) => Boolean(prompt.sourceStoryboardAssetId)).length / promptCount;
  const characterBindingRate =
    promptCount === 0
      ? 0
      : prompts.filter((prompt) => prompt.characters.some((name) => name.trim())).length / promptCount;
  const locationBindingRate =
    promptCount === 0
      ? 0
      : prompts.filter((prompt) => Boolean(prompt.locationId && locationIds.has(prompt.locationId))).length /
        promptCount;
  const continuityCoverageRate =
    promptCount === 0
      ? 0
      : prompts.filter((prompt) => prompt.continuityNotes.length > 0).length / promptCount;
  const hasPlaceholders = prompts.some(hasPlaceholder);
  const qualityScore = promptQualityScore({
    shotCoverageRate,
    storyboardBindingRate,
    characterBindingRate,
    locationBindingRate,
    continuityCoverageRate,
    hasPlaceholders,
  });

  if (promptCount !== shots.length) blockers.push(`VideoPrompt 数量不匹配：${promptCount}/${shots.length}`);
  if (shotCoverageRate < 1) blockers.push(`ShotScript 覆盖率不足：${Math.round(shotCoverageRate * 100)}%/100%`);
  if (storyboardBindingRate < 1) blockers.push(`StoryboardAsset 绑定率不足：${Math.round(storyboardBindingRate * 100)}%/100%`);
  if (characterBindingRate < MIN_VIDEO_PROMPT_BINDING_RATE) {
    blockers.push(`CharacterBible 角色绑定率不足：${Math.round(characterBindingRate * 100)}%/90%`);
  }
  if (locationBindingRate < MIN_VIDEO_PROMPT_BINDING_RATE) {
    blockers.push(`LocationBible 场景绑定率不足：${Math.round(locationBindingRate * 100)}%/90%`);
  }
  if (continuityCoverageRate < MIN_VIDEO_PROMPT_CONTINUITY_RATE) {
    blockers.push(`continuityNotes 覆盖率不足：${Math.round(continuityCoverageRate * 100)}%/90%`);
  }
  if (prompts.some((prompt) => !prompt.prompt)) blockers.push('存在缺少 prompt 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.negativePrompt)) blockers.push('存在缺少 negativePrompt 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.durationSec)) blockers.push('存在缺少 durationSec 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.aspectRatio)) blockers.push('存在缺少 aspectRatio 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.cameraLanguage)) blockers.push('存在缺少 cameraLanguage 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.soundCue)) blockers.push('存在缺少 soundCue 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.lightingCue)) blockers.push('存在缺少 lightingCue 的 VideoPrompt。');
  if (prompts.some((prompt) => !prompt.motionCue)) blockers.push('存在缺少 motionCue 的 VideoPrompt。');
  if (hasPlaceholders) blockers.push('VideoPrompt 中存在待定/未生成/旧摘要等占位文本。');
  if (qualityScore < MIN_VIDEO_PROMPT_QUALITY_SCORE) {
    blockers.push(`VideoPrompt overall quality score 不足：${qualityScore}/70`);
  }

  return {
    passed: blockers.length === 0,
    blockers,
    promptCount,
    shotCoverageRate,
    storyboardBindingRate,
    characterBindingRate,
    locationBindingRate,
    continuityCoverageRate,
    qualityScore,
  };
}

@Injectable()
export class ProjectStudioVideoPromptService {
  constructor(private readonly prisma: PrismaService) {}

  async getVideoPrompts(projectId: string, organizationId: string): Promise<VideoPromptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const videoPrompts = asArray(asRecord(asRecord(project.metadata).animationStudio).videoPrompts);
    if (videoPrompts.length === 0) {
      return buildMissing(projectId, '视频提示词未生成');
    }

    return videoPrompts.map((item) => normalizeVideoPrompt(projectId, item));
  }

  async generateVideoPrompts(projectId: string, organizationId: string): Promise<VideoPromptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const shotScripts = asArray(animationStudio.shotScripts)
      .map((item) => asRecord(item))
      .filter((item) => asString(item.status) === 'ready' && asString(item.shot_id));

    if (shotScripts.length === 0) {
      return buildBlocked(projectId, '缺少 ready ShotScript，不能生成 VideoPrompt。');
    }

    const storyboardAssets = asArray(animationStudio.storyboardAssets);
    const storyboardAssetsByShotId = readyStoryboardByShotId(storyboardAssets);
    if (storyboardAssetsByShotId.size === 0) {
      return buildBlocked(projectId, '缺少 ready StoryboardAsset 文本绑定，不能生成 VideoPrompt。');
    }
    const generatedAt = new Date().toISOString();
    const videoPrompts = shotScripts.map((shotScript) =>
      buildVideoPrompt(
        projectId,
        shotScript,
        storyboardAssetsByShotId.get(asString(shotScript.shot_id) || ''),
        generatedAt
      )
    );
    const quality = validateVideoPromptQuality(
      videoPrompts,
      shotScripts,
      storyboardAssets,
      animationStudio.characterBibles,
      animationStudio.locationBibles
    );
    const readyVideoPrompts = videoPrompts.map((prompt) => ({
      ...prompt,
      status: quality.passed ? 'done' : 'blocked',
      qualityScore: quality.qualityScore,
      blockers: quality.passed ? [] : quality.blockers,
      missingReasons: quality.passed ? [] : quality.blockers,
      shotCoverageRate: quality.shotCoverageRate,
      storyboardBindingRate: quality.storyboardBindingRate,
      characterBindingRate: quality.characterBindingRate,
      locationBindingRate: quality.locationBindingRate,
      continuityCoverageRate: quality.continuityCoverageRate,
      missingReason: quality.passed ? null : quality.blockers.join('；'),
    })) as VideoPromptDTO[];

    if (!quality.passed) {
      return readyVideoPrompts;
    }

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        videoPrompts: readyVideoPrompts,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return readyVideoPrompts;
  }
}
