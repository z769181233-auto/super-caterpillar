import { Injectable, NotFoundException } from '@nestjs/common';
import { DirectorScriptDTO, EpisodePlanDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { validateEpisodePlanQuality } from './project-studio-episode-plan.service';

type JsonRecord = Record<string, unknown>;

const DIRECTOR_SCRIPT_VERSION = 'studio-director-script-v1';
const DIRECTOR_SCRIPT_MIN_QUALITY_SCORE = 70;

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

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function sourceEvidenceOf(value: unknown): string[] {
  const record = asRecord(value);
  return uniq([...stringList(record.source_evidence), ...stringList(record.sourceEvidence)]);
}

function normalizeEpisodePlan(projectId: string, value: unknown): EpisodePlanDTO {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    project_id: asString(record.project_id) || projectId,
    projectId,
    episode_id: asString(record.episode_id) || asString(record.episodeId),
    episodeId: asString(record.episodeId) || asString(record.episode_id),
    story_bible_id: asString(record.story_bible_id),
    episodeNo: asNumber(record.episodeNo) || asNumber(record.episode_no) || 0,
    episode_no: asNumber(record.episode_no) || asNumber(record.episodeNo) || 0,
    title: asString(record.title) || '未命名剧集',
    status: record.status as any,
    durationSec: asNumber(record.durationSec) || asNumber(record.duration_target_sec),
    duration_target_sec: asNumber(record.duration_target_sec) || asNumber(record.durationSec),
    logline: asString(record.logline),
    beginning: asString(record.beginning),
    middle: asString(record.middle),
    end: asString(record.end),
    plotGoal: asString(record.plotGoal),
    emotionCurve: stringList(record.emotionCurve).length ? stringList(record.emotionCurve) : stringList(record.emotional_curve),
    emotional_curve: stringList(record.emotional_curve).length ? stringList(record.emotional_curve) : stringList(record.emotionCurve),
    key_scenes: asArray(record.key_scenes) as any,
    coolPoints: stringList(record.coolPoints),
    hook: asString(record.hook),
    characters: stringList(record.characters),
    locations: stringList(record.locations),
    appearingCharacterNames: stringList(record.appearingCharacterNames),
    appearingLocationNames: stringList(record.appearingLocationNames),
    productionStatus: asString(record.productionStatus),
    sourceEvidence: stringList(record.sourceEvidence),
    source_evidence: stringList(record.source_evidence),
    quality_score: asNumber(record.quality_score),
    blockers: stringList(record.blockers),
    missingReasons: stringList(record.missingReasons),
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || 'studio-episode-plan-v1',
    missingReason: asString(record.missingReason),
  };
}

function buildMissing(projectId: string, reason: string): DirectorScriptDTO[] {
  return [
    {
      id: null,
      director_script_id: undefined,
      project_id: projectId,
      projectId,
      episode_id: 'unknown',
      episodeId: 'unknown',
      episodeNo: null,
      title: '未生成导演剧本',
      status: 'missing',
      logline: null,
      beats: [],
      sceneBeats: [],
      visual_strategy: null,
      pacing_strategy: null,
      camera_strategy: null,
      character_blocking: null,
      lighting_strategy: null,
      sound_strategy: null,
      scene_beats: [],
      keyCharacters: [],
      keyLocations: [],
      visualTone: null,
      dialogueStyle: null,
      soundDesign: null,
      pacingNotes: null,
      directorNotes: [],
      transition_notes: [],
      sourceEpisodePlanId: null,
      sourceEvidence: [],
      source_evidence: [],
      quality_score: null,
      blockers: [reason],
      missingReasons: [reason],
      generatedAt: null,
      version: DIRECTOR_SCRIPT_VERSION,
      missingReason: reason,
    },
  ];
}

function blockedDirectorScript(projectId: string, reason: string, blockers: string[] = [reason]): DirectorScriptDTO[] {
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

export function validateDirectorScriptQuality(
  directorScript: DirectorScriptDTO,
  episodePlan?: EpisodePlanDTO | null
): { passed: boolean; qualityScore: number; blockers: string[] } {
  const blockers: string[] = [];
  const sourceEvidence = sourceEvidenceOf(directorScript);
  const sceneBeats = directorScript.scene_beats || [];
  const qualityScore = asNumber(directorScript.quality_score) || 0;

  if (!episodePlan || episodePlan.status !== 'ready' || (episodePlan.quality_score || 0) < 70) {
    blockers.push('EpisodePlan 未生成或未通过质量门槛。');
  }
  if (!asString(directorScript.visual_strategy)) blockers.push('缺少 visual_strategy。');
  if (!asString(directorScript.pacing_strategy)) blockers.push('缺少 pacing_strategy。');
  if (!asString(directorScript.camera_strategy)) blockers.push('缺少 camera_strategy。');
  if (!asString(directorScript.character_blocking)) blockers.push('缺少 character_blocking。');
  if (!asString(directorScript.lighting_strategy)) blockers.push('缺少 lighting_strategy。');
  if (!asString(directorScript.sound_strategy)) blockers.push('缺少 sound_strategy。');
  if (sceneBeats.length < 3) blockers.push('scene_beats 少于 3 个。');
  if (sourceEvidence.length < 3) blockers.push('source_evidence 少于 3 条。');
  if (qualityScore < DIRECTOR_SCRIPT_MIN_QUALITY_SCORE) {
    blockers.push(`quality_score 低于门槛：${qualityScore}/${DIRECTOR_SCRIPT_MIN_QUALITY_SCORE}。`);
  }

  return {
    passed: blockers.length === 0,
    qualityScore,
    blockers,
  };
}

function completeDirectorScript(
  directorScript: DirectorScriptDTO,
  episodePlan?: EpisodePlanDTO | null
): DirectorScriptDTO {
  if (directorScript.status === 'missing') return directorScript;
  const validation = validateDirectorScriptQuality(directorScript, episodePlan);
  return {
    ...directorScript,
    status: validation.passed ? 'ready' : 'blocked',
    quality_score: validation.qualityScore,
    source_evidence: sourceEvidenceOf(directorScript),
    blockers: validation.blockers,
    missingReasons: validation.blockers,
    missingReason: validation.passed ? null : validation.blockers.join('；'),
  };
}

function buildDirectorScript(input: {
  projectId: string;
  episodePlan: EpisodePlanDTO;
  generatedAt: string;
}): DirectorScriptDTO {
  const episodeId = input.episodePlan.episode_id || input.episodePlan.episodeId || 'episode-1';
  const sourceEvidence = sourceEvidenceOf(input.episodePlan).slice(0, 6);
  const keyScenes = input.episodePlan.key_scenes || [];
  const characters = input.episodePlan.characters?.length
    ? input.episodePlan.characters
    : input.episodePlan.appearingCharacterNames;
  const locations = input.episodePlan.locations?.length
    ? input.episodePlan.locations
    : input.episodePlan.appearingLocationNames;
  const sceneBeats = keyScenes.slice(0, 3).map((scene, index) => ({
    beat_id: `episode-1-beat-${index + 1}`,
    scene_id: scene.scene_id,
    dramatic_function: scene.function,
    action: scene.summary,
    camera_intent:
      index === 0
        ? '用中景建立人物与空间关系'
        : index === 1
          ? '用推近和交叉反应放大压力'
          : '用停顿和留白强化结尾悬念',
    source_evidence: scene.source_evidence.length ? scene.source_evidence : sourceEvidence.slice(index, index + 1),
  }));
  const visualStrategy = `围绕${locations[0] || '核心地点'}建立古风空间层次，突出${characters[0] || '主角'}的心理压力。`;
  const pacingStrategy = `按${[
    input.episodePlan.beginning,
    input.episodePlan.middle,
    input.episodePlan.end,
  ]
    .filter(Boolean)
    .join(' -> ')}组织第一集节奏。`;
  const qualityScore = Math.min(
    100,
    20 +
      6 * 10 +
      Math.min(sceneBeats.length, 3) * 10 +
      Math.min(sourceEvidence.length, 3) * 5
  );

  return completeDirectorScript(
    {
      id: `project-metadata:${input.projectId}:director-script:${episodeId}`,
      director_script_id: `project-metadata:${input.projectId}:director-script:${episodeId}`,
      project_id: input.projectId,
      projectId: input.projectId,
      episode_id: episodeId,
      episodeId,
      episodeNo: input.episodePlan.episodeNo || input.episodePlan.episode_no || 1,
      title: input.episodePlan.title,
      status: 'draft',
      logline: truncate(input.episodePlan.logline || input.episodePlan.plotGoal || input.episodePlan.title, 220),
      beats: [
        `开场：${input.episodePlan.beginning || '建立人物处境。'}`,
        `推进：${input.episodePlan.middle || '放大冲突压力。'}`,
        `收束：${input.episodePlan.end || input.episodePlan.hook || '留下下一集钩子。'}`,
      ],
      sceneBeats: sceneBeats.map((beat) => `${beat.beat_id}：${beat.dramatic_function}。${beat.action}`),
      visual_strategy: visualStrategy,
      pacing_strategy: pacingStrategy,
      camera_strategy: '导演层只定义镜头语言方向：建立空间、放大反应、保留悬念；本阶段不拆 shot_no。',
      character_blocking: `围绕${characters.join('、') || '主要角色'}安排进退、对视、停顿和压力关系。`,
      lighting_strategy: '使用柔和自然光与局部阴影区分秘密行动、关系压迫和结尾悬念。',
      sound_strategy: '以环境声、脚步声、翻书声和短暂停顿塑造紧张感，不接音频生成。',
      scene_beats: sceneBeats,
      keyCharacters: characters,
      keyLocations: locations,
      visualTone: visualStrategy,
      dialogueStyle: `围绕${characters.join('、') || '角色'}的身份差异控制台词口吻，后续 ShotScript 再拆镜头级台词。`,
      soundDesign: '本阶段只给出导演层声音设计方向，不接音频或视频生成。',
      pacingNotes: pacingStrategy,
      directorNotes: [
        '这是 EpisodePlan 到 ShotScript 之间的导演剧本层，不等同于镜头台本。',
        '本轮不生成 ShotScript、分镜图、图片或视频。',
      ],
      transition_notes: ['场次之间用人物视线、动作停顿和环境声承接，不生成镜头台本。'],
      sourceEpisodePlanId: input.episodePlan.id,
      sourceEvidence,
      source_evidence: sourceEvidence,
      quality_score: qualityScore,
      blockers: [],
      missingReasons: [],
      generatedAt: input.generatedAt,
      version: DIRECTOR_SCRIPT_VERSION,
      missingReason: null,
    },
    input.episodePlan
  );
}

@Injectable()
export class ProjectStudioDirectorScriptService {
  constructor(private readonly prisma: PrismaService) {}

  async getDirectorScripts(projectId: string, organizationId: string): Promise<DirectorScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    const episodePlan = normalizeEpisodePlan(projectId, asArray(animationStudio.episodePlans)[0]);
    const directorScripts = asArray(animationStudio.directorScripts);
    if (directorScripts.length === 0) {
      return buildMissing(projectId, '导演剧本未生成');
    }

    return directorScripts.map((directorScript) =>
      completeDirectorScript(
        {
          ...buildMissing(projectId, '导演剧本未生成')[0],
          ...(asRecord(directorScript) as JsonRecord),
          projectId,
          project_id: projectId,
          episodeId: asString(asRecord(directorScript).episodeId) || asString(asRecord(directorScript).episode_id) || 'unknown',
          episode_id: asString(asRecord(directorScript).episode_id) || asString(asRecord(directorScript).episodeId) || 'unknown',
          version: asString(asRecord(directorScript).version) || DIRECTOR_SCRIPT_VERSION,
        } as DirectorScriptDTO,
        episodePlan
      )
    );
  }

  async generateDirectorScripts(projectId: string, organizationId: string): Promise<DirectorScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const episodePlan = normalizeEpisodePlan(projectId, asArray(animationStudio.episodePlans)[0]);
    const episodePlanQuality = validateEpisodePlanQuality(episodePlan, null);
    if (episodePlan.status !== 'ready' || episodePlanQuality.qualityScore < 70) {
      return blockedDirectorScript(projectId, 'EpisodePlan 未生成或未通过质量门槛。');
    }

    const directorScript = buildDirectorScript({
      projectId,
      episodePlan,
      generatedAt: new Date().toISOString(),
    });
    if (directorScript.status !== 'ready') {
      return [directorScript];
    }

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        directorScripts: [directorScript],
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return [directorScript];
  }
}
