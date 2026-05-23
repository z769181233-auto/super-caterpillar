import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from './project.service';

const DEFAULT_SCRIPT_SHOT_COUNT = 12;
const MAX_SCRIPT_SHOT_COUNT = 30;
const METADATA_TEXT_PATTERNS = [
  /^本书名称\s*[:：]/,
  /^本书作者\s*[:：]/,
  /^书名\s*[:：]/,
  /^作者\s*[:：]/,
  /^作品名称\s*[:：]/,
  /^作品作者\s*[:：]/,
  /^目录$/,
  /^第\s*\d+\s*[章节卷]\s*[:：]?\s*$/,
];

export interface GenerateVideoScriptInput {
  sceneId?: string;
  shotCount?: number;
}

export interface VideoScriptShotResult {
  shotId: string;
  index: number;
  title: string | null;
  visualDescription: string;
  actionDescription: string;
  dialogueContent: string | null;
  cameraMovement: string;
  cameraAngle: string;
  lightingPreset: string;
  durationSeconds: number;
  productionScript: ProfessionalAnimationScript;
}

export interface GenerateVideoScriptResult {
  projectId: string;
  sceneId: string;
  generated: VideoScriptShotResult[];
  skipped: number;
}

export interface ProfessionalAnimationScript {
  sceneBeat: string;
  characterBlocking: string;
  performanceNote: string;
  artDirection: string;
  soundDesign: string;
  editNote: string;
  continuity: string;
  productionRemark: string;
}

function clampShotCount(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_SCRIPT_SHOT_COUNT;
  return Math.min(MAX_SCRIPT_SHOT_COUNT, Math.max(1, n));
}

function compactText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function isScriptableNovelShotText(value: unknown): boolean {
  const text = compactText(value, 160);
  if (!text) return false;
  if (METADATA_TEXT_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (/^(copyright|all rights reserved|简介|文案)\b/i.test(text)) return false;
  return /[\u4e00-\u9fffA-Za-z0-9]/.test(text);
}

function getShotSourceText(shot: {
  novelQuote?: string | null;
  description?: string | null;
  content?: string | null;
}): string {
  return compactText(shot.novelQuote || shot.description || shot.content, 900);
}

function selectScriptableShots<T extends {
  novelQuote?: string | null;
  description?: string | null;
  content?: string | null;
}>(shots: T[], count: number): T[] {
  const limit = clampShotCount(count);
  const scriptable = shots.filter((shot) => isScriptableNovelShotText(getShotSourceText(shot)));
  return (scriptable.length > 0 ? scriptable : shots).slice(0, limit);
}

function extractDialogue(sourceText: string): string | null {
  const matches = Array.from(sourceText.matchAll(/[“"「『]([^”"」』]{2,120})[”"」』]/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  if (matches.length > 0) {
    return matches.slice(0, 3).join('\n');
  }

  const speechLike = sourceText.match(/(?:说道|问道|喊道|低声说|开口道|回答道)[：:]\s*([^。！？!?]{2,80})/);
  return speechLike?.[1]?.trim() || null;
}

function inferLighting(sourceText: string): string {
  if (/夜|黑|暗|月|灯|烛|阴影/.test(sourceText)) return '低调夜景光';
  if (/雨|雾|雪|风|寒|湿/.test(sourceText)) return '冷色环境光';
  if (/火|血|怒|杀|战|爆/.test(sourceText)) return '高反差戏剧光';
  if (/晨|阳|日|光|天/.test(sourceText)) return '自然日光';
  return '电影写实光';
}

function inferEmotion(sourceText: string): string {
  if (/惊|怕|恐|慌|逃|危|杀|死/.test(sourceText)) return '紧张';
  if (/怒|恨|吼|冲|战|打/.test(sourceText)) return '冲突';
  if (/泪|哭|痛|悔|孤/.test(sourceText)) return '悲伤';
  if (/笑|喜|暖|安/.test(sourceText)) return '缓和';
  return '推进剧情';
}

function cameraMovementForIndex(index: number): string {
  const movements = ['缓慢推进', '固定镜头', '横向跟拍', '轻微摇镜'];
  return movements[Math.abs(index - 1) % movements.length] ?? '固定镜头';
}

function cameraAngleForIndex(index: number): string {
  const angles = ['中景', '近景', '全景', '特写'];
  return angles[Math.abs(index - 1) % angles.length] ?? '中景';
}

function dramaticFunctionForIndex(index: number): string {
  const functions = ['建立情境', '推进行动', '揭示信息', '情绪反应'];
  return functions[Math.abs(index - 1) % functions.length] ?? '推进行动';
}

function normalizeCharacterNames(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => normalizeCharacterNames(item));
  if (typeof value === 'string') {
    return value
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const direct = record.name || record.characterName || record.canonicalName || record.label;
    if (typeof direct === 'string') return [direct.trim()].filter(Boolean);
    return Object.values(record).flatMap((item) => normalizeCharacterNames(item));
  }
  return [];
}

function inferSoundDesign(sourceText: string): string {
  const layers: string[] = [];
  if (/雨|水|潮|湿/.test(sourceText)) layers.push('环境层：雨声/水声作为持续底噪');
  if (/风|林|叶|门|窗/.test(sourceText)) layers.push('环境层：风声与空间回响增强场景纵深');
  if (/脚步|跑|冲|追|逃/.test(sourceText)) layers.push('动作层：脚步节奏跟随剪辑加速');
  if (/刀|剑|枪|打|撞|爆|火/.test(sourceText)) layers.push('效果层：武器/撞击/爆裂声点强化动作重音');
  if (/低声|喊|问|说|哭|笑/.test(sourceText)) layers.push('表演层：对白与呼吸声优先，音乐让位');
  return layers.length > 0
    ? layers.join('；')
    : '环境层保持克制，保留角色动作声和空间底噪，避免音乐盖过叙事信息。';
}

function buildProfessionalAnimationScript(input: {
  sourceText: string;
  sceneTitle: string;
  sceneSummary: string;
  shotTitle: string;
  index: number;
  characters?: unknown;
  cameraMovement: string;
  cameraAngle: string;
  lightingPreset: string;
  dramaticFunction: string;
  emotionalTarget: string;
}): ProfessionalAnimationScript {
  const characters = normalizeCharacterNames(input.characters);
  const performer = characters[0] || '主要角色';
  const support = characters.slice(1, 4).join('、') || '周围角色/环境';
  const beatPrefix = `第 ${input.index} 镜`;
  const sceneContext = input.sceneSummary || input.sceneTitle;

  return {
    sceneBeat: `${beatPrefix}用于${input.dramaticFunction}：围绕“${sceneContext}”推进，镜头必须让观众明确知道角色此刻的目标、阻力和情绪转折。`,
    characterBlocking: `${performer}处于画面主行动线，${support}作为视线、空间或压力来源；调度上先交代位置关系，再让角色动作推动镜头切换。`,
    performanceNote: `${performer}的表演重点是“${input.emotionalTarget}”：先用姿态和停顿表达内心，再用动作或台词释放信息，避免只靠旁白解释。`,
    artDirection: `美术按“${input.sceneTitle}”建立空间辨识度，保留能支撑剧情的道具、光源和背景层次；色彩与光线采用${input.lightingPreset}，不要堆砌无关细节。`,
    soundDesign: inferSoundDesign(input.sourceText),
    editNote: `剪辑节奏按${input.cameraAngle}/${input.cameraMovement}处理：先给观众读懂画面信息，再进入下一镜；若接动作镜，尾帧保留 6-8 帧动作余量。`,
    continuity: `连续性检查：人物站位、视线方向、道具位置、光源方向和上一镜情绪必须一致；本镜原文依据为“${compactText(input.sourceText, 120)}”。`,
    productionRemark: `制作备注：这是动画分镜脚本镜头，不是小说摘要。后续可交给分镜、美术、声音和剪辑继续细化为图片故事板或动态预演。`,
  };
}

export function buildVideoScriptFields(input: {
  projectName: string;
  sceneTitle?: string | null;
  sceneSummary?: string | null;
  shotTitle?: string | null;
  sourceText?: string | null;
  characters?: unknown;
  index: number;
}): VideoScriptShotResult {
  const sourceText =
    compactText(input.sourceText, 900) ||
    compactText(input.sceneSummary, 900) ||
    '当前镜头缺少原文，只能根据场景上下文生成基线脚本。';
  const sceneTitle = compactText(input.sceneTitle, 80) || '未命名场景';
  const shotTitle = compactText(input.shotTitle, 80) || `镜头 ${input.index}`;
  const sceneSummary = compactText(input.sceneSummary, 180);
  const dialogueContent = extractDialogue(sourceText);
  const cameraMovement = cameraMovementForIndex(input.index);
  const cameraAngle = cameraAngleForIndex(input.index);
  const lightingPreset = inferLighting(sourceText);
  const durationSeconds = sourceText.length > 240 ? 6 : sourceText.length > 120 ? 5 : 4;
  const actionText = sourceText.replace(/[“"「『][^”"」』]{2,120}[”"」』]/g, '').trim();
  const dramaticFunction = dramaticFunctionForIndex(input.index);
  const emotionalTarget = inferEmotion(actionText || sourceText);
  const productionScript = buildProfessionalAnimationScript({
    sourceText,
    sceneTitle,
    sceneSummary,
    shotTitle,
    index: input.index,
    characters: input.characters,
    cameraMovement,
    cameraAngle,
    lightingPreset,
    dramaticFunction,
    emotionalTarget,
  });

  return {
    shotId: '',
    index: input.index,
    title: shotTitle,
    visualDescription: [
      `场景《${sceneTitle}》的第 ${input.index} 个镜头。`,
      sceneSummary ? `场景背景：${sceneSummary}` : '',
      `画面重点：${sourceText}`,
    ]
      .filter(Boolean)
      .join('\n'),
    actionDescription: actionText || sourceText,
    dialogueContent,
    cameraMovement,
    cameraAngle,
    lightingPreset,
    durationSeconds,
    productionScript,
  };
}

@Injectable()
export class ProjectVideoScriptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService
  ) {}

  async generateForScene(
    projectId: string,
    userId: string,
    organizationId: string,
    input: GenerateVideoScriptInput = {}
  ): Promise<GenerateVideoScriptResult> {
    await this.projectService.checkOwnership(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, organizationId: true },
    });
    if (!project || project.organizationId !== organizationId) {
      throw new NotFoundException('Project not found');
    }

    const scene = await this.resolveScene(projectId, input.sceneId);
    if (!scene) {
      throw new NotFoundException('Scene not found');
    }
    if (scene.projectId !== projectId) {
      throw new ForbiddenException('Scene does not belong to project');
    }

    const targetShots = selectScriptableShots(scene.shots, clampShotCount(input.shotCount));
    const generated: VideoScriptShotResult[] = [];

    for (const shot of targetShots) {
      const fields = buildVideoScriptFields({
        projectName: project.name,
        sceneTitle: scene.title,
        sceneSummary: scene.summary || scene.enrichedText,
        shotTitle: shot.title,
        sourceText: getShotSourceText(shot),
        characters: scene.characters,
        index: shot.index,
      });

      const result: VideoScriptShotResult = {
        ...fields,
        shotId: shot.id,
        title: shot.title || fields.title,
      };
      const planningData = {
        source: 'project-video-script',
        format: 'professional-animation-script',
        sceneId: scene.id,
        projectId,
        ...result,
      } as unknown as Prisma.InputJsonValue;

      await this.prisma.shot.update({
        where: { id: shot.id },
        data: {
          visualDescription: shot.visualDescription || fields.visualDescription,
          visualPrompt:
            shot.visualPrompt ||
            `电影分镜画面：${fields.visualDescription}\n镜头：${fields.cameraAngle}，${fields.cameraMovement}，${fields.lightingPreset}`,
          actionDescription: shot.actionDescription || fields.actionDescription,
          dialogueContent: shot.dialogueContent || fields.dialogueContent,
          cameraMovement: shot.cameraMovement || fields.cameraMovement,
          cameraAngle: shot.cameraAngle || fields.cameraAngle,
          lightingPreset: shot.lightingPreset || fields.lightingPreset,
          soundFx: shot.soundFx || fields.productionScript.soundDesign,
          durationSeconds: shot.durationSeconds || fields.durationSeconds,
          durationSec: shot.durationSec || fields.durationSeconds,
          dramaticFunction: shot.dramaticFunction || fields.productionScript.sceneBeat,
          emotionalTarget: shot.emotionalTarget || fields.productionScript.performanceNote,
        },
      });

      await this.prisma.shotPlanning.upsert({
        where: { shotId: shot.id },
        update: {
          data: planningData,
          engineKey: 'local.video-script.v2',
          engineVersion: 'v2',
          confidence: 0.78,
        },
        create: {
          shotId: shot.id,
          data: planningData,
          engineKey: 'local.video-script.v2',
          engineVersion: 'v2',
          confidence: 0.78,
        },
      });

      generated.push(result);
    }

    return {
      projectId,
      sceneId: scene.id,
      generated,
      skipped: Math.max(0, scene.shots.length - targetShots.length),
    };
  }

  private async resolveScene(projectId: string, sceneId?: string) {
    const where = sceneId ? { id: sceneId } : { projectId };
    return this.prisma.scene.findFirst({
      where,
      include: {
        shots: {
          include: {
            shotPlanning: true,
          },
          orderBy: { index: 'asc' },
        },
      },
      orderBy: { sceneIndex: 'asc' },
    });
  }
}
