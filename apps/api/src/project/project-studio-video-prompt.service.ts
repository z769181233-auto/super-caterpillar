import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VideoPromptDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const VIDEO_PROMPT_VERSION = 'studio-video-prompt-v1';

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
      generatedAt: null,
      version: VIDEO_PROMPT_VERSION,
      missingReason: reason,
    },
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
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || VIDEO_PROMPT_VERSION,
    missingReason: status === 'missing' ? asString(record.missingReason) || fallback.missingReason : null,
  };
}

function storyboardByShotId(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const shotId = asString(record.shotId) || asString(record.sourceShotScriptId);
    if (shotId && asString(record.status) !== 'missing') map.set(shotId, record);
  }
  return map;
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
    generatedAt,
    version: VIDEO_PROMPT_VERSION,
    missingReason: null,
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
      .filter((item) => asString(item.status) !== 'missing' && asString(item.shot_id));

    if (shotScripts.length === 0) {
      throw new BadRequestException('No Studio ShotScript found for VideoPrompt generation');
    }

    const storyboardAssetsByShotId = storyboardByShotId(asArray(animationStudio.storyboardAssets));
    const generatedAt = new Date().toISOString();
    const videoPrompts = shotScripts.map((shotScript) =>
      buildVideoPrompt(
        projectId,
        shotScript,
        storyboardAssetsByShotId.get(asString(shotScript.shot_id) || ''),
        generatedAt
      )
    );

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        videoPrompts,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return videoPrompts;
  }
}
