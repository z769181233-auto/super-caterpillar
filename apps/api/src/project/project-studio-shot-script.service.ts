import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ShotScriptCharacterDTO,
  ShotScriptDialogueDTO,
  ShotScriptDTO,
  ShotScriptStatus,
} from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import {
  filterStableSceneCandidateEvidence,
  formatSceneCandidateEvidenceBlocker,
  ParsedSceneCandidateEvidence,
  sceneCandidateEvidenceSummary,
} from './project-studio-scene-candidate-evidence';

type JsonRecord = Record<string, unknown>;

const SHOT_SCRIPT_VERSION = 'studio-shot-script-v1';

const SHOT_SIZES = ['大全景', '中景', '近景', '特写'];
const CAMERA_MOVEMENTS = ['固定镜头', '缓慢推进', '横移跟拍', '轻微推近'];
const EXPRESSIONS = ['克制', '警觉', '犹豫', '决断'];
const POSITIONS = ['画面前景', '画面中景', '侧身入画', '门窗边缘'];

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

function idSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isShotScriptStatus(value: unknown): value is ShotScriptStatus {
  return (
    value === 'draft' ||
    value === 'ready' ||
    value === 'locked' ||
    value === 'storyboard_ready' ||
    value === 'video_prompt_ready' ||
    value === 'video_generating' ||
    value === 'review_required' ||
    value === 'approved' ||
    value === 'revision_required' ||
    value === 'failed' ||
    value === 'missing'
  );
}

function buildMissing(projectId: string, reason: string): ShotScriptDTO[] {
  return [
    {
      project_id: projectId,
      shot_id: 'missing',
      episode_id: 'unknown',
      shot_no: 0,
      duration_sec: 0,
      location_id: null,
      scene_id: 'unknown',
      characters: [],
      character_id: null,
      costume_id: null,
      expression: null,
      position: null,
      action: '镜头台本未生成',
      shot_size: '未生成',
      camera_movement: '未生成',
      dialogue: [],
      voiceover: null,
      sound_design: [],
      lighting: '未生成',
      emotion: '未生成',
      visual_goal: '未生成',
      plot_function: '未生成',
      storyboard_prompt: '',
      video_prompt: '',
      continuity_notes: [],
      quality_score: null,
      status: 'missing',
      source_director_script_id: null,
      source_evidence: [],
      generated_at: null,
      version: SHOT_SCRIPT_VERSION,
      missing_reason: reason,
    },
  ];
}

function normalizeCharacter(value: unknown): ShotScriptCharacterDTO | null {
  const record = asRecord(value);
  const characterId = asString(record.character_id);
  const characterName = asString(record.character_name);
  if (!characterId || !characterName) return null;
  return {
    character_id: characterId,
    character_name: characterName,
    costume_id: asString(record.costume_id),
    expression: asString(record.expression),
    position: asString(record.position),
    action: asString(record.action),
    asset_ids: textArray(record.asset_ids),
  };
}

function normalizeDialogue(value: unknown): ShotScriptDialogueDTO | null {
  const record = asRecord(value);
  const text = asString(record.text);
  if (!text) return null;
  return {
    character_id: asString(record.character_id),
    character_name: asString(record.character_name),
    text,
    delivery: asString(record.delivery),
  };
}

function normalizeShotScript(projectId: string, value: unknown): ShotScriptDTO {
  const record = asRecord(value);
  const fallback = buildMissing(projectId, '镜头台本未生成')[0];
  const status = isShotScriptStatus(record.status) ? record.status : 'ready';
  return {
    ...fallback,
    ...(record as JsonRecord),
    project_id: projectId,
    shot_id: asString(record.shot_id) || fallback.shot_id,
    episode_id: asString(record.episode_id) || fallback.episode_id,
    shot_no: asNumber(record.shot_no) || fallback.shot_no,
    duration_sec: asNumber(record.duration_sec) || fallback.duration_sec,
    location_id: asString(record.location_id),
    scene_id: asString(record.scene_id) || fallback.scene_id,
    characters: asArray(record.characters)
      .map((item) => normalizeCharacter(item))
      .filter(Boolean) as ShotScriptCharacterDTO[],
    character_id: asString(record.character_id),
    costume_id: asString(record.costume_id),
    expression: asString(record.expression),
    position: asString(record.position),
    action: asString(record.action) || fallback.action,
    shot_size: asString(record.shot_size) || fallback.shot_size,
    camera_movement: asString(record.camera_movement) || fallback.camera_movement,
    dialogue: asArray(record.dialogue)
      .map((item) => normalizeDialogue(item))
      .filter(Boolean) as ShotScriptDialogueDTO[],
    voiceover: asString(record.voiceover),
    sound_design: textArray(record.sound_design),
    lighting: asString(record.lighting) || fallback.lighting,
    emotion: asString(record.emotion) || fallback.emotion,
    visual_goal: asString(record.visual_goal) || fallback.visual_goal,
    plot_function: asString(record.plot_function) || fallback.plot_function,
    storyboard_prompt: asString(record.storyboard_prompt) || fallback.storyboard_prompt,
    video_prompt: asString(record.video_prompt) || fallback.video_prompt,
    continuity_notes: textArray(record.continuity_notes),
    quality_score: null,
    status,
    source_director_script_id: asString(record.source_director_script_id),
    source_evidence: textArray(record.source_evidence),
    generated_at: asString(record.generated_at),
    version: asString(record.version) || SHOT_SCRIPT_VERSION,
    missing_reason: status === 'missing' ? asString(record.missing_reason) || fallback.missing_reason : null,
  };
}

function findCharacterBiblesByName(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const name = asString(record.name);
    if (name) map.set(name, record);
  }
  return map;
}

function findLocationBiblesByName(items: unknown[]): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of items) {
    const record = asRecord(item);
    const name = asString(record.name);
    if (name) map.set(name, record);
  }
  return map;
}

function buildShotCharacters(input: {
  names: string[];
  shotIndex: number;
  characterBiblesByName: Map<string, JsonRecord>;
  action: string;
}): ShotScriptCharacterDTO[] {
  const names = input.names.length > 0 ? input.names.slice(0, 3) : ['待识别角色'];
  return names.map((name, index) => {
    const characterBible = input.characterBiblesByName.get(name);
    const characterId =
      asString(characterBible?.characterId) ||
      asString(characterBible?.id) ||
      `character:${idSlug(name) || index + 1}`;
    return {
      character_id: characterId,
      character_name: name,
      costume_id: `${characterId}:default-costume`,
      expression: EXPRESSIONS[(input.shotIndex + index) % EXPRESSIONS.length],
      position: POSITIONS[(input.shotIndex + index) % POSITIONS.length],
      action: index === 0 ? truncate(input.action, 90) : '保持同场关系反应',
      asset_ids: textArray(characterBible?.assetIds),
    };
  });
}

function buildStoryboardPrompt(input: {
  title: string;
  shotNo: number;
  shotSize: string;
  cameraMovement: string;
  locationName: string;
  characterNames: string[];
  action: string;
  lighting: string;
  emotion: string;
}): string {
  return [
    `《${input.title}》镜头 ${input.shotNo}`,
    `景别：${input.shotSize}`,
    `运镜：${input.cameraMovement}`,
    `场景：${input.locationName}`,
    `人物：${input.characterNames.join('、') || '待识别角色'}`,
    `动作：${input.action}`,
    `光影：${input.lighting}`,
    `情绪：${input.emotion}`,
    '输出：只生成分镜构图提示词，本阶段不生成图片。',
  ].join('；');
}

function buildVideoPrompt(input: {
  shotSize: string;
  cameraMovement: string;
  action: string;
  lighting: string;
  emotion: string;
  soundDesign: string[];
}): string {
  return [
    `镜头语言：${input.shotSize}，${input.cameraMovement}`,
    `人物动作：${input.action}`,
    `光影气氛：${input.lighting}`,
    `情绪节奏：${input.emotion}`,
    `声音方向：${input.soundDesign.join('、') || '环境底噪'}`,
    '本字段只是镜头级视频提示词草案，本阶段不调用视频生成。',
  ].join('；');
}

function extractQuotedDialogue(text: string): string | null {
  const quoted = text.match(/[“「](.+?)[”」]/);
  if (quoted?.[1]) return quoted[1].trim();
  const colonDialogue = text.match(/[：:]\s*([^。！？；;]+)/);
  if (colonDialogue?.[1]) return colonDialogue[1].trim();
  return null;
}

function buildDialogue(input: {
  evidence: ParsedSceneCandidateEvidence;
  primaryCharacter: ShotScriptCharacterDTO | null;
  action: string;
  emotion: string;
}): ShotScriptDialogueDTO[] {
  if (!input.primaryCharacter) return [];
  const quotedDialogue = extractQuotedDialogue(input.evidence.text);
  const text = quotedDialogue || `围绕“${truncate(input.action, 34)}”给出克制反应。`;
  return [
    {
      character_id: input.primaryCharacter.character_id,
      character_name: input.primaryCharacter.character_name,
      text,
      delivery: `${input.emotion}，语气需贴合人物身份，不使用摘要占位。`,
    },
  ];
}

function buildShotScripts(input: {
  projectId: string;
  directorScript: JsonRecord;
  characterBiblesByName: Map<string, JsonRecord>;
  locationBiblesByName: Map<string, JsonRecord>;
  generatedAt: string;
}): ShotScriptDTO[] {
  const episodeId = asString(input.directorScript.episodeId) || 'episode-unknown';
  const title = asString(input.directorScript.title) || '未命名单集';
  const directorId =
    asString(input.directorScript.id) || `project-metadata:${input.projectId}:director-script:${episodeId}`;
  const evidence = textArray(input.directorScript.sourceEvidence);
  const candidateEvidence = filterStableSceneCandidateEvidence(evidence);
  if (candidateEvidence.length === 0) {
    throw new BadRequestException(
      formatSceneCandidateEvidenceBlocker('ShotScript', evidence)
    );
  }
  const finalBeats = candidateEvidence.slice(0, 8);
  const characterNames = textArray(input.directorScript.keyCharacters);
  const locationNames = textArray(input.directorScript.keyLocations);
  const defaultLighting = asString(input.directorScript.visualTone) || '以自然光与环境阴影塑造情绪压力';
  const soundDesign = [asString(input.directorScript.soundDesign) || '环境底噪', '衣料与脚步细节'];

  return finalBeats.map((evidenceItem, index) => {
    const beat = sceneCandidateEvidenceSummary(evidenceItem);
    const shotNo = index + 1;
    const shotSize = SHOT_SIZES[index % SHOT_SIZES.length];
    const cameraMovement = CAMERA_MOVEMENTS[index % CAMERA_MOVEMENTS.length];
    const locationName =
      evidenceItem.location || locationNames[index % Math.max(locationNames.length, 1)] || '待定场景';
    const locationBible = input.locationBiblesByName.get(locationName);
    const locationId =
      asString(locationBible?.locationId) ||
      asString(locationBible?.id) ||
      (locationName === '待定场景' ? null : `location:${idSlug(locationName)}`);
    const sceneId = `${episodeId}:scene-${Math.floor(index / 2) + 1}`;
    const action = truncate(beat, 160);
    const shotCharacterNames = evidenceItem.characters.length > 0 ? evidenceItem.characters : characterNames;
    const characters = buildShotCharacters({
      names: shotCharacterNames,
      shotIndex: index,
      characterBiblesByName: input.characterBiblesByName,
      action,
    });
    const primaryCharacter = characters[0] || null;
    const emotion = beat.split('：')[0] || `镜头 ${shotNo} 情绪`;
    const lighting = asString(locationBible?.lightingMood) || defaultLighting;
    const storyboardPrompt = buildStoryboardPrompt({
      title,
      shotNo,
      shotSize,
      cameraMovement,
      locationName,
      characterNames: characters.map((item) => item.character_name),
      action,
      lighting,
      emotion,
    });
    const videoPrompt = buildVideoPrompt({
      shotSize,
      cameraMovement,
      action,
      lighting,
      emotion,
      soundDesign,
    });

    return {
      project_id: input.projectId,
      shot_id: `project-metadata:${input.projectId}:shot-script:${episodeId}:${shotNo}`,
      episode_id: episodeId,
      shot_no: shotNo,
      duration_sec: shotNo === 1 ? 6 : 8,
      location_id: locationId,
      scene_id: sceneId,
      characters,
      character_id: primaryCharacter?.character_id || null,
      costume_id: primaryCharacter?.costume_id || null,
      expression: primaryCharacter?.expression || null,
      position: primaryCharacter?.position || null,
      action,
      shot_size: shotSize,
      camera_movement: cameraMovement,
      dialogue: buildDialogue({ evidence: evidenceItem, primaryCharacter, action, emotion }),
      voiceover: index === 0 ? `旁白建立本集处境：${truncate(action, 80)}` : null,
      sound_design: soundDesign,
      lighting,
      emotion,
      visual_goal: `${shotSize}呈现${locationName}中的人物选择压力。`,
      plot_function: action,
      storyboard_prompt: storyboardPrompt,
      video_prompt: videoPrompt,
      continuity_notes: [
        '沿用 CharacterBible 的服装、发型、随身物品设定；本阶段不生成图片资产。',
        locationId ? '沿用 LocationBible 的空间风格和光影氛围。' : '场景资产仍需 LocationBible 补齐后再绑定。',
        '后续分镜和视频生成必须绑定本 shot_id，不允许用旧摘要替代。',
      ],
      quality_score: null,
      status: 'ready',
      source_director_script_id: directorId,
      source_evidence: evidence.slice(0, 6),
      generated_at: input.generatedAt,
      version: SHOT_SCRIPT_VERSION,
      missing_reason: null,
    };
  });
}

@Injectable()
export class ProjectStudioShotScriptService {
  constructor(private readonly prisma: PrismaService) {}

  async getShotScripts(projectId: string, organizationId: string): Promise<ShotScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const shotScripts = asArray(asRecord(asRecord(project.metadata).animationStudio).shotScripts);
    if (shotScripts.length === 0) {
      return buildMissing(projectId, '镜头台本未生成');
    }

    return shotScripts.map((shotScript) => normalizeShotScript(projectId, shotScript));
  }

  async generateShotScripts(projectId: string, organizationId: string): Promise<ShotScriptDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const directorScripts = asArray(animationStudio.directorScripts)
      .map((item) => asRecord(item))
      .filter((item) => asString(item.status) === 'done');

    if (directorScripts.length === 0) {
      throw new BadRequestException('No Studio DirectorScript found for ShotScript generation');
    }

    const generatedAt = new Date().toISOString();
    const characterBiblesByName = findCharacterBiblesByName(asArray(animationStudio.characterBibles));
    const locationBiblesByName = findLocationBiblesByName(asArray(animationStudio.locationBibles));
    const shotScripts = directorScripts.flatMap((directorScript) =>
      buildShotScripts({
        projectId,
        directorScript,
        characterBiblesByName,
        locationBiblesByName,
        generatedAt,
      })
    );

    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        shotScripts,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return shotScripts;
  }
}
