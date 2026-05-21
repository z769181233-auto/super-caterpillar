import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductionLegacyDataSummaryDTO,
  ProductionSceneCandidateCoverageDTO,
  ProductionStage,
  ProductionStageDTO,
  ProductionStateDTO,
  StorySourceCompatibilityDTO,
  StudioCapabilityStatus,
} from '@scu/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const STAGE_LABELS: Record<ProductionStage, string> = {
  imported: '已导入故事来源',
  analyzing: '故事理解中',
  story_bible_ready: '故事圣经',
  characters_ready: '角色资产',
  locations_ready: '场景资产',
  episodes_ready: '剧集规划',
  director_script_ready: '导演剧本',
  shot_script_ready: '镜头台本',
  storyboard_ready: '分镜资产',
  video_prompt_ready: '视频提示词',
  video_generating: '镜头视频生成',
  review_required: '审片评分',
  revision_required: '回修重生成',
  approved: '审片通过',
  exported: '成片导出',
  failed: '失败',
};

const STAGE_ORDER: ProductionStage[] = [
  'imported',
  'analyzing',
  'story_bible_ready',
  'characters_ready',
  'locations_ready',
  'episodes_ready',
  'director_script_ready',
  'shot_script_ready',
  'storyboard_ready',
  'video_prompt_ready',
  'video_generating',
  'review_required',
  'revision_required',
  'approved',
  'exported',
  'failed',
];

function stage(
  key: ProductionStage,
  status: StudioCapabilityStatus,
  evidence: string[],
  missingReason: string | null,
  nextAction: string | null
): ProductionStageDTO {
  return {
    key,
    label: STAGE_LABELS[key],
    status,
    evidence,
    missingReason,
    nextAction,
  };
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((item) => (typeof item === 'string' ? item.trim() : null))
    .filter(Boolean) as string[];
}

function isUsableSceneCandidate(value: unknown): boolean {
  const candidate = asRecord(value);
  const confidence = String(candidate.confidence || '').toLowerCase();
  const hasSummary = typeof candidate.summary === 'string' && candidate.summary.trim().length > 0;
  return hasSummary && (confidence === 'medium' || confidence === 'high');
}

function buildSceneCandidateCoverage(input: {
  sceneDrafts: Array<{ analysisResult: unknown }>;
  chapterCount: number;
}): ProductionSceneCandidateCoverageDTO {
  const coverageReports = input.sceneDrafts
    .map((draft) => asRecord(asRecord(draft.analysisResult).coverageReport))
    .filter((report) => Object.keys(report).length > 0);
  const sceneCandidates = coverageReports.flatMap((report) => asArray(report.sceneCandidates));
  const usableSceneCandidates = sceneCandidates.filter(isUsableSceneCandidate);
  const missingCapabilities = Array.from(
    new Set(coverageReports.flatMap((report) => stringList(report.missingCapabilities)))
  );
  const qualityGate = asRecord(coverageReports[0]?.qualityGate);
  const qualityGateStatus =
    typeof qualityGate.status === 'string' && qualityGate.status.trim()
      ? qualityGate.status.trim()
      : null;
  const qualityGateScore =
    typeof qualityGate.score === 'number' && Number.isFinite(qualityGate.score)
      ? qualityGate.score
      : null;
  const requiredUsableCandidates = Math.max(1, input.chapterCount);

  if (coverageReports.length === 0) {
    return {
      sceneDraftCount: input.sceneDrafts.length,
      coverageReportCount: 0,
      sceneCandidateCount: 0,
      usableSceneCandidateCount: 0,
      chapterCount: input.chapterCount,
      coverageStatus: 'missing',
      qualityGateStatus,
      qualityGateScore,
      missingCapabilities,
      blockerReason: '未发现 coverageReport.sceneCandidates，无法判断小说是否具备可追踪场景候选。',
      nextAction: '重跑小说分析质量链路，确保章节拆分、人物抽取、场景抽取、对白块、动作块和 scene candidates 已生成。',
    };
  }

  if (usableSceneCandidates.length < requiredUsableCandidates) {
    return {
      sceneDraftCount: input.sceneDrafts.length,
      coverageReportCount: coverageReports.length,
      sceneCandidateCount: sceneCandidates.length,
      usableSceneCandidateCount: usableSceneCandidates.length,
      chapterCount: input.chapterCount,
      coverageStatus: 'insufficient',
      qualityGateStatus,
      qualityGateScore,
      missingCapabilities,
      blockerReason: `可用 scene candidates 不足：${usableSceneCandidates.length}/${requiredUsableCandidates}。`,
      nextAction: '补足章节到 scene candidate 的可追踪映射后，再生成 EpisodePlan / DirectorScript / ShotScript。',
    };
  }

  return {
    sceneDraftCount: input.sceneDrafts.length,
    coverageReportCount: coverageReports.length,
    sceneCandidateCount: sceneCandidates.length,
    usableSceneCandidateCount: usableSceneCandidates.length,
    chapterCount: input.chapterCount,
    coverageStatus: 'ready',
    qualityGateStatus,
    qualityGateScore,
    missingCapabilities,
    blockerReason: null,
    nextAction: null,
  };
}

@Injectable()
export class ProjectProductionStateService {
  constructor(private readonly prisma: PrismaService) {}

  async getStorySourceCompatibility(
    projectId: string,
    organizationId: string
  ): Promise<StorySourceCompatibilityDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [canonicalStorySource, legacyNovelSource, novel] = await Promise.all([
      this.prisma.storySource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          path: true,
          size: true,
          textHash: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { chunks: true } },
        },
      }),
      this.prisma.novelSource.findUnique({
        where: { projectId },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          status: true,
          totalChapters: true,
          updatedAt: true,
        },
      }),
      this.prisma.novel.findUnique({
        where: { projectId },
        select: {
          id: true,
          title: true,
          author: true,
          fileName: true,
          fileSize: true,
          chapterCount: true,
          status: true,
          updatedAt: true,
          _count: { select: { chapters: true } },
        },
      }),
    ]);

    const hasCanonicalStorySource = Boolean(canonicalStorySource);
    const legacyChapterCount =
      toNumber(novel?.chapterCount) ||
      toNumber(novel?._count?.chapters) ||
      toNumber(legacyNovelSource?.totalChapters);
    const legacyFileName = novel?.fileName || legacyNovelSource?.fileName || null;
    const legacyFileSize = novel?.fileSize ?? legacyNovelSource?.fileSize ?? null;
    const hasLegacy = Boolean(novel || legacyNovelSource);
    const missingFields: string[] = [];

    if (!novel?.title && !canonicalStorySource?.name) missingFields.push('title');
    if (!legacyFileName && !canonicalStorySource?.path) missingFields.push('fileName');
    if (legacyChapterCount <= 0 && !canonicalStorySource) missingFields.push('chapterCount');

    const warnings: string[] = [];
    if (hasCanonicalStorySource && hasLegacy) {
      warnings.push('同时存在标准 StorySource 和旧 Novel/NovelSource，本轮只读展示，不做自动合并。');
    }
    if (!hasCanonicalStorySource && hasLegacy) {
      warnings.push('当前可从旧 Novel/NovelSource 做兼容映射，但本轮不写入 story_sources。');
    }
    if (!hasCanonicalStorySource && !hasLegacy) {
      warnings.push('未发现可用故事来源。');
    }

    const compatibilityStatus = hasCanonicalStorySource
      ? hasLegacy
        ? 'conflict'
        : 'canonical'
      : hasLegacy
        ? 'legacy_mappable'
        : 'missing';

    return {
      projectId,
      compatibilityStatus,
      hasCanonicalStorySource,
      canMapFromLegacy: !hasCanonicalStorySource && hasLegacy,
      canonicalStorySource: canonicalStorySource
        ? {
            id: canonicalStorySource.id,
            name: canonicalStorySource.name,
            path: canonicalStorySource.path,
            size: canonicalStorySource.size,
            textHash: canonicalStorySource.textHash,
            chunkCount: canonicalStorySource._count.chunks,
            createdAt: canonicalStorySource.createdAt.toISOString(),
            updatedAt: canonicalStorySource.updatedAt.toISOString(),
          }
        : null,
      legacyNovelSource: hasLegacy
        ? {
            novelSourceId: legacyNovelSource?.id || null,
            novelId: novel?.id || null,
            title: novel?.title || canonicalStorySource?.name || null,
            author: novel?.author || null,
            fileName: legacyFileName,
            fileSize: legacyFileSize,
            chapterCount: legacyChapterCount,
            status: novel?.status || legacyNovelSource?.status || null,
            rawTextAvailability: 'unknown',
            updatedAt: (novel?.updatedAt || legacyNovelSource?.updatedAt)?.toISOString() || null,
          }
        : null,
      mappingPreview: {
        targetKind: hasCanonicalStorySource ? 'novel_import' : hasLegacy ? 'legacy_novel_source' : 'unknown',
        title: novel?.title || canonicalStorySource?.name || null,
        author: novel?.author || null,
        fileName: legacyFileName || canonicalStorySource?.path || null,
        chapterCount: legacyChapterCount,
        sourceTable: hasCanonicalStorySource
          ? 'story_sources'
          : novel
            ? 'novels'
            : legacyNovelSource
              ? 'novel_sources'
              : null,
        sourceId: canonicalStorySource?.id || novel?.id || legacyNovelSource?.id || null,
        missingFields,
      },
      warnings,
      nextAction: hasCanonicalStorySource
        ? '使用标准 StorySource 进入 Phase 2 结构化生成。'
        : hasLegacy
          ? 'Phase 1B 只读确认兼容映射；Phase 2 再决定是否持久化标准 StorySource。'
          : '先导入小说或创建原创剧本。',
    };
  }

  async getProductionState(projectId: string, organizationId: string): Promise<ProductionStateDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, status: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const sceneScope = {
      OR: [{ projectId }, { episode: { projectId } }],
    };

    const [
      storySourceCount,
      latestStorySource,
      legacyNovelSource,
      novel,
      latestAnalysisJob,
      episodeCount,
      sceneCount,
      shotCount,
      storyboardImageShotCount,
      videoJobCount,
      qualityScoreCount,
      sceneDrafts,
    ] = await Promise.all([
      this.prisma.storySource.count({ where: { projectId } }),
      this.prisma.storySource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, path: true, createdAt: true },
      }),
      this.prisma.novelSource.findUnique({
        where: { projectId },
        select: {
          id: true,
          fileName: true,
          status: true,
          totalChapters: true,
          updatedAt: true,
        },
      }),
      this.prisma.novel.findUnique({
        where: { projectId },
        select: {
          id: true,
          title: true,
          author: true,
          fileName: true,
          chapterCount: true,
          status: true,
          updatedAt: true,
          _count: { select: { chapters: true } },
        },
      }),
      this.prisma.novelAnalysisJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, errorMessage: true, updatedAt: true },
      }),
      this.prisma.episode.count({ where: { projectId } }),
      this.prisma.scene.count({ where: sceneScope }),
      this.prisma.shot.count({ where: { scene: sceneScope } }),
      this.prisma.shot.count({
        where: {
          scene: sceneScope,
          OR: [{ resultImageUrl: { not: null } }, { assets: { some: { type: 'IMAGE' } } }],
        },
      }),
      this.prisma.videoJob.count({
        where: {
          payload: { path: ['projectId'], equals: projectId },
        },
      }),
      this.prisma.qualityScore.count({ where: { shot: { scene: sceneScope } } }),
      this.prisma.sceneDraft.findMany({
        where: { chapter: { novelSource: { projectId } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { analysisResult: true },
      }),
    ]);

    const novelChapterCount =
      toNumber(novel?.chapterCount) ||
      toNumber(novel?._count?.chapters) ||
      toNumber(legacyNovelSource?.totalChapters);
    const hasCanonicalStorySource = storySourceCount > 0;
    const hasLegacyNovelSource = Boolean(novel || legacyNovelSource);
    const animationStudioMetadata = asRecord(asRecord(project.metadata).animationStudio);
    const studioStoryBible = animationStudioMetadata.storyBible;
    const studioCharacterBibles = animationStudioMetadata.characterBibles;
    const studioLocationBibles = animationStudioMetadata.locationBibles;
    const studioEpisodePlans = animationStudioMetadata.episodePlans;
    const studioDirectorScripts = animationStudioMetadata.directorScripts;
    const studioShotScripts = animationStudioMetadata.shotScripts;
    const studioStoryboardAssets = animationStudioMetadata.storyboardAssets;
    const studioVideoPrompts = animationStudioMetadata.videoPrompts;
    const hasStudioStoryBible =
      Boolean(studioStoryBible) &&
      typeof studioStoryBible === 'object' &&
      !Array.isArray(studioStoryBible);
    const characterBibleCount = Array.isArray(studioCharacterBibles)
      ? studioCharacterBibles.length
      : 0;
    const hasStudioCharacterBibles = characterBibleCount > 0;
    const locationBibleCount = Array.isArray(studioLocationBibles)
      ? studioLocationBibles.length
      : 0;
    const hasStudioLocationBibles = locationBibleCount > 0;
    const episodePlanCount = Array.isArray(studioEpisodePlans)
      ? studioEpisodePlans.length
      : 0;
    const hasStudioEpisodePlans = episodePlanCount > 0;
    const directorScriptCount = Array.isArray(studioDirectorScripts)
      ? studioDirectorScripts.length
      : 0;
    const hasStudioDirectorScripts = directorScriptCount > 0;
    const shotScriptCount = Array.isArray(studioShotScripts) ? studioShotScripts.length : 0;
    const hasStudioShotScripts = shotScriptCount > 0;
    const storyboardAssetCount = Array.isArray(studioStoryboardAssets)
      ? studioStoryboardAssets.length
      : 0;
    const hasStudioStoryboardAssets = storyboardAssetCount > 0;
    const studioStoryboardImageAssetCount = Array.isArray(studioStoryboardAssets)
      ? studioStoryboardAssets.filter((asset) => {
          const record = asRecord(asset);
          return record.assetKind === 'image' && Boolean(record.assetUrl || record.assetStorageKey);
        }).length
      : 0;
    const videoPromptCount = Array.isArray(studioVideoPrompts) ? studioVideoPrompts.length : 0;
    const hasStudioVideoPrompts = videoPromptCount > 0;
    const imported = hasCanonicalStorySource || hasLegacyNovelSource;
    const latestStatus = latestAnalysisJob?.status ? String(latestAnalysisJob.status) : null;
    const isAnalysisRunning = latestStatus === 'PENDING' || latestStatus === 'RUNNING';
    const isAnalysisFailed = latestStatus === 'FAILED';
    const hasLegacyStructure = episodeCount > 0 || sceneCount > 0 || shotCount > 0;
    const sceneCandidateCoverage = buildSceneCandidateCoverage({
      sceneDrafts,
      chapterCount: novelChapterCount,
    });

    const legacyDataSummary: ProductionLegacyDataSummaryDTO = {
      projectName: project.name,
      hasStorySource: hasCanonicalStorySource,
      storySourceCount,
      hasNovelSource: hasLegacyNovelSource,
      novelTitle: novel?.title || latestStorySource?.name || null,
      novelFileName: novel?.fileName || legacyNovelSource?.fileName || latestStorySource?.path || null,
      novelChapterCount,
      episodeCount,
      sceneCount,
      shotCount,
      storyboardImageCount: storyboardImageShotCount,
      videoJobCount,
      qualityScoreCount,
      sceneCandidateCoverage,
    };

    const stages: ProductionStageDTO[] = [
      stage(
        'imported',
        imported ? 'done' : 'missing',
        imported
          ? [
              hasCanonicalStorySource
                ? `StorySource ${storySourceCount} 个`
                : '未发现标准 StorySource',
              hasLegacyNovelSource ? '发现旧小说来源，可兼容映射' : '未发现旧小说来源',
            ]
          : [],
        imported ? null : '还没有小说导入或原创剧本 StorySource',
        imported ? '进入故事圣经生成阶段' : '先导入小说或创建原创剧本'
      ),
      stage(
        'analyzing',
        isAnalysisFailed ? 'failed' : isAnalysisRunning ? 'running' : hasLegacyStructure ? 'done' : imported ? 'missing' : 'blocked',
        [
          latestAnalysisJob ? `最近分析任务 ${latestAnalysisJob.id}: ${latestStatus}` : '没有分析任务记录',
          hasLegacyStructure
            ? `旧结构数据：${episodeCount} 集 / ${sceneCount} 场 / ${shotCount} 镜`
            : '未发现旧结构数据',
        ],
        isAnalysisFailed
          ? latestAnalysisJob?.errorMessage || '最近小说分析任务失败'
          : hasLegacyStructure || isAnalysisRunning
            ? null
            : imported
              ? '已导入，但未发现可用剧集/场景/镜头结构'
              : '需要先完成导入',
        isAnalysisRunning
          ? '等待分析任务完成'
          : hasLegacyStructure
            ? '补生成故事圣经'
            : imported
              ? '启动小说分析'
              : null
      ),
      stage(
        'story_bible_ready',
        hasStudioStoryBible ? 'done' : 'missing',
        hasStudioStoryBible
          ? [
              `Project.metadata.animationStudio.storyBible`,
              `version:${String(asRecord(studioStoryBible).version || 'unknown')}`,
            ]
          : [],
        hasStudioStoryBible ? null : '故事圣经未生成',
        hasStudioStoryBible ? '进入角色资产生成阶段' : 'Phase 2A 生成 StoryBible'
      ),
      stage(
        'characters_ready',
        hasStudioCharacterBibles ? 'done' : 'missing',
        hasStudioCharacterBibles
          ? [`Project.metadata.animationStudio.characterBibles:${characterBibleCount}`]
          : [],
        hasStudioCharacterBibles ? null : '角色资产未生成；不能把旧角色摘要伪装成角色资产',
        hasStudioCharacterBibles ? '进入场景资产生成阶段' : 'Phase 2B 生成 CharacterBible'
      ),
      stage(
        'locations_ready',
        hasStudioLocationBibles ? 'done' : 'missing',
        hasStudioLocationBibles
          ? [`Project.metadata.animationStudio.locationBibles:${locationBibleCount}`]
          : [],
        hasStudioLocationBibles ? null : '当前没有 LocationBible；不能把旧 location 文本伪装成场景资产',
        hasStudioLocationBibles ? '进入剧集规划生成阶段' : 'Phase 2C 生成 LocationBible'
      ),
      stage(
        'episodes_ready',
        hasStudioEpisodePlans ? 'done' : hasLegacyStructure ? 'blocked' : 'missing',
        hasStudioEpisodePlans
          ? [`Project.metadata.animationStudio.episodePlans:${episodePlanCount}`]
          : hasLegacyStructure
            ? [`旧 Episode 数量：${episodeCount}`]
            : [],
        hasStudioEpisodePlans ? null : '当前没有 EpisodePlan；旧 Episode 只作为兼容摘要',
        hasStudioEpisodePlans ? '进入导演剧本生成阶段' : 'Phase 2D 生成 EpisodePlan'
      ),
      stage(
        'director_script_ready',
        hasStudioDirectorScripts ? 'done' : 'missing',
        hasStudioDirectorScripts
          ? [`Project.metadata.animationStudio.directorScripts:${directorScriptCount}`]
          : [],
        hasStudioDirectorScripts ? null : '当前没有 episode-level DirectorScript',
        hasStudioDirectorScripts ? '进入镜头台本生成阶段' : 'Phase 2E 生成导演剧本'
      ),
      stage(
        'shot_script_ready',
        hasStudioShotScripts ? 'done' : 'missing',
        hasStudioShotScripts
          ? [`Project.metadata.animationStudio.shotScripts:${shotScriptCount}`]
          : hasLegacyStructure
            ? [`旧 Shot 数量：${shotCount}`]
            : [],
        hasStudioShotScripts ? null : '当前没有标准 ShotScript；不能把旧摘要伪装成镜头台本',
        hasStudioShotScripts ? '进入分镜图生成阶段' : 'Phase 2F 生成标准镜头台本'
      ),
      stage(
        'storyboard_ready',
        hasStudioStoryboardAssets ? 'done' : storyboardImageShotCount > 0 ? 'blocked' : 'missing',
        hasStudioStoryboardAssets
          ? [
              `Project.metadata.animationStudio.storyboardAssets:${storyboardAssetCount}`,
              `Studio image storyboard assets:${studioStoryboardImageAssetCount}`,
            ]
          : storyboardImageShotCount > 0
            ? [`旧分镜/图片资产镜头数：${storyboardImageShotCount}`]
            : [],
        hasStudioStoryboardAssets
          ? null
          : '当前没有 StoryboardAsset 协议；旧图片只作为兼容资产',
        hasStudioStoryboardAssets ? '进入视频提示词生成阶段' : 'Phase 2G 生成 StoryboardAsset 文本绑定'
      ),
      stage(
        'video_prompt_ready',
        hasStudioVideoPrompts ? 'done' : 'missing',
        hasStudioVideoPrompts
          ? [`Project.metadata.animationStudio.videoPrompts:${videoPromptCount}`]
          : [],
        hasStudioVideoPrompts ? null : '当前没有 VideoPrompt 协议；不能把 ShotScript 草案伪装成正式视频提示词',
        hasStudioVideoPrompts ? '进入镜头视频生成阶段' : 'Phase 2H 生成 VideoPrompt 文本输出'
      ),
      stage(
        'video_generating',
        videoJobCount > 0 ? 'blocked' : 'missing',
        videoJobCount > 0 ? [`旧 VideoJob 数量：${videoJobCount}`] : [],
        '当前没有完整镜头级视频生成工作台',
        'Phase 4 接入视频生成'
      ),
      stage(
        'review_required',
        qualityScoreCount > 0 ? 'blocked' : 'missing',
        qualityScoreCount > 0 ? [`旧 QualityScore 数量：${qualityScoreCount}`] : [],
        '当前没有 QualityReview 聚合审片报告',
        'Phase 4 运行审片评分'
      ),
      stage(
        'revision_required',
        'missing',
        [],
        '当前没有回修重生成闭环',
        'Phase 4 建立回修流程'
      ),
      stage(
        'approved',
        project.status === 'completed' ? 'blocked' : 'missing',
        project.status === 'completed' ? ['旧 Project.status=completed'] : [],
        '当前没有 Studio v2 审片批准状态',
        '审片通过后进入 approved'
      ),
      stage('exported', 'missing', [], '当前没有 ExportPackage', 'Phase 4 生成导出包'),
      stage(
        'failed',
        isAnalysisFailed ? 'failed' : 'missing',
        isAnalysisFailed ? [`最近失败任务：${latestAnalysisJob?.id}`] : [],
        isAnalysisFailed ? latestAnalysisJob?.errorMessage || '最近分析任务失败' : null,
        isAnalysisFailed ? '重跑失败阶段' : null
      ),
    ];

    const currentStage = this.pickCurrentStage(stages);
    const missingCapabilities = stages
      .filter((item) => item.status === 'missing' || item.status === 'blocked' || item.status === 'failed')
      .filter((item) => item.key !== 'failed' || item.status === 'failed')
      .map((item) => item.label);
    const stageNextActions = stages
      .filter((item) => item.nextAction)
      .slice(0, 5)
      .map((item) => item.nextAction as string);
    const nextActions =
      hasLegacyNovelSource &&
      sceneCandidateCoverage.nextAction &&
      sceneCandidateCoverage.coverageStatus !== 'ready'
        ? [sceneCandidateCoverage.nextAction, ...stageNextActions].slice(0, 5)
        : stageNextActions;
    const riskFlags = this.buildRiskFlags({
      hasCanonicalStorySource,
      hasLegacyNovelSource,
      hasLegacyStructure,
      hasStudioStoryBible,
      hasStudioCharacterBibles,
      hasStudioLocationBibles,
      hasStudioEpisodePlans,
      hasStudioDirectorScripts,
      hasStudioShotScripts,
      hasStudioStoryboardAssets,
      studioStoryboardImageAssetCount,
      hasStudioVideoPrompts,
      isAnalysisFailed,
      latestStatus,
      storyboardImageShotCount,
      videoJobCount,
      qualityScoreCount,
      sceneCandidateCoverage,
    });

    return {
      projectId,
      currentStage,
      stages: STAGE_ORDER.map((key) => stages.find((item) => item.key === key) as ProductionStageDTO),
      missingCapabilities,
      nextActions,
      legacyDataSummary,
      riskFlags,
    };
  }

  private pickCurrentStage(stages: ProductionStageDTO[]): ProductionStage {
    const failed = stages.find((item) => item.status === 'failed');
    if (failed) return failed.key;

    const running = stages.find((item) => item.status === 'running');
    if (running) return running.key;

    const firstActionable = stages.find(
      (item) => item.key !== 'failed' && (item.status === 'missing' || item.status === 'blocked')
    );
    return firstActionable?.key || 'exported';
  }

  private buildRiskFlags(input: {
    hasCanonicalStorySource: boolean;
    hasLegacyNovelSource: boolean;
    hasLegacyStructure: boolean;
    hasStudioStoryBible: boolean;
    hasStudioCharacterBibles: boolean;
    hasStudioLocationBibles: boolean;
    hasStudioEpisodePlans: boolean;
    hasStudioDirectorScripts: boolean;
    hasStudioShotScripts: boolean;
    hasStudioStoryboardAssets: boolean;
    studioStoryboardImageAssetCount: number;
    hasStudioVideoPrompts: boolean;
    isAnalysisFailed: boolean;
    latestStatus: string | null;
    storyboardImageShotCount: number;
    videoJobCount: number;
    qualityScoreCount: number;
    sceneCandidateCoverage: ProductionSceneCandidateCoverageDTO;
  }): string[] {
    const flags: string[] = [];

    if (!input.hasCanonicalStorySource && input.hasLegacyNovelSource) {
      flags.push('只有旧 NovelSource/Novel，可兼容映射为 StorySource，但尚未建立标准 StorySource。');
    }
    if (!input.hasLegacyStructure) {
      flags.push('未发现旧 Episode/Scene/Shot 结构数据，Studio v2 只能显示空态。');
    }
    if (input.isAnalysisFailed) {
      flags.push(`最近小说分析任务失败：${input.latestStatus || 'UNKNOWN'}。`);
    }
    if (input.storyboardImageShotCount > 0) {
      flags.push('发现旧图片/分镜资产，但还没有 StoryboardAsset 协议绑定。');
    }
    if (input.videoJobCount > 0) {
      flags.push('发现旧 VideoJob，但还没有 Studio v2 视频生成工作台。');
    }
    if (input.qualityScoreCount > 0) {
      flags.push('发现旧 QualityScore，但还没有 QualityReview 聚合审片报告。');
    }
    if (input.hasLegacyNovelSource && input.sceneCandidateCoverage.coverageStatus === 'missing') {
      flags.push(
        `小说分析质量不足：${input.sceneCandidateCoverage.blockerReason} ${input.sceneCandidateCoverage.nextAction}`
      );
    }
    if (input.hasLegacyNovelSource && input.sceneCandidateCoverage.coverageStatus === 'insufficient') {
      const missing = input.sceneCandidateCoverage.missingCapabilities.length
        ? ` 缺失能力：${input.sceneCandidateCoverage.missingCapabilities.join('、')}。`
        : '';
      flags.push(
        `小说分析质量不足：${input.sceneCandidateCoverage.blockerReason}${missing} ${input.sceneCandidateCoverage.nextAction}`
      );
    }

    if (!input.hasStudioStoryBible) {
      flags.push('StoryBible 尚未真实生成；CharacterBible、LocationBible、EpisodePlan、ShotScript 仍为空态展示。');
    } else if (!input.hasStudioCharacterBibles) {
      flags.push('StoryBible 已生成；CharacterBible 尚未真实生成，LocationBible、EpisodePlan、ShotScript 仍为空态展示。');
    } else if (!input.hasStudioLocationBibles) {
      flags.push('StoryBible 与 CharacterBible 已生成；LocationBible 尚未真实生成，EpisodePlan、ShotScript 仍为空态展示。');
    } else if (!input.hasStudioEpisodePlans) {
      flags.push('StoryBible、CharacterBible 与 LocationBible 已生成；EpisodePlan 尚未真实生成，DirectorScript、ShotScript 仍为空态展示。');
    } else if (!input.hasStudioDirectorScripts) {
      flags.push('StoryBible、CharacterBible、LocationBible 与 EpisodePlan 已生成；DirectorScript 尚未真实生成，ShotScript 仍为空态展示。');
    } else if (!input.hasStudioShotScripts) {
      flags.push('StoryBible、CharacterBible、LocationBible、EpisodePlan 与 DirectorScript 已生成；ShotScript 尚未真实生成，StoryboardAsset 仍为空态展示。');
    } else if (!input.hasStudioStoryboardAssets) {
      flags.push('StoryBible、CharacterBible、LocationBible、EpisodePlan、DirectorScript 与 ShotScript 已生成；StoryboardAsset 尚未真实生成，图片分镜、VideoPrompt、视频仍为空态展示。');
    } else if (!input.hasStudioVideoPrompts) {
      if (input.studioStoryboardImageAssetCount === 0) {
        flags.push('StoryboardAsset 文本绑定已生成；真实图片分镜仍未生成，VideoPrompt 与视频仍为空态展示。');
      } else {
        flags.push('真实单镜头 Storyboard 图像资产已生成；VideoPrompt 与视频仍为空态展示。');
      }
    } else if (input.studioStoryboardImageAssetCount === 0) {
      flags.push('StoryboardAsset 文本绑定与 VideoPrompt 已生成；真实图片分镜、视频任务、审片评分和导出包仍为空态展示。');
    } else {
      flags.push('StoryBible、CharacterBible、LocationBible、EpisodePlan、DirectorScript、ShotScript、StoryboardAsset 与 VideoPrompt 已生成；视频任务、审片评分和导出包仍为空态展示。');
    }
    return flags;
  }
}
