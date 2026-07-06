import { Injectable, NotFoundException } from '@nestjs/common';
import {
  StoryboardAssetDTO,
  StoryboardImageGenerateOneDTO,
  StoryboardImageGenerateOneRequestDTO,
  StoryboardImageGenerationDryRunDTO,
  StoryboardImageGenerationDryRunRequestDTO,
  StoryboardImageGenerationPlanItemDTO,
  StoryboardImageProviderResultDTO,
} from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { validateCharacterBibleQuality } from './project-studio-character-bible.service';
import { validateLocationBibleQuality } from './project-studio-location-bible.service';
import { validateShotScriptQuality } from './project-studio-shot-script.service';
import { validateVideoPromptQuality } from './project-studio-video-prompt.service';

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

export interface StoryboardImageReadinessDTO {
  projectId: string;
  status: 'ready' | 'blocked';
  blockers: string[];
  readyShotCount: number;
  textBindingCoverageRate: number;
  characterBindingRate: number;
  locationBindingRate: number;
  promptCompletenessRate: number;
  continuityCoverageRate: number;
  estimatedCostUnits: number;
  imageAssetCount: number;
  willCreateJob: false;
  willCallProvider: false;
  willGenerateImage: false;
  nextAction: string;
}

const DEFAULT_IMAGE_MODEL = 'image-generation-model-not-selected';
const DEFAULT_IMAGE_SIZE = '16:9';
const DEFAULT_IMAGE_QUALITY = 'draft';

type StoryboardImageProviderName = 'mock' | 'openai';

interface StoryboardImageProviderInput {
  projectId: string;
  asset: StoryboardAssetDTO;
  request: StoryboardImageGenerateOneRequestDTO;
  imagePrompt: string | null;
}

interface StoryboardImageProvider {
  provider: StoryboardImageProviderName;
  generate(input: StoryboardImageProviderInput): Promise<StoryboardImageProviderResultDTO>;
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

function buildStoryboardImageReadiness(
  projectId: string,
  animationStudio: JsonRecord
): StoryboardImageReadinessDTO {
  const storyBible = asRecord(animationStudio.storyBible);
  const characterBibles = asArray(animationStudio.characterBibles);
  const locationBibles = asArray(animationStudio.locationBibles);
  const shotScripts = asArray(animationStudio.shotScripts);
  const storyboardAssets = asArray(animationStudio.storyboardAssets);
  const videoPrompts = asArray(animationStudio.videoPrompts);
  const readyShotScripts = shotScripts
    .map((item) => asRecord(item))
    .filter((item) => asString(item.status) === 'ready' && asString(item.shot_id));
  const storyboardQuality = validateStoryboardAssetQuality(storyboardAssets, shotScripts);
  const characterQuality = validateCharacterBibleQuality(characterBibles, shotScripts, storyBible);
  const locationQuality = validateLocationBibleQuality(
    locationBibles,
    shotScripts,
    storyboardAssets,
    storyBible
  );
  const videoPromptQuality = validateVideoPromptQuality(
    videoPrompts,
    shotScripts,
    storyboardAssets,
    characterBibles,
    locationBibles
  );
  const imageAssetCount = storyboardAssets.filter((asset) => {
    const record = asRecord(asset);
    return record.assetKind === 'image' || Boolean(asString(record.assetUrl) || asString(record.assetStorageKey));
  }).length;
  const blockers = [
    ...(!storyBible || Object.keys(storyBible).length === 0 ? ['StoryBible 未生成，不能进入图片准备度检查。'] : []),
    ...(!storyboardQuality.passed
      ? storyboardQuality.blockers.map((blocker) => `StoryboardAsset 文本绑定未通过：${blocker}`)
      : []),
    ...(!characterQuality.passed
      ? characterQuality.blockers.map((blocker) => `CharacterBible 未通过：${blocker}`)
      : []),
    ...(!locationQuality.passed
      ? locationQuality.blockers.map((blocker) => `LocationBible 未通过：${blocker}`)
      : []),
    ...(!videoPromptQuality.passed
      ? videoPromptQuality.blockers.map((blocker) => `VideoPrompt 未通过：${blocker}`)
      : []),
    ...(imageAssetCount > 0 ? ['已发现图片资产；Phase 2D 第一段只做 readiness，不应生成图片。'] : []),
  ];

  return {
    projectId,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers,
    readyShotCount: readyShotScripts.length,
    textBindingCoverageRate: storyboardQuality.shotCoverageRate,
    characterBindingRate: characterQuality.shotCharacterCoverageRate ?? 0,
    locationBindingRate: locationQuality.shotLocationCoverageRate ?? 0,
    promptCompletenessRate: storyboardQuality.promptCoverageRate,
    continuityCoverageRate: Math.min(
      storyboardQuality.continuityCoverageRate,
      videoPromptQuality.continuityCoverageRate
    ),
    estimatedCostUnits: readyShotScripts.length,
    imageAssetCount,
    willCreateJob: false,
    willCallProvider: false,
    willGenerateImage: false,
    nextAction:
      blockers.length === 0
        ? '图片生成准备度已通过；下一阶段仍需单独审批真实图片生成。'
        : '先修复 readiness blockers；本阶段不会生成图片。',
  };
}

function buildStoryboardImageGenerationDryRun(
  projectId: string,
  animationStudio: JsonRecord,
  request: StoryboardImageGenerationDryRunRequestDTO = {}
): StoryboardImageGenerationDryRunDTO {
  const readiness = buildStoryboardImageReadiness(projectId, animationStudio);
  const storyboardAssets = asArray(animationStudio.storyboardAssets)
    .map((item) => normalizeStoryboardAsset(projectId, item))
    .filter((asset) => asset.assetKind === 'text_binding' && asset.status === 'done');
  const requestedShotIds = uniq(
    Array.isArray(request.shotIds)
      ? request.shotIds
          .map((shotId: string) => (typeof shotId === 'string' ? shotId : ''))
          .filter(Boolean)
      : []
  );
  const requestedEpisodeId = asString(request.episodeId);
  const filteredAssets = storyboardAssets.filter((asset) => {
    if (requestedEpisodeId && asset.episodeId !== requestedEpisodeId) return false;
    if (
      requestedShotIds.length > 0 &&
      (!asset.sourceShotScriptId || !requestedShotIds.includes(asset.sourceShotScriptId))
    ) {
      return false;
    }
    return true;
  });
  const existingImageAssetCount = asArray(animationStudio.storyboardAssets).filter((asset) => {
    const record = asRecord(asset);
    return (
      record.assetKind === 'image' ||
      Boolean(asString(record.assetUrl) || asString(record.assetStorageKey))
    );
  }).length;
  const globalBlockers = [...readiness.blockers];
  if (!request.confirmCost) {
    globalBlockers.push('真实图片生成前必须确认预计成本；dry-run 不会调用图片模型。');
  }
  if (filteredAssets.length === 0) {
    globalBlockers.push('没有匹配的 StoryboardAsset 文本绑定可用于图片生成计划。');
  }
  if (!asString(request.imageModel)) {
    globalBlockers.push('真实图片生成前必须选择图片模型。');
  }

  const assets: StoryboardImageGenerationPlanItemDTO[] = filteredAssets.map((asset) => {
    const itemBlockers: string[] = [];
    if (!asset.sourceShotScriptId) itemBlockers.push('缺少 sourceShotScriptId');
    if (!asset.sourcePrompt && !asset.prompt) itemBlockers.push('缺少 sourcePrompt/prompt');
    if (!asset.frameDescription) itemBlockers.push('缺少 frameDescription');
    return {
      shotId: asset.sourceShotScriptId || asset.shotId,
      shotNo: asset.shotNo,
      episodeId: asset.episodeId,
      sourceStoryboardAssetId: asset.id,
      sourcePrompt: asset.sourcePrompt || asset.prompt,
      imagePrompt: [asset.prompt, asset.frameDescription, asset.cameraLanguage]
        .map((value) => asString(value))
        .filter(Boolean)
        .join('\n'),
      estimatedCostUnit: 1,
      blockers: itemBlockers,
    };
  });
  const itemBlockers = assets.flatMap((asset) =>
    asset.blockers.map(
      (blocker: string) => `镜头 ${asset.shotNo || asset.shotId || '-'}：${blocker}`
    )
  );
  const blockers = uniq([...globalBlockers, ...itemBlockers]);

  return {
    projectId,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    mode: 'dry_run',
    requestedEpisodeId,
    requestedShotIds,
    plannedImageCount: assets.length,
    existingImageAssetCount,
    estimatedCostUnits: assets.reduce((sum, asset) => sum + asset.estimatedCostUnit, 0),
    imageModel: asString(request.imageModel) || DEFAULT_IMAGE_MODEL,
    imageSize: asString(request.imageSize) || DEFAULT_IMAGE_SIZE,
    imageQuality: asString(request.imageQuality) || DEFAULT_IMAGE_QUALITY,
    assets,
    blockers,
    willCreateJob: false,
    willCallProvider: false,
    willGenerateImage: false,
    willWriteMetadata: false,
    nextAction:
      blockers.length === 0
        ? 'dry-run 已通过；真实图片生成仍需单独阶段审批和显式生成入口。'
        : '先修复 dry-run blockers；当前请求不会生成图片、写入 metadata 或创建 job。',
  };
}

function validateGenerateOneRequest(request: Partial<StoryboardImageGenerateOneRequestDTO>): string[] {
  const blockers: string[] = [];
  if (!asString(request.shotId)) blockers.push('必须选择一个 shotId');
  if (!asString(request.imageModel)) blockers.push('必须选择图片模型');
  if (!asString(request.imageSize)) blockers.push('必须选择图片尺寸');
  if (!asString(request.imageQuality)) blockers.push('必须选择图片质量');
  if (request.confirmCost !== true) blockers.push('必须确认预计成本');
  if (request.confirmSingleShot !== true) blockers.push('本阶段只允许确认单镜头生成');
  if (request.confirmNoVideo !== true) blockers.push('必须确认不会生成视频');
  return blockers;
}

class MockStoryboardImageProvider implements StoryboardImageProvider {
  readonly provider = 'mock' as const;

  async generate(input: StoryboardImageProviderInput): Promise<StoryboardImageProviderResultDTO> {
    const shotId = input.asset.sourceShotScriptId || input.asset.shotId || input.request.shotId;
    return {
      provider: this.provider,
      attempted: true,
      assetStorageKey: `studio/storyboards/${input.projectId}/${shotId}.mock.png`,
      assetUrl: `/mock-assets/studio/storyboards/${input.projectId}/${shotId}.png`,
    };
  }
}

class OpenAIStoryboardImageProviderSkeleton implements StoryboardImageProvider {
  readonly provider = 'openai' as const;

  async generate(): Promise<StoryboardImageProviderResultDTO> {
    throw new Error('OpenAI storyboard image provider skeleton is configured but real provider calls are disabled in Phase 3A-D first segment');
  }
}

function getConfiguredStoryboardImageProviderName(): StoryboardImageProviderName {
  return process.env.STUDIO_STORYBOARD_IMAGE_PROVIDER === 'openai' ? 'openai' : 'mock';
}

function validateStoryboardImageProviderGate(
  provider: StoryboardImageProviderName,
  request: Partial<StoryboardImageGenerateOneRequestDTO>
): string[] {
  if (provider !== 'openai') return [];
  const blockers: string[] = [];
  if (process.env.ENABLE_STUDIO_REAL_IMAGE_GENERATION !== 'true') {
    blockers.push('真实图片 provider 需要 ENABLE_STUDIO_REAL_IMAGE_GENERATION=true');
  }
  if (!process.env.OPENAI_API_KEY) {
    blockers.push('真实图片 provider 需要 OPENAI_API_KEY');
  }
  if (request.confirmRealImageGeneration !== true) {
    blockers.push('真实图片 provider 需要 confirmRealImageGeneration=true');
  }
  blockers.push('Phase 3A-D 第一段只接入 OpenAI provider skeleton，不调用真实图片模型');
  return blockers;
}

function resolveStoryboardImageProvider(provider: StoryboardImageProviderName): StoryboardImageProvider {
  return provider === 'openai'
    ? new OpenAIStoryboardImageProviderSkeleton()
    : new MockStoryboardImageProvider();
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

  async getStoryboardImageReadiness(
    projectId: string,
    organizationId: string
  ): Promise<StoryboardImageReadinessDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    return buildStoryboardImageReadiness(projectId, animationStudio);
  }

  async dryRunStoryboardImageGeneration(
    projectId: string,
    organizationId: string,
    request: StoryboardImageGenerationDryRunRequestDTO = {}
  ): Promise<StoryboardImageGenerationDryRunDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    return buildStoryboardImageGenerationDryRun(projectId, animationStudio, request);
  }

  async generateOneStoryboardImage(
    projectId: string,
    organizationId: string,
    request: Partial<StoryboardImageGenerateOneRequestDTO> = {}
  ): Promise<StoryboardImageGenerateOneDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const providerName = getConfiguredStoryboardImageProviderName();
    const requestBlockers = validateGenerateOneRequest(request);
    const providerBlockers = validateStoryboardImageProviderGate(providerName, request);
    const shotId = asString(request.shotId);
    const dryRun = buildStoryboardImageGenerationDryRun(projectId, animationStudio, {
      shotIds: shotId ? [shotId] : [],
      imageModel: asString(request.imageModel),
      imageSize: asString(request.imageSize),
      imageQuality: asString(request.imageQuality),
      confirmCost: request.confirmCost,
    });
    const storyboardAssets = asArray(animationStudio.storyboardAssets).map((item) =>
      normalizeStoryboardAsset(projectId, item)
    );
    const textBindingAsset = storyboardAssets.find(
      (asset) =>
        asset.assetKind === 'text_binding' &&
        asset.status === 'done' &&
        (asset.sourceShotScriptId === shotId || asset.shotId === shotId)
    );
    const existingImageAsset = storyboardAssets.find(
      (asset) =>
        asset.assetKind === 'image' &&
        (asset.sourceShotScriptId === shotId || asset.shotId === shotId)
    );
    const blockers = uniq([
      ...requestBlockers,
      ...providerBlockers,
      ...dryRun.blockers,
      ...(dryRun.assets.length !== 1 ? ['本阶段只允许单镜头图片生成'] : []),
      ...(!textBindingAsset ? ['缺少目标镜头的 ready StoryboardAsset 文本绑定'] : []),
      ...(existingImageAsset ? ['目标镜头已存在 image asset；本阶段不支持覆盖'] : []),
    ]);

    if (blockers.length > 0 || !textBindingAsset || !shotId) {
      return {
        projectId,
        status: 'blocked',
        mode: 'single_shot',
        asset: null,
        blockers,
        providerCall: {
          attempted: false,
          provider: providerName,
          model: asString(request.imageModel),
        },
        willCreateJob: false,
        willGenerateVideo: false,
        nextAction: '先修复单镜头图片生成 blockers；不会调用真实图片模型、worker 或视频链路。',
      };
    }

    const safeRequest = request as StoryboardImageGenerateOneRequestDTO;
    const provider = resolveStoryboardImageProvider(providerName);
    const providerResult = await provider.generate({
      projectId,
      asset: textBindingAsset,
      request: safeRequest,
      imagePrompt: dryRun.assets[0]?.imagePrompt || textBindingAsset.sourcePrompt || textBindingAsset.prompt,
    });
    const generatedAt = new Date().toISOString();
    const imageAsset: StoryboardAssetDTO = {
      ...textBindingAsset,
      id: `project-metadata:${projectId}:storyboard-image:${shotId}`,
      status: 'done',
      assetKind: 'image',
      assetUrl: providerResult.assetUrl,
      assetStorageKey: providerResult.assetStorageKey,
      imageProvider: providerResult.provider,
      imageModel: safeRequest.imageModel,
      imageSize: safeRequest.imageSize,
      imageQuality: safeRequest.imageQuality,
      imagePrompt: dryRun.assets[0]?.imagePrompt || textBindingAsset.sourcePrompt || textBindingAsset.prompt,
      imageGeneratedAt: generatedAt,
      generationMode: 'single_shot',
      estimatedCostUnit: dryRun.assets[0]?.estimatedCostUnit ?? 1,
      locked: true,
      generatedAt,
      missingReason: null,
    };
    const nextStoryboardAssets = [...storyboardAssets, imageAsset];
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        storyboardAssets: nextStoryboardAssets,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return {
      projectId,
      status: 'ready',
      mode: 'single_shot',
      asset: imageAsset,
      blockers: [],
      providerCall: {
        attempted: providerResult.attempted,
        provider: providerResult.provider,
        model: safeRequest.imageModel,
      },
      willCreateJob: false,
      willGenerateVideo: false,
      nextAction: '已写入单镜头 mock image asset；未调用真实图片模型、worker 或视频链路。',
    };
  }
}
