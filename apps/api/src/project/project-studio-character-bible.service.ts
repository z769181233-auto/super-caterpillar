import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CharacterBibleDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const CHARACTER_BIBLE_VERSION = 'studio-character-bible-v1';
const SAMPLE_CHARACTER_NAMES = ['薛知盈', '萧昀祈', '春桃', '王嬷嬷'];

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
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildMissing(projectId: string, reason: string): CharacterBibleDTO[] {
  return [
    {
      id: null,
      projectId,
      characterId: null,
      name: '未生成角色资产',
      status: 'missing',
      identity: null,
      age: null,
      personality: null,
      appearance: null,
      relationshipRole: null,
      profilePrompt: null,
      threeViewPrompt: null,
      expressionPrompt: null,
      costumePrompt: null,
      hairAccessoryPrompt: null,
      propPrompt: null,
      voiceStyle: null,
      linkedEpisodeIds: [],
      linkedShotIds: [],
      assetIds: [],
      sourceEvidence: [],
      generatedAt: null,
      version: CHARACTER_BIBLE_VERSION,
      missingReason: reason,
    },
  ];
}

function extractCharacterNames(text: string): string[] {
  const names: string[] = [];

  for (const name of SAMPLE_CHARACTER_NAMES) {
    if (text.includes(name)) names.push(name);
  }

  const surnameMatches = text.match(/[薛萧王李赵顾沈陆谢周林宋陈许][\u4e00-\u9fa5]{1,2}/g) || [];
  names.push(...surnameMatches.filter((name) => name.length >= 2 && name.length <= 3));

  const titledMatches =
    text.match(/[\u4e00-\u9fa5]{1,3}(?:姑娘|夫人|嬷嬷|公子|少爷|小姐|丫鬟|侍女|王爷|侯爷)/g) || [];
  names.push(...titledMatches);

  const cleanNames = uniq(names)
    .filter((name) => !/章节|故事|场景|当前|角色|小说|生成/.test(name))
    .slice(0, 8);

  return cleanNames.length > 0 ? cleanNames : ['主角'];
}

function findContext(text: string, name: string): string {
  const index = text.indexOf(name);
  if (index < 0) return truncate(text.replace(/\s+/g, ' '), 180);
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + name.length + 120);
  return truncate(text.slice(start, end).replace(/\s+/g, ' '), 220);
}

function inferIdentity(name: string, context: string): string {
  if (name.includes('嬷嬷')) return '宅院长辈/管事型角色';
  if (name.includes('春桃')) return '贴身侍女/陪伴型角色';
  if (name.includes('萧')) return '家族权力关系中的男性关键角色';
  if (name.includes('薛')) return '故事核心女性角色';
  if (/姑娘|小姐/.test(name)) return '宅院女性角色';
  if (/公子|少爷|王爷|侯爷/.test(name)) return '权贵男性角色';
  return context ? '从故事来源中识别出的角色' : '角色身份待后续细化';
}

function inferPersonality(name: string, context: string): string {
  if (/偷读|藏|小心|压抑|谨慎/.test(context)) return '谨慎、敏感，处境受限但有主动意识';
  if (/查|训|规矩|嬷嬷/.test(context) || name.includes('嬷嬷')) return '重规矩、强控制感，承担压力来源';
  if (/陪|侍|丫鬟|春桃/.test(context) || name.includes('春桃')) return '亲近、机敏，承担信息与情绪陪伴';
  if (/公子|回府|朝政|权/.test(context) || name.includes('萧')) return '克制、强势，带有权力关系张力';
  return '需要在后续 CharacterBible 精修阶段补充性格弧线';
}

function inferAppearance(name: string, context: string): string {
  if (/姑娘|薛|春桃|小姐/.test(name + context)) return '古风女性动画角色，发髻与衣裙细节需后续绑定美术资产';
  if (/嬷嬷|夫人/.test(name + context)) return '古风宅院长辈角色，服饰稳重，姿态有压迫感';
  if (/公子|萧|少爷|王爷|侯爷/.test(name + context)) return '古风男性角色，衣冠克制，轮廓清冷';
  return '外貌待后续美术设定补充';
}

function buildCharacter(projectId: string, name: string, text: string, generatedAt: string): CharacterBibleDTO {
  const context = findContext(text, name);
  const identity = inferIdentity(name, context);
  const personality = inferPersonality(name, context);
  const appearance = inferAppearance(name, context);

  return {
    id: `project-metadata:${projectId}:character-bible:${encodeURIComponent(name)}`,
    projectId,
    characterId: null,
    name,
    status: 'done',
    identity,
    age: /17岁|十七/.test(context) ? '17岁' : '原文未明确',
    personality,
    appearance,
    relationshipRole: '已从故事来源识别，角色关系图谱待 Phase 2C/2D 继续结构化',
    profilePrompt: `${name}，${identity}，${appearance}，${personality}，古风动画角色设定卡，保持同一角色身份。`,
    threeViewPrompt: `${name} 三视图：正面、侧面、背面，服饰轮廓一致，发型与配饰一致，角色设定图。`,
    expressionPrompt: `${name} 表情展示：平静、紧张、克制、犹疑、坚定，统一五官与发型。`,
    costumePrompt: `${name} 服饰细节：根据身份设计古风服装层次、衣料纹样、腰带与袖口细节。`,
    hairAccessoryPrompt: `${name} 发型头饰：根据身份设计发髻、发饰、发带或冠饰，保持连续性。`,
    propPrompt: `${name} 随身物品：从剧情上下文提取；暂未绑定具体道具资产。`,
    voiceStyle: '台词口吻待 DirectorScript 阶段结合对白细化',
    linkedEpisodeIds: [],
    linkedShotIds: [],
    assetIds: [],
    sourceEvidence: [context],
    generatedAt,
    version: CHARACTER_BIBLE_VERSION,
    missingReason: null,
  };
}

@Injectable()
export class ProjectStudioCharacterBibleService {
  constructor(private readonly prisma: PrismaService) {}

  async getCharacterBibles(projectId: string, organizationId: string): Promise<CharacterBibleDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const characterBibles = asArray(asRecord(asRecord(project.metadata).animationStudio).characterBibles);
    if (characterBibles.length === 0) {
      return buildMissing(projectId, '角色资产未生成');
    }

    return characterBibles.map((character) => ({
      ...buildMissing(projectId, '角色资产未生成')[0],
      ...(asRecord(character) as JsonRecord),
      projectId,
      status: 'done',
      missingReason: null,
      version: asString(asRecord(character).version) || CHARACTER_BIBLE_VERSION,
    })) as CharacterBibleDTO[];
  }

  async generateCharacterBibles(projectId: string, organizationId: string): Promise<CharacterBibleDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [storySource, novelSource, novel] = await Promise.all([
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
            take: 8,
            select: { index: true, title: true, summary: true, rawContent: true },
          },
        },
      }),
    ]);

    if (!storySource && !novelSource && !novel) {
      throw new BadRequestException('No StorySource or legacy novel source found');
    }

    const existingStoryBible = asRecord(asRecord(asRecord(project.metadata).animationStudio).storyBible);
    const storyBibleText = Object.values(existingStoryBible)
      .filter((value) => typeof value === 'string')
      .join(' ');
    const chapterText =
      novel?.chapters
        ?.map((chapter) =>
          [chapter.title, chapter.summary, chapter.rawContent].filter(Boolean).join(' ')
        )
        .join(' ') || '';
    const sourceText = [project.name, storySource?.name, novel?.title, storyBibleText, chapterText]
      .filter(Boolean)
      .join(' ');

    const names = extractCharacterNames(sourceText);
    const generatedAt = new Date().toISOString();
    const characterBibles = names.map((name) => buildCharacter(projectId, name, sourceText, generatedAt));

    const metadata = asRecord(project.metadata);
    const animationStudio = asRecord(metadata.animationStudio);
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        characterBibles,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return characterBibles;
  }
}
