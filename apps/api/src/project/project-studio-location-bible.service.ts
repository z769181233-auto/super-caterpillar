import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationBibleDTO } from '@scu/shared-types';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

type JsonRecord = Record<string, unknown>;

const LOCATION_BIBLE_VERSION = 'studio-location-bible-v1';
const SAMPLE_LOCATION_NAMES = ['静水院', '云墨斋'];

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

function buildMissing(projectId: string, reason: string): LocationBibleDTO[] {
  return [
    {
      id: null,
      projectId,
      locationId: null,
      name: '未生成场景资产',
      status: 'missing',
      functionRole: null,
      architectureStyle: null,
      lightingMood: null,
      props: [],
      reusableShotPrompts: [],
      visualPrompt: null,
      linkedEpisodeIds: [],
      linkedShotIds: [],
      assetIds: [],
      sourceEvidence: [],
      generatedAt: null,
      version: LOCATION_BIBLE_VERSION,
      missingReason: reason,
    },
  ];
}

function extractLocationNames(text: string): string[] {
  const names: string[] = [];

  for (const name of SAMPLE_LOCATION_NAMES) {
    if (text.includes(name)) names.push(name);
  }

  const namedPlaceMatches =
    text.match(/[\u4e00-\u9fa5]{1,5}(?:院|斋|府|宅|堂|阁|楼|厅|房|书房|花园|长廊|回廊|庭院|门外|窗下)/g) || [];
  names.push(...namedPlaceMatches);

  return uniq(names)
    .filter((name) => !/章节|故事|场景|当前|角色|小说|生成|分析|素材|结构/.test(name))
    .slice(0, 10);
}

function findContext(text: string, name: string): string {
  const index = text.indexOf(name);
  if (index < 0) return truncate(text.replace(/\s+/g, ' '), 180);
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + name.length + 160);
  return truncate(text.slice(start, end).replace(/\s+/g, ' '), 260);
}

function inferFunctionRole(name: string, context: string): string {
  if (/书|斋/.test(name + context)) return '读书、密谈、发现线索和权力信息流转的室内场景';
  if (/院|宅|府|庭/.test(name + context)) return '人物日常行动、家族秩序和关系压力发生的宅院空间';
  if (/门|廊/.test(name + context)) return '人物进出、偷听、转场和追逐调度的过渡空间';
  if (/房|厅|堂/.test(name + context)) return '对话、盘问、家族规训和关系冲突的室内空间';
  return '从故事来源中识别出的可复用剧情场景';
}

function inferArchitectureStyle(name: string, context: string): string {
  if (/古|姑娘|夫人|嬷嬷|公子|院|斋|府|宅|律法|朝政/.test(name + context)) {
    return '古风宅院建筑：木构门窗、屏风、书案、廊柱、庭院植被和细腻陈设';
  }
  return '连续剧集动画场景：需要后续美术设定补充建筑结构、材质和空间动线';
}

function inferLightingMood(name: string, context: string): string {
  if (/窗|书|偷读|藏/.test(name + context)) return '窗侧柔光与室内暗部对比，营造谨慎、压抑和秘密感';
  if (/夜|灯|烛/.test(context)) return '低照度烛光，强调紧张关系与局部视线';
  if (/院|庭|花/.test(name + context)) return '自然天光与庭院阴影，保留古风空间层次';
  return '根据剧情情绪配置光影，优先保证人物关系和动作可读';
}

function inferProps(name: string, context: string): string[] {
  const props: string[] = [];
  if (/书|律法|斋/.test(name + context)) props.push('书册', '卷轴', '书案', '墨砚');
  if (/窗|院|庭/.test(name + context)) props.push('木窗', '石径', '花木');
  if (/嬷嬷|规矩|盘问|厅|堂/.test(context)) props.push('茶盏', '屏风', '坐席');
  if (/门|廊/.test(name + context)) props.push('木门', '廊柱', '灯笼');
  return uniq(props).slice(0, 8);
}

function buildLocation(projectId: string, name: string, text: string, generatedAt: string): LocationBibleDTO {
  const context = findContext(text, name);
  const functionRole = inferFunctionRole(name, context);
  const architectureStyle = inferArchitectureStyle(name, context);
  const lightingMood = inferLightingMood(name, context);
  const props = inferProps(name, context);

  return {
    id: `project-metadata:${projectId}:location-bible:${encodeURIComponent(name)}`,
    projectId,
    locationId: null,
    name,
    status: 'done',
    functionRole,
    architectureStyle,
    lightingMood,
    props,
    reusableShotPrompts: [
      `${name} 建立镜头：交代空间格局、入口、主要道具和人物行动路线。`,
      `${name} 关系镜头：利用门窗、屏风或廊柱分隔人物，强调权力距离。`,
      `${name} 情绪镜头：用光影与道具细节承接人物心理变化。`,
    ],
    visualPrompt: `${name}，${architectureStyle}，${lightingMood}，关键道具：${props.join('、') || '待补充'}，古风动画场景设定图，保持可复用空间连续性。`,
    linkedEpisodeIds: [],
    linkedShotIds: [],
    assetIds: [],
    sourceEvidence: [context],
    generatedAt,
    version: LOCATION_BIBLE_VERSION,
    missingReason: null,
  };
}

@Injectable()
export class ProjectStudioLocationBibleService {
  constructor(private readonly prisma: PrismaService) {}

  async getLocationBibles(projectId: string, organizationId: string): Promise<LocationBibleDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const locationBibles = asArray(asRecord(asRecord(project.metadata).animationStudio).locationBibles);
    if (locationBibles.length === 0) {
      return buildMissing(projectId, '场景资产未生成');
    }

    return locationBibles.map((location) => ({
      ...buildMissing(projectId, '场景资产未生成')[0],
      ...(asRecord(location) as JsonRecord),
      projectId,
      status: 'done',
      missingReason: null,
      version: asString(asRecord(location).version) || LOCATION_BIBLE_VERSION,
    })) as LocationBibleDTO[];
  }

  async generateLocationBibles(projectId: string, organizationId: string): Promise<LocationBibleDTO[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, metadata: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const sceneScope = {
      OR: [{ projectId }, { episode: { projectId } }],
    };

    const [storySource, novelSource, novel, scenes] = await Promise.all([
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
      this.prisma.scene.findMany({
        where: sceneScope,
        orderBy: { sceneIndex: 'asc' },
        take: 40,
        select: {
          id: true,
          title: true,
          summary: true,
          enrichedText: true,
          locationSlug: true,
          timeOfDay: true,
          environmentTags: true,
        },
      }),
    ]);

    if (!storySource && !novelSource && !novel && scenes.length === 0) {
      throw new BadRequestException('No StorySource, legacy novel source, or scene source found');
    }

    const animationStudio = asRecord(asRecord(project.metadata).animationStudio);
    const storyBibleText = Object.values(asRecord(animationStudio.storyBible))
      .filter((value) => typeof value === 'string')
      .join(' ');
    const characterBibleText = asArray(animationStudio.characterBibles)
      .map((character) => Object.values(asRecord(character)).filter((value) => typeof value === 'string').join(' '))
      .join(' ');
    const chapterText =
      novel?.chapters
        ?.map((chapter) =>
          [chapter.title, chapter.summary, chapter.rawContent].filter(Boolean).join(' ')
        )
        .join(' ') || '';
    const sceneText = scenes
      .map((scene) =>
        [
          scene.locationSlug,
          scene.title,
          scene.summary,
          scene.enrichedText,
          scene.timeOfDay,
          ...(scene.environmentTags || []),
        ]
          .filter(Boolean)
          .join(' ')
      )
      .join(' ');
    const sourceText = [project.name, storySource?.name, novel?.title, storyBibleText, characterBibleText, chapterText, sceneText]
      .filter(Boolean)
      .join(' ');

    const names = extractLocationNames(sourceText);
    if (names.length === 0) {
      throw new BadRequestException('No reusable location candidates found in current story source');
    }

    const generatedAt = new Date().toISOString();
    const locationBibles = names.map((name) => buildLocation(projectId, name, sourceText, generatedAt));

    const metadata = asRecord(project.metadata);
    const nextMetadata = {
      ...metadata,
      animationStudio: {
        ...animationStudio,
        locationBibles,
      },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.project.update({
      where: { id: projectId },
      data: { metadata: nextMetadata },
    });

    return locationBibles;
  }
}
