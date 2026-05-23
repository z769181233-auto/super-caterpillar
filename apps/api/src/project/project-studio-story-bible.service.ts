import { Injectable, NotFoundException } from '@nestjs/common';
import { StoryBibleDTO, StorySourceKind } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const STORY_BIBLE_VERSION = 'studio-story-bible-v1';
const STORY_BIBLE_MIN_QUALITY_SCORE = 70;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textList(value: unknown): string[] {
  return asArray(value)
    .map((item) => (typeof item === 'string' ? item.trim() : null))
    .filter(Boolean) as string[];
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function pickText(parts: Array<string | null | undefined>, fallback: string): string {
  const text = parts.filter(Boolean).join('；').trim();
  return text ? truncate(text, 800) : fallback;
}

function buildMissing(projectId: string, reason: string): StoryBibleDTO {
  return {
    id: null,
    project_id: projectId,
    projectId,
    source_type: 'unknown',
    status: 'missing',
    title: null,
    logline: null,
    genre: null,
    theme: null,
    tone: null,
    story_world: null,
    main_characters: [],
    worldview: null,
    mainConflict: null,
    emotionalArc: null,
    characterRelationship: null,
    longTermForeshadowing: [],
    season_arc: null,
    continuity_rules: [],
    visualStyle: null,
    targetPlatform: null,
    adaptationStrategy: null,
    audienceHook: null,
    sourceSummary: null,
    sourceEvidence: [],
    source_evidence: [],
    quality_score: null,
    blockers: [reason],
    missingReasons: [reason],
    generatedAt: null,
    version: STORY_BIBLE_VERSION,
    missingReason: reason,
  };
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeName(value: string): string {
  return value.replace(/[“”「」『』：:，,。！？\s]/g, '').trim();
}

function extractNamesFromText(text: string): string[] {
  const known = ['薛知盈', '萧昀祈', '王嬷嬷', '春桃', '大公子'];
  const knownMatches = known.filter((name) => text.includes(name));
  const looseMatches = Array.from(text.matchAll(/[\u4e00-\u9fa5]{2,4}(?=说|问|道|看向|走进|回府|推门|藏|陪|守)/g))
    .map((match) => normalizeName(match[0]))
    .filter((name) => name.length >= 2 && name.length <= 4);
  return uniq([...knownMatches, ...looseMatches]).slice(0, 6);
}

function extractLocationNames(text: string): string[] {
  const known = ['静水院', '云墨斋', '祖宅庭院', '城门大道', '宗门广场', '山门石阶', '藏书阁', '夜雨长廊', '偏殿', '禁地'];
  const knownMatches = known.filter((name) => text.includes(name));
  const suffixMatches = Array.from(text.matchAll(/[\u4e00-\u9fa5]{1,6}(?:院|斋|阁|殿|府|宫|门|廊|庭|楼|堂|书房|偏院)/g))
    .map((match) => normalizeName(match[0]))
    .filter((name) => name.length >= 2 && name.length <= 8);
  return uniq([...knownMatches, ...suffixMatches]).slice(0, 6);
}

function extractCoverageFacts(sceneDrafts: Array<{ analysisResult: unknown }>): {
  characters: string[];
  locations: string[];
  evidence: string[];
} {
  const characters: string[] = [];
  const locations: string[] = [];
  const evidence: string[] = [];

  for (const draft of sceneDrafts) {
    const coverageReport = asRecord(asRecord(draft.analysisResult).coverageReport);
    for (const character of asArray(coverageReport.normalizedCharacters).concat(
      asArray(coverageReport.extractedCharacters)
    )) {
      if (typeof character === 'string') characters.push(character);
      else {
        const record = asRecord(character);
        const name = asString(record.name) || asString(record.canonicalName);
        if (name) characters.push(name);
      }
    }
    for (const location of asArray(coverageReport.extractedLocations)) {
      if (typeof location === 'string') locations.push(location);
      else {
        const record = asRecord(location);
        const name = asString(record.name) || asString(record.location);
        if (name) locations.push(name);
      }
    }
    for (const candidate of asArray(coverageReport.sceneCandidates)) {
      const record = asRecord(candidate);
      const summary = asString(record.summary);
      const text = asString(record.text);
      const id = asString(record.id) || asString(record.candidateId);
      if (summary || text) {
        evidence.push(`sceneCandidate:${id || evidence.length + 1}:${truncate(summary || text || '', 180)}`);
      }
      characters.push(...textList(record.characters));
      const location = asString(record.location);
      if (location) locations.push(location);
    }
  }

  return {
    characters: uniq(characters).slice(0, 8),
    locations: uniq(locations).slice(0, 8),
    evidence: uniq(evidence).slice(0, 8),
  };
}

export function validateStoryBibleQuality(storyBible: StoryBibleDTO): {
  passed: boolean;
  qualityScore: number;
  blockers: string[];
} {
  const blockers: string[] = [];
  const sourceEvidence = storyBible.source_evidence || storyBible.sourceEvidence || [];
  const hasSource =
    storyBible.source_type === 'novel_import' ||
    storyBible.source_type === 'ai_original' ||
    storyBible.source_type === 'legacy_novel_source' ||
    sourceEvidence.some((item) => /StorySource:|Novel:|NovelSource:/i.test(item));
  const coreLocations = storyBible.story_world?.core_locations || [];
  const qualityScore =
    typeof storyBible.quality_score === 'number' && Number.isFinite(storyBible.quality_score)
      ? storyBible.quality_score
      : 0;

  if (!hasSource) blockers.push('缺少 StorySource 或 NovelSource compatibility。');
  if (!asString(storyBible.title)) blockers.push('缺少 title。');
  if (!asString(storyBible.logline)) blockers.push('缺少 logline。');
  if (!asString(storyBible.theme)) blockers.push('缺少 theme。');
  if (!asString(storyBible.tone)) blockers.push('缺少 tone。');
  if ((storyBible.main_characters || []).length < 2) blockers.push('main_characters 少于 2 个。');
  if (coreLocations.length < 1) blockers.push('story_world.core_locations 少于 1 个。');
  if (sourceEvidence.length < 3) blockers.push('source_evidence 少于 3 条。');
  if (qualityScore < STORY_BIBLE_MIN_QUALITY_SCORE) {
    blockers.push(`quality_score 低于门槛：${qualityScore}/${STORY_BIBLE_MIN_QUALITY_SCORE}。`);
  }

  return {
    passed: blockers.length === 0,
    qualityScore,
    blockers,
  };
}

function completeStoryBible(storyBible: StoryBibleDTO): StoryBibleDTO {
  const validation = validateStoryBibleQuality(storyBible);
  const status = validation.passed ? 'ready' : 'blocked';
  return {
    ...storyBible,
    status,
    quality_score: validation.qualityScore,
    blockers: validation.blockers,
    missingReasons: validation.blockers,
    missingReason: validation.passed ? null : validation.blockers.join('；'),
    source_evidence: storyBible.source_evidence || storyBible.sourceEvidence,
  };
}

@Injectable()
export class ProjectStudioStoryBibleService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoryBible(projectId: string, organizationId: string): Promise<StoryBibleDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const storyBible = asRecord(asRecord(project.metadata).animationStudio).storyBible;
    if (!storyBible || typeof storyBible !== 'object' || Array.isArray(storyBible)) {
      return buildMissing(projectId, '故事圣经未生成');
    }

    return completeStoryBible({
      ...buildMissing(projectId, '故事圣经未生成'),
      ...(storyBible as JsonRecord),
      projectId,
      project_id: projectId,
      version: asString((storyBible as JsonRecord).version) || STORY_BIBLE_VERSION,
    } as StoryBibleDTO);
  }

  async generateStoryBible(projectId: string, organizationId: string): Promise<StoryBibleDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, description: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [storySource, novelSource, novel, sceneDrafts] = await Promise.all([
      this.prisma.storySource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          path: true,
          chunks: {
            orderBy: { chunkIndex: 'asc' },
            take: 5,
            select: { chunkIndex: true, contentPreview: true, textHash: true },
          },
        },
      }),
      this.prisma.novelSource.findUnique({
        where: { projectId },
        select: { id: true, fileName: true, totalChapters: true, rawText: true },
      }),
      this.prisma.novel.findUnique({
        where: { projectId },
        select: {
          id: true,
          title: true,
          author: true,
          fileName: true,
          chapterCount: true,
          chapters: {
            orderBy: { index: 'asc' },
            take: 8,
            select: { index: true, title: true, summary: true, rawContent: true },
          },
        },
      }),
      this.prisma.sceneDraft.findMany({
        where: { chapter: { novelSource: { projectId } } },
        orderBy: { createdAt: 'desc' },
        take: 120,
        select: { analysisResult: true },
      }),
    ]);

    if (!storySource && !novelSource && !novel) {
      return {
        ...buildMissing(projectId, '缺少 StorySource 或 NovelSource compatibility，无法生成 StoryBible。'),
        status: 'blocked',
      };
    }

    const sourceTitle = novel?.title || storySource?.name || project.name;
    const chapterSummaries =
      novel?.chapters?.map((chapter) =>
        pickText(
          [
            chapter.title ? `第 ${chapter.index} 章：${chapter.title}` : `第 ${chapter.index} 章`,
            chapter.summary,
            chapter.rawContent ? truncate(chapter.rawContent.replace(/\s+/g, ' '), 180) : null,
          ],
          `第 ${chapter.index} 章暂无摘要`
        )
      ) || [];
    const storySourceEvidence =
      storySource?.chunks
        ?.map((chunk) =>
          chunk.contentPreview
            ? `StoryChunk:${storySource.id}:${chunk.chunkIndex}:${truncate(chunk.contentPreview, 160)}`
            : `StoryChunk:${storySource.id}:${chunk.chunkIndex}:${chunk.textHash}`
        )
        .filter(Boolean) || [];
    const rawTextEvidence = novelSource?.rawText
      ? [`NovelSourceRawText:${novelSource.id}:${truncate(novelSource.rawText.replace(/\s+/g, ' '), 180)}`]
      : [];
    const coverageFacts = extractCoverageFacts(sceneDrafts);
    const chapterCount = novel?.chapterCount || novelSource?.totalChapters || chapterSummaries.length;
    const sourceSummary = pickText(
      [
        project.description,
        ...chapterSummaries.slice(0, 4),
        storySourceEvidence[0],
        rawTextEvidence[0],
      ],
      '当前故事来源已有导入记录，但缺少章节摘要；已生成最小故事圣经骨架。'
    );
    const likelyAncientStyle = /姑娘|夫人|嬷嬷|王府|院|宫|侯|公子|少爷|丫鬟|律法|朝政/.test(sourceSummary);
    const sourceType: StorySourceKind = storySource
      ? 'novel_import'
      : novel || novelSource
        ? 'legacy_novel_source'
        : 'unknown';
    const names = uniq([
      ...coverageFacts.characters,
      ...extractNamesFromText(sourceSummary),
      ...chapterSummaries.flatMap(extractNamesFromText),
    ]).slice(0, 6);
    const locationNames = uniq([
      ...coverageFacts.locations,
      ...extractLocationNames(sourceSummary),
      ...chapterSummaries.flatMap(extractLocationNames),
    ]).slice(0, 6);
    const sourceEvidence = uniq([
      storySource ? `StorySource:${storySource.id}` : '',
      novel ? `Novel:${novel.id}` : '',
      novelSource ? `NovelSource:${novelSource.id}` : '',
      `chapterCount:${chapterCount}`,
      ...chapterSummaries.slice(0, 3).map((item, index) => `ChapterEvidence:${index + 1}:${truncate(item, 180)}`),
      ...coverageFacts.evidence,
      ...storySourceEvidence.slice(0, 2),
      ...rawTextEvidence,
    ]);
    const mainCharacters = names.map((name, index) => ({
      character_id: `character:${index + 1}:${name}`,
      name,
      role: index === 0 ? '主角/核心视角' : '关键关系角色',
      motivation: index === 0 ? '在压力中争取主动选择' : '推动关系压力与剧情冲突',
      conflict: '需要在后续 CharacterBible 中细化动机与关系转折',
      visual_identity: likelyAncientStyle ? '古风服饰与宅院关系语境' : '待 CharacterBible 细化',
    }));
    const coreLocations = locationNames.map((name, index) => ({
      location_id: `location:${index + 1}:${name}`,
      name,
      description: index === 0 ? '第一集核心戏剧空间' : '后续场次可复用空间',
    }));
    const logline = pickText(
      [
        chapterSummaries[0],
        names.length ? `${names[0]}必须在关系压力中守住秘密并作出选择。` : null,
      ],
      `${sourceTitle}围绕人物处境、关系压力与第一集追看钩子展开。`
    );
    const theme = likelyAncientStyle ? '身份秩序下的自我选择与关系博弈' : '人物在连续冲突中的成长与选择';
    const tone = likelyAncientStyle ? '细腻、克制、带悬念的古风关系张力' : '剧情向、连续悬念、人物驱动';
    const qualityScore = Math.min(
      100,
      20 +
        (sourceTitle ? 10 : 0) +
        (logline ? 10 : 0) +
        (theme ? 10 : 0) +
        (tone ? 10 : 0) +
        Math.min(mainCharacters.length, 2) * 10 +
        Math.min(coreLocations.length, 1) * 10 +
        Math.min(sourceEvidence.length, 3) * 5
    );

    const storyBible: StoryBibleDTO = {
      id: `project-metadata:${projectId}:story-bible`,
      project_id: projectId,
      projectId,
      source_type: sourceType,
      status: 'draft',
      title: sourceTitle,
      logline,
      genre: likelyAncientStyle ? '古风剧情 / 女性成长 / 权谋关系' : '剧情向长篇改编',
      theme,
      tone,
      story_world: {
        setting: likelyAncientStyle
          ? '古代宅院、家族秩序与权力关系构成的连续叙事世界。'
          : '基于导入故事材料建立的连续动画叙事世界。',
        time_period: likelyAncientStyle ? '架空古风' : null,
        core_locations: coreLocations,
      },
      main_characters: mainCharacters,
      worldview: likelyAncientStyle
        ? '以古代宅院、家族秩序与权力关系为核心的叙事世界。'
        : '基于导入小说章节建立的连续叙事世界。',
      mainConflict: pickText(
        [
          chapterSummaries[0],
          chapterSummaries[1],
          '核心冲突需要在后续 Phase 2B 通过角色关系与场景拆解继续细化。',
        ],
        '核心冲突暂未从章节中稳定提取。'
      ),
      emotionalArc: '从处境压力、关系试探到主动选择，后续需要按集拆分为明确情绪曲线。',
      characterRelationship: '当前仅建立故事层关系判断，尚未生成独立 CharacterBible，不能视为角色资产完成。',
      longTermForeshadowing: chapterSummaries.slice(0, 3).map((item) => truncate(item, 120)),
      season_arc: pickText(
        [chapterSummaries[0], chapterSummaries[1], '第一阶段围绕秘密、关系压力和主动选择推进。'],
        '第一阶段围绕人物处境和核心冲突推进。'
      ),
      continuity_rules: [
        'StoryBible 只定义故事层约束，不代表 CharacterBible 或 LocationBible 已完成。',
        '后续 EpisodePlan / DirectorScript / ShotScript 必须继续绑定 source evidence。',
        '本阶段不生成图片、视频或 worker 任务。',
      ],
      visualStyle: likelyAncientStyle
        ? '古风动画制作基调：细腻服饰、院落空间、柔和自然光、关系张力驱动镜头。'
        : '连续剧集动画制作基调：强调人物关系、场景连续性与镜头叙事。',
      targetPlatform: '短剧/动漫分集制作工作流',
      adaptationStrategy:
        '先建立故事圣经，再生成角色资产、场景资产、剧集规划和镜头台本；本轮不生成图片或视频。',
      audienceHook: pickText(
        [chapterSummaries[0], '用第一集明确人物处境、关系压力和结尾钩子。'],
        '用第一集建立人物处境和追看钩子。'
      ),
      sourceSummary,
      sourceEvidence,
      source_evidence: sourceEvidence,
      quality_score: qualityScore,
      blockers: [],
      missingReasons: [],
      generatedAt: new Date().toISOString(),
      version: STORY_BIBLE_VERSION,
      missingReason: null,
    };
    const completedStoryBible = completeStoryBible(storyBible);

    if (completedStoryBible.status !== 'ready') {
      return completedStoryBible;
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        storyBible: completedStoryBible,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        metadata: nextMetadata,
      },
    });

    return completedStoryBible;
  }
}
