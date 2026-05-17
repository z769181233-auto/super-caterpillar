import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DirectorScriptDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const DIRECTOR_SCRIPT_VERSION = 'studio-director-script-v1';
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

function metadataNames(items: unknown[]): string[] {
  return uniq(items.map((item) => asString(asRecord(item).name)).filter(Boolean) as string[]);
}

function sceneCandidateEvidence(value: unknown): string[] {
  return textArray(value).filter((item) => item.includes(SCENE_CANDIDATE_EVIDENCE_PREFIX));
}

function evidenceSummary(value: string): string {
  const textPart = value
    .split('|')
    .map((part) => part.trim())
    .find((part) => part.startsWith('text:'));
  return textPart ? textPart.replace(/^text:/, '').trim() : value;
}

function buildMissing(projectId: string, reason: string): DirectorScriptDTO[] {
  return [
    {
      id: null,
      projectId,
      episodeId: 'unknown',
      episodeNo: null,
      title: '未生成导演剧本',
      status: 'missing',
      logline: null,
      beats: [],
      sceneBeats: [],
      keyCharacters: [],
      keyLocations: [],
      visualTone: null,
      dialogueStyle: null,
      soundDesign: null,
      pacingNotes: null,
      directorNotes: [],
      sourceEpisodePlanId: null,
      sourceEvidence: [],
      generatedAt: null,
      version: DIRECTOR_SCRIPT_VERSION,
      missingReason: reason,
    },
  ];
}

function normalizeDirectorScript(projectId: string, value: unknown): DirectorScriptDTO {
  const record = asRecord(value);
  const fallback = buildMissing(projectId, '导演剧本未生成')[0];
  return {
    ...fallback,
    ...(record as JsonRecord),
    projectId,
    episodeId: asString(record.episodeId) || fallback.episodeId,
    episodeNo: asNumber(record.episodeNo),
    title: asString(record.title) || fallback.title,
    status: 'done',
    logline: asString(record.logline),
    beats: textArray(record.beats),
    sceneBeats: textArray(record.sceneBeats),
    keyCharacters: textArray(record.keyCharacters),
    keyLocations: textArray(record.keyLocations),
    visualTone: asString(record.visualTone),
    dialogueStyle: asString(record.dialogueStyle),
    soundDesign: asString(record.soundDesign),
    pacingNotes: asString(record.pacingNotes),
    directorNotes: textArray(record.directorNotes),
    sourceEpisodePlanId: asString(record.sourceEpisodePlanId),
    sourceEvidence: textArray(record.sourceEvidence),
    generatedAt: asString(record.generatedAt),
    version: asString(record.version) || DIRECTOR_SCRIPT_VERSION,
    missingReason: null,
  };
}

function buildBeats(input: {
  title: string;
  plotGoal: string | null;
  emotionCurve: string[];
  coolPoints: string[];
  hook: string | null;
}): string[] {
  const plotGoal = input.plotGoal || `${input.title} 的核心剧情目标尚待细化。`;
  const coolPoint = input.coolPoints[0] || '用人物选择和关系压力制造单集记忆点。';
  const emotion = input.emotionCurve.length > 0 ? input.emotionCurve.join(' → ') : '开场铺陈 → 压力上升 → 钩子收束';
  return [
    `开场：建立本集处境和主要行动目标，围绕「${truncate(plotGoal, 90)}」展开。`,
    `推进：用「${emotion}」组织场次节奏，逐步放大人物压力。`,
    `高潮：突出「${truncate(coolPoint, 80)}」，让人物做出明确选择。`,
    `收束：${input.hook || '用未解决冲突留下下一集钩子。'}`,
  ];
}

function buildSceneBeats(input: {
  emotionCurve: string[];
  plotGoal: string | null;
  sceneCandidateEvidence: string[];
}): string[] {
  if (input.sceneCandidateEvidence.length > 0) {
    return input.sceneCandidateEvidence.slice(0, 8).map((evidence, index) => {
      const sourceText = evidenceSummary(evidence);
      return `场次 ${index + 1}：基于 ${evidence.split('|')[0].trim()}。导演目标：${truncate(sourceText, 120)}。`;
    });
  }
  const curve =
    input.emotionCurve.length > 0 ? input.emotionCurve : ['开场铺陈', '压力上升', '关系转折', '钩子收束'];
  return curve.slice(0, 6).map((emotion, index) => {
    const focus = index === 0 ? input.plotGoal || '建立人物处境' : '承接上一场并推动冲突升级';
    return `场次 ${index + 1}：${emotion}。导演目标：${truncate(focus, 90)}。`;
  });
}

function buildDirectorScript(input: {
  projectId: string;
  episodePlan: JsonRecord;
  fallbackCharacters: string[];
  fallbackLocations: string[];
  visualStyle: string | null;
  generatedAt: string;
}): DirectorScriptDTO {
  const episodeNo = asNumber(input.episodePlan.episodeNo) || 1;
  const episodeId = asString(input.episodePlan.episodeId) || `episode-plan-${episodeNo}`;
  const title = asString(input.episodePlan.title) || `第 ${episodeNo} 集`;
  const plotGoal = asString(input.episodePlan.plotGoal);
  const emotionCurve = textArray(input.episodePlan.emotionCurve);
  const coolPoints = textArray(input.episodePlan.coolPoints);
  const hook = asString(input.episodePlan.hook);
  const sourceEvidence = textArray(input.episodePlan.sourceEvidence).slice(0, 6);
  const candidateEvidence = sceneCandidateEvidence(sourceEvidence);
  if (candidateEvidence.length === 0) {
    throw new BadRequestException(
      'No scene candidate evidence found for DirectorScript generation; regenerate EpisodePlan from coverageReport.sceneCandidates first'
    );
  }
  const keyCharacters =
    textArray(input.episodePlan.appearingCharacterNames).length > 0
      ? textArray(input.episodePlan.appearingCharacterNames)
      : input.fallbackCharacters.slice(0, 6);
  const keyLocations =
    textArray(input.episodePlan.appearingLocationNames).length > 0
      ? textArray(input.episodePlan.appearingLocationNames)
      : input.fallbackLocations.slice(0, 6);

  return {
    id: `project-metadata:${input.projectId}:director-script:${episodeId}`,
    projectId: input.projectId,
    episodeId,
    episodeNo,
    title,
    status: 'done',
    logline: truncate(
      `第 ${episodeNo} 集《${title}》：${plotGoal || hook || '承接剧集规划，形成导演可执行的场次节奏。'}`,
      220
    ),
    beats: buildBeats({ title, plotGoal, emotionCurve, coolPoints, hook }),
    sceneBeats: buildSceneBeats({ emotionCurve, plotGoal, sceneCandidateEvidence: candidateEvidence }),
    keyCharacters,
    keyLocations,
    visualTone: input.visualStyle || '以角色心理压力、古风空间层次和场面调度为主，不生成图片资产。',
    dialogueStyle:
      keyCharacters.length > 0
        ? `围绕 ${keyCharacters.join('、')} 的身份差异控制台词口吻，后续 ShotScript 再拆到镜头级台词。`
        : '人物台词口吻待 CharacterBible 继续补齐。',
    soundDesign: '本阶段只给出导演层声音设计方向，不接音频或视频生成。',
    pacingNotes: `建议单集节奏约 ${Math.round((asNumber(input.episodePlan.durationSec) || 300) / 60)} 分钟；后续 ShotScript 再拆成镜头时长。`,
    directorNotes: [
      '这是 EpisodePlan 到 ShotScript 之间的导演剧本层，不等同于镜头台本。',
      '本导演剧本已绑定 scene-candidate evidence，不允许用旧摘要替代。',
      '本轮不生成分镜图、图片资产或视频。',
      '下一步应把每个场次拆成 shot_id、景别、运镜、动作、台词和提示词。',
    ],
    sourceEpisodePlanId: asString(input.episodePlan.id),
    sourceEvidence,
    generatedAt: input.generatedAt,
    version: DIRECTOR_SCRIPT_VERSION,
    missingReason: null,
  };
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

    const directorScripts = asArray(asRecord(asRecord(project.metadata).animationStudio).directorScripts);
    if (directorScripts.length === 0) {
      return buildMissing(projectId, '导演剧本未生成');
    }

    return directorScripts.map((directorScript) => normalizeDirectorScript(projectId, directorScript));
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
    const episodePlans = asArray(animationStudio.episodePlans)
      .map((item) => asRecord(item))
      .filter((item) => asString(item.status) === 'done');

    if (episodePlans.length === 0) {
      throw new BadRequestException('No Studio EpisodePlan found for DirectorScript generation');
    }

    const fallbackCharacters = metadataNames(asArray(animationStudio.characterBibles));
    const fallbackLocations = metadataNames(asArray(animationStudio.locationBibles));
    const storyBible = asRecord(animationStudio.storyBible);
    const generatedAt = new Date().toISOString();
    const directorScripts = episodePlans.map((episodePlan) =>
      buildDirectorScript({
        projectId,
        episodePlan,
        fallbackCharacters,
        fallbackLocations,
        visualStyle: asString(storyBible.visualStyle),
        generatedAt,
      })
    );

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        directorScripts,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return directorScripts;
  }
}
