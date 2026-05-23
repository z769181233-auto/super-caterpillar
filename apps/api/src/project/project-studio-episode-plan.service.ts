import { Injectable, NotFoundException } from '@nestjs/common';
import { EpisodePlanDTO, StoryBibleDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { validateStoryBibleQuality } from './project-studio-story-bible.service';

type JsonRecord = Record<string, unknown>;

const EPISODE_PLAN_VERSION = 'studio-episode-plan-v1';
const EPISODE_PLAN_MIN_QUALITY_SCORE = 70;

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

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((item) => (typeof item === 'string' ? item.trim() : null))
    .filter(Boolean) as string[];
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sourceEvidenceOf(value: unknown): string[] {
  const record = asRecord(value);
  return uniq([...stringList(record.source_evidence), ...stringList(record.sourceEvidence)]);
}

function storyBibleFromMetadata(projectId: string, value: unknown): StoryBibleDTO {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    project_id: asString(record.project_id) || projectId,
    projectId,
    source_type: record.source_type as any,
    status: record.status as any,
    title: asString(record.title),
    logline: asString(record.logline),
    genre: asString(record.genre),
    theme: asString(record.theme),
    tone: asString(record.tone),
    story_world: asRecord(record.story_world) as any,
    main_characters: asArray(record.main_characters) as any,
    worldview: asString(record.worldview),
    mainConflict: asString(record.mainConflict),
    emotionalArc: asString(record.emotionalArc),
    characterRelationship: asString(record.characterRelationship),
    longTermForeshadowing: stringList(record.longTermForeshadowing),
    season_arc: asString(record.season_arc),
    continuity_rules: stringList(record.continuity_rules),
    visualStyle: asString(record.visualStyle),
    targetPlatform: asString(record.targetPlatform),
    adaptationStrategy: asString(record.adaptationStrategy),
    audienceHook: asString(record.audienceHook),
    sourceSummary: asString(record.sourceSummary),
    sourceEvidence: stringList(record.sourceEvidence),
    source_evidence: stringList(record.source_evidence),
    quality_score: asNumber(record.quality_score),
    blockers: stringList(record.blockers),
    missingReasons: stringList(record.missingReasons),
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || 'studio-story-bible-v1',
    missingReason: asString(record.missingReason),
  };
}

function characterNames(storyBible: StoryBibleDTO): string[] {
  return uniq(
    (storyBible.main_characters || [])
      .map((character) => character.name)
      .filter(Boolean)
  );
}

function locationNames(storyBible: StoryBibleDTO): string[] {
  return uniq((storyBible.story_world?.core_locations || []).map((location) => location.name));
}

function buildMissing(projectId: string, reason: string): EpisodePlanDTO[] {
  return [
    completeEpisodePlan({
      id: null,
      project_id: projectId,
      projectId,
      episode_id: null,
      episodeId: null,
      story_bible_id: null,
      episodeNo: 0,
      episode_no: 0,
      title: '未生成剧集规划',
      status: 'missing',
      durationSec: null,
      duration_target_sec: null,
      logline: null,
      beginning: null,
      middle: null,
      end: null,
      plotGoal: null,
      emotionCurve: [],
      emotional_curve: [],
      key_scenes: [],
      coolPoints: [],
      hook: null,
      characters: [],
      locations: [],
      appearingCharacterNames: [],
      appearingLocationNames: [],
      productionStatus: null,
      sourceEvidence: [],
      source_evidence: [],
      quality_score: null,
      blockers: [reason],
      missingReasons: [reason],
      generatedAt: null,
      version: EPISODE_PLAN_VERSION,
      missingReason: reason,
    }),
  ];
}

function blockedEpisodePlan(projectId: string, reason: string, blockers: string[] = [reason]): EpisodePlanDTO[] {
  return [
    {
      ...buildMissing(projectId, reason)[0],
      status: 'blocked',
      blockers,
      missingReasons: blockers,
      missingReason: blockers.join('；'),
    },
  ];
}

export function validateEpisodePlanQuality(
  episodePlan: EpisodePlanDTO,
  storyBible?: StoryBibleDTO | null
): { passed: boolean; qualityScore: number; blockers: string[] } {
  const blockers: string[] = [];
  const storyBibleQuality = storyBible ? validateStoryBibleQuality(storyBible) : null;
  const evidence = sourceEvidenceOf(episodePlan);
  const keyScenes = episodePlan.key_scenes || [];
  const characters = episodePlan.characters?.length
    ? episodePlan.characters
    : episodePlan.appearingCharacterNames;
  const locations = episodePlan.locations?.length
    ? episodePlan.locations
    : episodePlan.appearingLocationNames;
  const qualityScore = asNumber(episodePlan.quality_score) || 0;

  if (!storyBible || storyBible.status !== 'ready' || !storyBibleQuality?.passed) {
    blockers.push('StoryBible 未生成或未通过质量门槛。');
  }
  if (!asString(episodePlan.beginning)) blockers.push('缺少 beginning。');
  if (!asString(episodePlan.middle)) blockers.push('缺少 middle。');
  if (!asString(episodePlan.end)) blockers.push('缺少 end。');
  if (keyScenes.length < 3) blockers.push('key_scenes 少于 3 个。');
  if (characters.length < 2) blockers.push('characters 少于 2 个。');
  if (locations.length < 1) blockers.push('locations 少于 1 个。');
  if (evidence.length < 3) blockers.push('source_evidence 少于 3 条。');
  if (!asString(episodePlan.hook)) blockers.push('缺少 hook。');
  if (qualityScore < EPISODE_PLAN_MIN_QUALITY_SCORE) {
    blockers.push(`quality_score 低于门槛：${qualityScore}/${EPISODE_PLAN_MIN_QUALITY_SCORE}。`);
  }

  return {
    passed: blockers.length === 0,
    qualityScore,
    blockers,
  };
}

function completeEpisodePlan(episodePlan: EpisodePlanDTO, storyBible?: StoryBibleDTO | null): EpisodePlanDTO {
  if (episodePlan.status === 'missing') return episodePlan;
  const validation = validateEpisodePlanQuality(episodePlan, storyBible);
  return {
    ...episodePlan,
    status: validation.passed ? 'ready' : 'blocked',
    quality_score: validation.qualityScore,
    source_evidence: sourceEvidenceOf(episodePlan),
    blockers: validation.blockers,
    missingReasons: validation.blockers,
    missingReason: validation.passed ? null : validation.blockers.join('；'),
  };
}

function buildEpisodePlan(input: {
  projectId: string;
  storyBible: StoryBibleDTO;
  generatedAt: string;
}): EpisodePlanDTO {
  const sourceEvidence = sourceEvidenceOf(input.storyBible).slice(0, 6);
  const characters = characterNames(input.storyBible);
  const locations = locationNames(input.storyBible);
  const title = `第 1 集：${input.storyBible.title || '第一集'}`;
  const firstEvidence = sourceEvidence[0] || input.storyBible.logline || input.storyBible.title || title;
  const keyScenes = [
    {
      scene_id: 'episode-1-scene-1',
      title: '处境建立',
      summary: truncate(input.storyBible.logline || firstEvidence, 160),
      function: '建立主角处境、核心地点和第一集行动目标',
      source_evidence: sourceEvidence.slice(0, 1),
    },
    {
      scene_id: 'episode-1-scene-2',
      title: '压力上升',
      summary: truncate(input.storyBible.mainConflict || input.storyBible.theme || firstEvidence, 160),
      function: '放大关系压力并制造选择困境',
      source_evidence: sourceEvidence.slice(1, 2).length ? sourceEvidence.slice(1, 2) : sourceEvidence.slice(0, 1),
    },
    {
      scene_id: 'episode-1-scene-3',
      title: '钩子收束',
      summary: truncate(input.storyBible.audienceHook || input.storyBible.season_arc || firstEvidence, 160),
      function: '保留秘密或关系反转，推动下一集',
      source_evidence: sourceEvidence.slice(2, 3).length ? sourceEvidence.slice(2, 3) : sourceEvidence.slice(0, 1),
    },
  ];
  const emotionalCurve = ['处境建立', '压力上升', '秘密行动', '悬念收束'];
  const qualityScore = Math.min(
    100,
    20 +
      10 +
      keyScenes.length * 10 +
      Math.min(characters.length, 2) * 10 +
      Math.min(locations.length, 1) * 10 +
      Math.min(sourceEvidence.length, 3) * 5 +
      15
  );

  return completeEpisodePlan(
    {
      id: `project-metadata:${input.projectId}:episode-plan:episode-1`,
      project_id: input.projectId,
      projectId: input.projectId,
      episode_id: 'episode-1',
      episodeId: 'episode-1',
      story_bible_id: input.storyBible.id,
      episodeNo: 1,
      episode_no: 1,
      title,
      status: 'draft',
      durationSec: 300,
      duration_target_sec: 300,
      logline: truncate(input.storyBible.logline || `${title} 建立第一集追看钩子。`, 220),
      beginning: `建立${characters[0] || '主角'}在${locations[0] || '核心地点'}的处境，并明确第一集行动目标。`,
      middle: `围绕${input.storyBible.theme || '核心主题'}放大关系压力，推动人物做出选择。`,
      end: input.storyBible.audienceHook || '以秘密即将暴露或关键人物出现作为下一集钩子。',
      plotGoal: truncate(input.storyBible.mainConflict || input.storyBible.logline || title, 220),
      emotionCurve: emotionalCurve,
      emotional_curve: emotionalCurve,
      key_scenes: keyScenes,
      coolPoints: ['隐秘行动带来的紧张感', '关系压力下的主动选择'],
      hook: input.storyBible.audienceHook || '结尾钩子：秘密即将暴露，迫使主角做出下一步选择。',
      characters,
      locations,
      appearingCharacterNames: characters,
      appearingLocationNames: locations,
      productionStatus: 'ready',
      sourceEvidence,
      source_evidence: sourceEvidence,
      quality_score: qualityScore,
      blockers: [],
      missingReasons: [],
      generatedAt: input.generatedAt,
      version: EPISODE_PLAN_VERSION,
      missingReason: null,
    },
    input.storyBible
  );
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

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    const storyBible = storyBibleFromMetadata(projectId, animationStudio.storyBible);
    const episodePlans = asArray(animationStudio.episodePlans);
    if (episodePlans.length === 0) {
      return buildMissing(projectId, '剧集规划未生成');
    }

    return episodePlans.map((episodePlan) =>
      completeEpisodePlan(
        {
          ...buildMissing(projectId, '剧集规划未生成')[0],
          ...(asRecord(episodePlan) as JsonRecord),
          projectId,
          project_id: projectId,
          episodeId: asString(asRecord(episodePlan).episodeId) || asString(asRecord(episodePlan).episode_id),
          episode_id: asString(asRecord(episodePlan).episode_id) || asString(asRecord(episodePlan).episodeId),
          episodeNo: asNumber(asRecord(episodePlan).episodeNo) || asNumber(asRecord(episodePlan).episode_no) || 0,
          episode_no: asNumber(asRecord(episodePlan).episode_no) || asNumber(asRecord(episodePlan).episodeNo) || 0,
          version: asString(asRecord(episodePlan).version) || EPISODE_PLAN_VERSION,
        } as EpisodePlanDTO,
        storyBible
      )
    );
  }

  async generateEpisodePlans(projectId: string, organizationId: string): Promise<EpisodePlanDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const storyBible = storyBibleFromMetadata(projectId, animationStudio.storyBible);
    const storyBibleQuality = validateStoryBibleQuality(storyBible);
    if (storyBible.status !== 'ready' || !storyBibleQuality.passed) {
      return blockedEpisodePlan(projectId, `StoryBible 未生成或未通过质量门槛：${storyBibleQuality.blockers.join('；')}`);
    }

    const episodePlan = buildEpisodePlan({
      projectId,
      storyBible,
      generatedAt: new Date().toISOString(),
    });
    if (episodePlan.status !== 'ready') {
      return [episodePlan];
    }

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        episodePlans: [episodePlan],
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return [episodePlan];
  }
}
