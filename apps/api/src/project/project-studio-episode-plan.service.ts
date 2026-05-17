import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EpisodePlanDTO, NovelSceneCandidate } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;
type EpisodePlanInput = {
  episodeId: string | null;
  episodeNo: number;
  title: string;
  text: string;
  nextTitle: string | null;
  characterNames: string[];
  locationNames: string[];
  sourceEvidence: string[];
};

const EPISODE_PLAN_VERSION = 'studio-episode-plan-v1';
const SCENE_CANDIDATE_EVIDENCE_PREFIX = 'scene-candidate:';

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildMissing(projectId: string, reason: string): EpisodePlanDTO[] {
  return [
    {
      id: null,
      projectId,
      episodeId: null,
      episodeNo: 0,
      title: '未生成剧集规划',
      status: 'missing',
      durationSec: null,
      plotGoal: null,
      emotionCurve: [],
      coolPoints: [],
      hook: null,
      appearingCharacterNames: [],
      appearingLocationNames: [],
      productionStatus: null,
      sourceEvidence: [],
      generatedAt: null,
      version: EPISODE_PLAN_VERSION,
      missingReason: reason,
    },
  ];
}

function textFromMetadataItems(items: unknown[], field: string): string[] {
  return uniq(items.map((item) => asString(asRecord(item)[field])).filter(Boolean) as string[]);
}

function isUsableSceneCandidate(value: unknown): value is NovelSceneCandidate {
  const record = asRecord(value);
  const candidateId = asString(record.candidateId);
  const text = asString(record.text);
  const confidence = asString(record.confidence);
  return Boolean(candidateId && text && confidence !== 'low');
}

function sceneCandidatesFromAnalysisResult(value: unknown): NovelSceneCandidate[] {
  const analysisResult = asRecord(value);
  const coverageReport = asRecord(analysisResult.coverageReport);
  const qualityGate = asRecord(coverageReport.qualityGate);
  if (asString(qualityGate.status) === 'blocked') {
    return [];
  }

  return asArray(coverageReport.sceneCandidates)
    .filter((candidate) => isUsableSceneCandidate(candidate))
    .map((candidate) => candidate as NovelSceneCandidate);
}

function formatSceneCandidateEvidence(candidate: NovelSceneCandidate): string {
  const parts = [
    `${SCENE_CANDIDATE_EVIDENCE_PREFIX}${candidate.candidateId}`,
    candidate.location ? `location:${candidate.location}` : null,
    candidate.characters.length > 0 ? `characters:${candidate.characters.join('、')}` : null,
    candidate.conflictSummary ? `conflict:${candidate.conflictSummary}` : null,
    `text:${truncate(candidate.text, 180)}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

function isEpisodePlanInput(value: EpisodePlanInput | null): value is EpisodePlanInput {
  return value !== null;
}

function inferNames(text: string, candidates: string[]): string[] {
  const matched = candidates.filter((name) => text.includes(name));
  return matched.length > 0 ? matched : candidates.slice(0, 4);
}

function inferEmotionCurve(text: string): string[] {
  const curve = ['开场铺陈'];
  if (/压抑|拒绝|为难|规矩|盘问|查/.test(text)) curve.push('压力上升');
  if (/偷|藏|秘密|律法|书/.test(text)) curve.push('秘密行动');
  if (/公子|回府|出现|忽然|冲突/.test(text)) curve.push('关系转折');
  curve.push('钩子收束');
  return uniq(curve).slice(0, 5);
}

function inferCoolPoints(text: string): string[] {
  const points: string[] = [];
  if (/偷|藏|秘密|律法|书/.test(text)) points.push('隐秘行动带来的紧张感');
  if (/拒绝|婚|夫人|嬷嬷|规矩/.test(text)) points.push('家族规训与个人选择的冲突');
  if (/公子|朝政|回府|萧/.test(text)) points.push('关键人物登场引发关系反转');
  if (/跑|门|廊|追/.test(text)) points.push('人物行动推动节奏');
  return points.length > 0 ? points : ['用人物选择和关系压力形成单集爽点'];
}

function inferHook(text: string, nextTitle: string | null): string {
  if (nextTitle) return `结尾钩子：把悬念引向下一段「${nextTitle}」。`;
  if (/公子|萧/.test(text)) return '结尾钩子：关键人物出现，改变主角当前处境。';
  if (/查|发现|藏/.test(text)) return '结尾钩子：秘密即将暴露，迫使主角做出下一步选择。';
  return '结尾钩子：保留未解决冲突，推动观众进入下一集。';
}

function buildEpisodePlan(input: {
  projectId: string;
  episodeId: string | null;
  episodeNo: number;
  title: string;
  text: string;
  nextTitle: string | null;
  characterNames: string[];
  locationNames: string[];
  sourceEvidence?: string[];
  generatedAt: string;
}): EpisodePlanDTO {
  return {
    id: `project-metadata:${input.projectId}:episode-plan:${input.episodeId || input.episodeNo}`,
    projectId: input.projectId,
    episodeId: input.episodeId,
    episodeNo: input.episodeNo,
    title: input.title,
    status: 'done',
    durationSec: 300,
    plotGoal: truncate(input.text || input.title, 220),
    emotionCurve: inferEmotionCurve(input.text),
    coolPoints: inferCoolPoints(input.text),
    hook: inferHook(input.text, input.nextTitle),
    appearingCharacterNames: inferNames(input.text, input.characterNames),
    appearingLocationNames: inferNames(input.text, input.locationNames),
    productionStatus: 'draft',
    sourceEvidence:
      input.sourceEvidence && input.sourceEvidence.length > 0
        ? input.sourceEvidence.slice(0, 6)
        : [truncate(input.text || input.title, 280)],
    generatedAt: input.generatedAt,
    version: EPISODE_PLAN_VERSION,
    missingReason: null,
  };
}

@Injectable()
export class ProjectStudioEpisodePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getEpisodePlans(projectId: string, organizationId: string): Promise<EpisodePlanDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const episodePlans = asArray(asRecord(asRecord(project.metadata).animationStudio).episodePlans);
    if (episodePlans.length === 0) {
      return buildMissing(projectId, '剧集规划未生成');
    }

    return episodePlans.map((episodePlan) => ({
      ...buildMissing(projectId, '剧集规划未生成')[0],
      ...(asRecord(episodePlan) as JsonRecord),
      projectId,
      status: 'done',
      missingReason: null,
      version: asString(asRecord(episodePlan).version) || EPISODE_PLAN_VERSION,
    })) as EpisodePlanDTO[];
  }

  async generateEpisodePlans(projectId: string, organizationId: string): Promise<EpisodePlanDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [storySource, novelSource, novel, legacyEpisodes, sceneDrafts] = await Promise.all([
      this.prisma.storySource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      }),
      this.prisma.novelSource.findUnique({
        where: { projectId },
        select: { id: true, fileName: true },
      }),
      this.prisma.novel.findUnique({
        where: { projectId },
        select: {
          id: true,
          title: true,
          chapters: {
            orderBy: { index: 'asc' },
            take: 12,
            select: { id: true, index: true, title: true, summary: true, rawContent: true },
          },
        },
      }),
      this.prisma.episode.findMany({
        where: { projectId },
        orderBy: { index: 'asc' },
        take: 24,
        select: {
          id: true,
          index: true,
          name: true,
          summary: true,
          status: true,
          _count: { select: { scenes: true } },
        },
      }),
      this.prisma.sceneDraft.findMany({
        where: { chapter: { novelSource: { projectId } } },
        orderBy: { createdAt: 'asc' },
        select: {
          chapterId: true,
          analysisResult: true,
        },
      }),
    ]);

    if (!storySource && !novelSource && !novel && legacyEpisodes.length === 0) {
      throw new BadRequestException('No StorySource, legacy novel source, novel chapters, or episode source found');
    }

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    const characterNames = textFromMetadataItems(asArray(animationStudio.characterBibles), 'name');
    const locationNames = textFromMetadataItems(asArray(animationStudio.locationBibles), 'name');
    const generatedAt = new Date().toISOString();

    const sceneCandidatesByChapterId = new Map<string, NovelSceneCandidate[]>();
    for (const sceneDraft of sceneDrafts) {
      const candidates = sceneCandidatesFromAnalysisResult(sceneDraft.analysisResult);
      if (candidates.length === 0) continue;
      sceneCandidatesByChapterId.set(sceneDraft.chapterId, [
        ...(sceneCandidatesByChapterId.get(sceneDraft.chapterId) || []),
        ...candidates,
      ]);
    }

    let episodeInputs: EpisodePlanInput[];
    if (legacyEpisodes.length > 0) {
      episodeInputs = legacyEpisodes.map((episode, index) => ({
        episodeId: episode.id,
        episodeNo: episode.index || index + 1,
        title: episode.name || `第 ${episode.index || index + 1} 集`,
        text: [episode.name, episode.summary, `旧结构场景数：${episode._count.scenes}`, episode.status]
          .filter(Boolean)
          .join(' '),
        nextTitle: legacyEpisodes[index + 1]?.name || null,
        characterNames,
        locationNames,
        sourceEvidence: [] as string[],
      }));
    } else {
      const chapterEpisodeInputs: Array<EpisodePlanInput | null> = (novel?.chapters || []).map(
        (chapter, index, chapters) => {
          const chapterSceneCandidates = sceneCandidatesByChapterId.get(chapter.id) || [];
          if (chapterSceneCandidates.length === 0) return null;
          const candidateCharacters = uniq(chapterSceneCandidates.flatMap((candidate) => candidate.characters));
          const candidateLocations = uniq(
            chapterSceneCandidates.map((candidate) => candidate.location).filter(Boolean) as string[]
          );
          const candidateText = chapterSceneCandidates
            .slice(0, 8)
            .map((candidate) => [candidate.text, candidate.conflictSummary].filter(Boolean).join(' '))
            .join('\n');
          return {
            episodeId: null,
            episodeNo: index + 1,
            title: `第 ${index + 1} 集：${chapter.title || `第 ${chapter.index} 章`}`,
            text: candidateText,
            nextTitle: chapters[index + 1]?.title || null,
            characterNames: uniq([...candidateCharacters, ...characterNames]),
            locationNames: uniq([...candidateLocations, ...locationNames]),
            sourceEvidence: chapterSceneCandidates
              .slice(0, 6)
              .map((candidate) => formatSceneCandidateEvidence(candidate)),
          };
        }
      );
      episodeInputs = chapterEpisodeInputs.filter(isEpisodePlanInput);
    }

    if (episodeInputs.length === 0) {
      if ((novel?.chapters || []).length > 0) {
        throw new BadRequestException(
          'No usable scene candidates found for EpisodePlan generation; rerun novel analysis quality pipeline first'
        );
      }
      throw new BadRequestException('No usable chapters or legacy episodes found for EpisodePlan generation');
    }

    const fallbackCharacters = characterNames.length > 0 ? characterNames : ['待识别主角'];
    const fallbackLocations = locationNames.length > 0 ? locationNames : ['待识别场景'];
    const episodePlans = episodeInputs.map((input) =>
      buildEpisodePlan({
        projectId,
        episodeId: input.episodeId,
        episodeNo: input.episodeNo,
        title: input.title,
        text: input.text || project.name || storySource?.name || novel?.title || novelSource?.fileName || '',
        nextTitle: input.nextTitle,
        characterNames: input.characterNames.length > 0 ? input.characterNames : fallbackCharacters,
        locationNames: input.locationNames.length > 0 ? input.locationNames : fallbackLocations,
        sourceEvidence: input.sourceEvidence,
        generatedAt,
      })
    );

    const metadata = asRecord(project.metadata);
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        episodePlans,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return episodePlans;
  }
}
