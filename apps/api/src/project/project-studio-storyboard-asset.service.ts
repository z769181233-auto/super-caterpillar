import { Injectable, NotFoundException } from '@nestjs/common';
import { StoryboardAssetDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { validateShotScriptQuality } from './project-studio-shot-script.service';

type JsonRecord = Record<string, unknown>;

const STORYBOARD_ASSET_VERSION = 'studio-storyboard-asset-v1';

export interface StoryboardAssetQualityValidationResult {
  passed: boolean;
  blockers: string[];
  assetCount: number;
  textBindingCount: number;
  shotCoverageRate: number;
  promptCoverageRate: number;
  continuityCoverageRate: number;
  imageAssetCount: number;
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

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function textArray(value: unknown): string[] {
  return uniq(asArray(value).map((item) => asString(item)).filter(Boolean) as string[]);
}

function characterNames(value: unknown): string[] {
  return uniq(
    asArray(value)
      .map((item) => {
        const record = asRecord(item);
        return (
          asString(record.character_name) ||
          asString(record.name) ||
          asString(record.character_id)
        );
      })
      .filter(Boolean) as string[]
  );
}

function normalizeStoryboardAsset(projectId: string, value: unknown): StoryboardAssetDTO {
  const record = asRecord(value);
  const status = asString(record.status);
  return {
    id: asString(record.id),
    projectId,
    shotId: asString(record.shotId),
    episodeId: asString(record.episodeId),
    shotNo: asNumber(record.shotNo),
    sceneId: asString(record.sceneId),
    status:
      status === 'done' ||
      status === 'missing' ||
      status === 'running' ||
      status === 'failed' ||
      status === 'blocked'
        ? status
        : 'done',
    assetKind: record.assetKind === 'image' ? 'image' : 'text_binding',
    assetUrl: asString(record.assetUrl),
    assetStorageKey: asString(record.assetStorageKey),
    prompt: asString(record.prompt),
    frameDescription: asString(record.frameDescription),
    cameraLanguage: asString(record.cameraLanguage),
    characters: textArray(record.characters),
    locationId: asString(record.locationId),
    sourceShotScriptId: asString(record.sourceShotScriptId),
    sourcePrompt: asString(record.sourcePrompt),
    continuityNotes: textArray(record.continuityNotes),
    imageProvider: asString(record.imageProvider),
    imageModel: asString(record.imageModel),
    imageSize: asString(record.imageSize),
    imageQuality: asString(record.imageQuality),
    imagePrompt: asString(record.imagePrompt),
    imageGeneratedAt: asString(record.imageGeneratedAt),
    generationMode: record.generationMode === 'single_shot' || record.generationMode === 'batch' ? record.generationMode : null,
    estimatedCostUnit: asNumber(record.estimatedCostUnit),
    locked: record.locked === false ? false : true,
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || STORYBOARD_ASSET_VERSION,
    missingReason: asString(record.missingReason),
  };
}

function buildMissing(projectId: string, reason: string): StoryboardAssetDTO[] {
  return [
    {
      id: null,
      projectId,
      shotId: null,
      episodeId: null,
      shotNo: null,
      sceneId: null,
      status: 'missing',
      assetKind: 'text_binding',
      assetUrl: null,
      assetStorageKey: null,
      prompt: null,
      frameDescription: null,
      cameraLanguage: null,
      characters: [],
      locationId: null,
      sourceShotScriptId: null,
      sourcePrompt: null,
      continuityNotes: [],
      imageProvider: null,
      imageModel: null,
      imageSize: null,
      imageQuality: null,
      imagePrompt: null,
      imageGeneratedAt: null,
      generationMode: null,
      estimatedCostUnit: null,
      locked: true,
      generatedAt: null,
      version: STORYBOARD_ASSET_VERSION,
      missingReason: reason,
    },
  ];
}

function buildBlocked(projectId: string, reason: string): StoryboardAssetDTO[] {
  return buildMissing(projectId, reason).map((item) => ({
    ...item,
    status: 'blocked',
    missingReason: reason,
  }));
}

function buildStoryboardAsset(
  projectId: string,
  shotScript: JsonRecord,
  generatedAt: string
): StoryboardAssetDTO {
  const shotId = asString(shotScript.shot_id) || 'unknown-shot';
  const shotNo = asNumber(shotScript.shot_no);
  const shotSize = asString(shotScript.shot_size) || '景别待定';
  const cameraMovement = asString(shotScript.camera_movement) || '运镜待定';
  const action = asString(shotScript.action) || '动作待定';
  const visualGoal = asString(shotScript.visual_goal) || '画面目标待定';
  const emotion = asString(shotScript.emotion) || '情绪待定';
  const lighting = asString(shotScript.lighting) || '光影待定';
  const prompt =
    asString(shotScript.storyboard_prompt) ||
    `镜头 ${shotNo || '-'}：${shotSize}，${cameraMovement}，${action}。本阶段只生成分镜文本绑定，不生成图片。`;

  return {
    id: `project-metadata:${projectId}:storyboard-asset:${shotId}`,
    projectId,
    shotId,
    episodeId: asString(shotScript.episode_id),
    shotNo,
    sceneId: asString(shotScript.scene_id),
    status: 'done',
    assetKind: 'text_binding',
    assetUrl: null,
    assetStorageKey: null,
    prompt,
    frameDescription: `镜头 ${shotNo || '-'}，${shotSize}呈现${action}；画面目标：${visualGoal}；情绪：${emotion}；光影：${lighting}。`,
    cameraLanguage: `${shotSize} / ${cameraMovement}`,
    characters: characterNames(shotScript.characters),
    locationId: asString(shotScript.location_id),
    sourceShotScriptId: shotId,
    sourcePrompt: prompt,
    continuityNotes: uniq([
      ...textArray(shotScript.continuity_notes).slice(0, 4),
      `绑定 ShotScript ${shotId}，只作为 StoryboardAsset 文本准备态。`,
      'assetKind=text_binding；assetUrl 为空；不会生成图片、视频、worker 或 job。',
    ]),
    imageProvider: null,
    imageModel: null,
    imageSize: null,
    imageQuality: null,
    imagePrompt: null,
    imageGeneratedAt: null,
    generationMode: null,
    estimatedCostUnit: null,
    locked: true,
    generatedAt,
    version: STORYBOARD_ASSET_VERSION,
    missingReason: null,
  };
}

export function validateStoryboardAssetQuality(
  assets: unknown,
  shotScripts: unknown
): StoryboardAssetQualityValidationResult {
  const assetRecords = asArray(assets).map((item) => asRecord(item));
  const readyShotRecords = asArray(shotScripts)
    .map((item) => asRecord(item))
    .filter((item) => asString(item.status) === 'ready' && asString(item.shot_id));
  const blockers: string[] = [];
  const expectedShotIds = new Set(
    readyShotRecords.map((item) => asString(item.shot_id)).filter(Boolean) as string[]
  );
  const coveredShotIds = new Set<string>();
  let textBindingCount = 0;
  let promptCount = 0;
  let continuityCount = 0;
  let imageAssetCount = 0;

  for (const asset of assetRecords) {
    const shotId = asString(asset.sourceShotScriptId) || asString(asset.shotId);
    if (shotId && expectedShotIds.has(shotId)) coveredShotIds.add(shotId);
    if (asset.assetKind === 'text_binding') textBindingCount += 1;
    if (asString(asset.prompt) && asString(asset.frameDescription) && asString(asset.cameraLanguage)) {
      promptCount += 1;
    }
    if (textArray(asset.continuityNotes).length > 0) continuityCount += 1;
    if (asset.assetKind === 'image' || asString(asset.assetUrl) || asString(asset.assetStorageKey)) {
      imageAssetCount += 1;
    }
  }

  const assetCount = assetRecords.length;
  const expectedCount = expectedShotIds.size;
  const shotCoverageRate = expectedCount > 0 ? coveredShotIds.size / expectedCount : 0;
  const promptCoverageRate = assetCount > 0 ? promptCount / assetCount : 0;
  const continuityCoverageRate = assetCount > 0 ? continuityCount / assetCount : 0;

  if (expectedCount === 0) blockers.push('缺少 ready ShotScript，不能生成 StoryboardAsset 文本绑定');
  if (assetCount !== expectedCount) blockers.push(`StoryboardAsset 数量必须等于 ready ShotScript 数量：${assetCount}/${expectedCount}`);
  if (textBindingCount !== assetCount) blockers.push('StoryboardAsset 必须全部为 assetKind=text_binding');
  if (shotCoverageRate < 1) blockers.push(`ShotScript 覆盖率不足：${Math.round(shotCoverageRate * 100)}%`);
  if (promptCoverageRate < 1) blockers.push(`prompt/frame/camera 覆盖率不足：${Math.round(promptCoverageRate * 100)}%`);
  if (continuityCoverageRate < 0.8) blockers.push(`continuityNotes 覆盖率不足：${Math.round(continuityCoverageRate * 100)}%`);
  if (imageAssetCount > 0) blockers.push('Phase 2A 不允许生成图片资产或写入 assetUrl/assetStorageKey');
  if (assetRecords.some((asset) => asset.locked !== true)) blockers.push('StoryboardAsset 必须 locked=true，避免误触发视觉生成');

  return {
    passed: blockers.length === 0,
    blockers,
    assetCount,
    textBindingCount,
    shotCoverageRate,
    promptCoverageRate,
    continuityCoverageRate,
    imageAssetCount,
  };
}

@Injectable()
export class ProjectStudioStoryboardAssetService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoryboardAssets(projectId: string, organizationId: string): Promise<StoryboardAssetDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const assets = asArray(asRecord(asRecord(project.metadata).animationStudio).storyboardAssets);
    if (assets.length === 0) {
      return buildMissing(projectId, 'StoryboardAsset 文本绑定未生成');
    }

    return assets.map((item) => normalizeStoryboardAsset(projectId, item));
  }

  async generateStoryboardAssets(
    projectId: string,
    organizationId: string
  ): Promise<StoryboardAssetDTO[]> {
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
      return buildBlocked(projectId, '缺少 ready ShotScript，不能生成 StoryboardAsset 文本绑定');
    }

    const shotQuality = validateShotScriptQuality(
      shotScripts as any,
      asArray(animationStudio.directorScripts)[0],
      asArray(animationStudio.episodePlans)[0]
    );
    if (!shotQuality.passed) {
      return buildBlocked(
        projectId,
        `ShotScript 质量门槛未通过：${shotQuality.blockers.join('；')}`
      );
    }

    const generatedAt = new Date().toISOString();
    const storyboardAssets = shotScripts.map((shotScript) =>
      buildStoryboardAsset(projectId, shotScript, generatedAt)
    );
    const assetQuality = validateStoryboardAssetQuality(storyboardAssets, shotScripts);
    if (!assetQuality.passed) {
      return buildBlocked(
        projectId,
        `StoryboardAsset 质量门槛未通过：${assetQuality.blockers.join('；')}`
      );
    }

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        storyboardAssets,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return storyboardAssets;
  }
}
