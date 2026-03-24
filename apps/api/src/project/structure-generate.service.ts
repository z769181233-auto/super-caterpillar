import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from './project.service';
import { SceneGraphService } from './scene-graph.service';
import { AnalyzedProjectStructure } from '@scu/shared-types';
import { Prisma } from 'database';

/**
 * 剧集结构生成服务
 * 根据 NovelChapter 自动生成 Episode/Scene/SceneDraft 结构（四层结构：Project → Episode → Scene → Shot）
 */
@Injectable()
export class StructureGenerateService {
  private readonly logger = new Logger(StructureGenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly sceneGraphService: SceneGraphService
  ) {}

  private asNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private asNullableString(value: unknown): string | null {
    return this.asNonEmptyString(value) ?? null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private buildShotParams(shotData: Record<string, any>): Prisma.InputJsonObject {
    const params: Record<string, Prisma.InputJsonValue> = {};

    const sourceText = this.asNonEmptyString(shotData.text);
    if (sourceText) {
      params.sourceText = sourceText;
    }

    if (this.isRecord(shotData.camera)) {
      params.camera = shotData.camera as Prisma.InputJsonValue;
    }

    if (Array.isArray(shotData.characters)) {
      params.characters = shotData.characters as Prisma.InputJsonValue;
    }

    const action = this.asNonEmptyString(shotData.action);
    if (action) {
      params.action = action;
    }

    return params as Prisma.InputJsonObject;
  }

  private extractCameraControl(shotData: Record<string, any>, keys: string[]): string | null {
    if (!this.isRecord(shotData.camera)) {
      return null;
    }

    for (const key of keys) {
      const value = this.asNonEmptyString(shotData.camera[key]);
      if (value) {
        return value;
      }
    }

    return null;
  }

  /**
   * 生成剧集结构
   * 根据项目的 NovelChapter 自动生成 Episode/Scene/SceneDraft（四层结构：Project → Episode → Scene → Shot）
   */
  async generateStructure(projectId: string, organizationId: string): Promise<any> {
    this.logger.log(
      `Starting generateStructure for projectId: ${projectId}, organizationId: ${organizationId}`
    );

    // 获取项目
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        novelSources: {
          include: {
            chapters: {
              orderBy: { index: 'asc' },
            },
          },
        },
        episodes: {
          include: {
            scenes: true,
          },
        },
      },
    });

    if (!project || project.organizationId !== organizationId) {
      this.logger.error(`Project not found: ${projectId}`);
      throw new BadRequestException('项目不存在，无法生成结构');
    }

    this.logger.log(
      `Found project: ${project.name}, novelSource ID: ${project.novelSources?.id || 'none'}`
    );

    const novelSource = project.novelSources;
    if (!novelSource) {
      this.logger.error(`No novel source found for project: ${projectId}`);
      throw new NotFoundException('No novel source found for this project');
    }

    const chapters = novelSource.chapters || [];
    this.logger.log(`Found ${chapters.length} chapters in novel source: ${novelSource.id}`);

    // 检查是否已有结构（幂等性检查）
    const existingEpisodes = (project as any).episodes || [];
    const hasExistingStructure =
      existingEpisodes.length > 0 &&
      existingEpisodes.some((e: any) => e.scenes && e.scenes.length > 0);

    if (hasExistingStructure) {
      this.logger.log(`Existing structure found, returning current structure (idempotent)`);
      // 如果已有结构，直接返回当前结构（幂等）
      return this.projectService.findTreeById(projectId, organizationId);
    }

    // 如果没有章节，且也没有现有结构，才报错
    if (chapters.length === 0) {
      this.logger.error(`No chapters found in novel source: ${novelSource.id}`);
      throw new NotFoundException('当前项目没有可用的小说章节，请先导入并解析小说文件');
    }

    // 遍历章节，生成 Episode/Scene/SceneDraft（直接关联 Project，移除 Season 层）
    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      const chapter = chapters[chIdx];

      // 检查是否已有 Episode 关联到此 Chapter
      let episode = await this.prisma.episode.findUnique({
        where: { chapterId: chapter.id },
      });

      if (episode && episode.projectId !== projectId) {
        episode = null;
      }

      if (!episode) {
        // 创建 Episode（每章一集，直接关联 Project）
        // 使用 ProjectService 创建 Episode，确保组织隔离
        episode = await this.projectService.createEpisode(projectId, {
          index: chIdx + 1,
          name: chapter.title || `第 ${chapter.index} 章`,
        });

        // 更新 Episode 关联到 NovelChapter
        await this.prisma.episode.update({
          where: { id: episode.id },
          data: { chapterId: chapter.id },
        });
        this.logger.log(`Episode ${chIdx + 1} created: ${episode.id} (Chapter: ${chapter.title})`);
      }

      // 检查是否已有 Scene，如果有则跳过
      const existingScenes = await this.prisma.scene.findMany({
        where: { episodeId: episode.id },
      });

      if (existingScenes.length > 0) {
        this.logger.log(
          `Episode ${episode.id} already has ${existingScenes.length} scenes, skipping`
        );
        continue;
      }

      // 按段落切分章节，生成 Scene 和 SceneDraft
      const rawText = chapter.rawContent || '';
      const paragraphs = rawText.split(/\n\n+/).filter((p: string) => p.trim().length > 50);
      const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));

      for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
        const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
        const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
        const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
        const sceneText = sceneParagraphs.join('\n\n');

        // 提取场景摘要（前100字）
        const summary = sceneText.substring(0, 100).trim() || `场景 ${scIdx + 1}`;
        const title = `${chapter.title} - 场景 ${scIdx + 1}`;

        // 简单提取地点
        const location = this.extractLocation(sceneText);

        // 创建 SceneDraft（草稿状态）
        const sceneDraft = await (this.prisma.sceneDraft as any).create({
          data: {
            chapterId: chapter.id,
            index: scIdx + 1,
            title: title || '',
            summary: summary || '',
            location,
            status: 'DRAFT',
          },
        });
        this.logger.log(`SceneDraft created: ${sceneDraft.id}`);

        // 创建 Scene（关联到 SceneDraft）
        // 使用 ProjectService 创建 Scene，确保组织隔离
        const scene = await this.projectService.createScene(episode.id, {
          index: scIdx + 1,
          title,
          summary,
          location,
        });

        // 更新 Scene 关联到 SceneDraft
        await this.prisma.scene.update({
          where: { id: scene.id },
          data: { sceneDraftId: sceneDraft.id },
        });
        this.logger.log(`Scene ${scIdx + 1} created: ${scene.id}`);
      }
    }

    try {
      // 清理缓存
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);

      // 返回完整的 Project Tree
      return this.projectService.findTreeById(projectId, organizationId);
    } catch (error: any) {
      // 统一错误处理：将未知错误转换为明确的业务异常
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('项目结构分析失败，请稍后重试');
    }
  }

  /**
   * 简单提取地点（占位实现）
   */
  private extractLocation(text: string): string | undefined {
    const locationPatterns = [/在([^，。！？\n]+)/, /到([^，。！？\n]+)/, /来到([^，。！？\n]+)/];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length < 20) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 将解析后的结构写入数据库
   * 用于 Worker 处理完分析后写入结构
   *
   * @param structure 解析后的项目结构
   */
  async applyAnalyzedStructureToDatabase(structure: AnalyzedProjectStructure): Promise<void> {
    const { projectId, episodes } = structure;

    if (!Array.isArray(episodes) || episodes.length === 0) {
      throw new BadRequestException(
        'STRUCTURE_EPISODES_REQUIRED: analyzed structure must provide flat episodes'
      );
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const episodeData of episodes) {
        const episode = await tx.episode.upsert({
          where: {
            projectId_index: {
              projectId,
              index: episodeData.index,
            },
          },
          create: {
            projectId,
            seasonId: null as any,
            index: episodeData.index,
            name: episodeData.title,
            summary: this.asNonEmptyString(episodeData.summary),
          },
          update: {
            name: episodeData.title,
            summary: this.asNonEmptyString(episodeData.summary),
          },
        });

        for (const sceneData of episodeData.scenes) {
          const scene = await tx.scene.upsert({
            where: {
              episodeId_sceneIndex: {
                episodeId: episode.id,
                sceneIndex: sceneData.index,
              },
            },
            create: {
              episodeId: episode.id,
              projectId,
              sceneIndex: sceneData.index,
              title: sceneData.title,
              summary: this.asNonEmptyString(sceneData.summary),
            },
            update: {
              title: sceneData.title,
              summary: this.asNonEmptyString(sceneData.summary),
            },
          });

          if (sceneData.shots && sceneData.shots.length > 0) {
            for (const shotData of sceneData.shots) {
              const novelQuote =
                this.asNonEmptyString(shotData.novelQuote) ??
                this.asNonEmptyString(shotData.text) ??
                this.asNonEmptyString(shotData.summary) ??
                this.asNonEmptyString(shotData.title);

              if (!novelQuote) {
                throw new Error(
                  `NOVEL_TO_SHOT_SCHEMA_INVALID: shot ${sceneData.index}.${shotData.index} missing novelQuote/source text`
                );
              }

              const params = this.buildShotParams(shotData);
              const description =
                this.asNonEmptyString(shotData.summary) ??
                this.asNonEmptyString(shotData.text)?.slice(0, 200) ??
                null;
              const actionDescription =
                this.asNonEmptyString(shotData.action) ??
                this.asNonEmptyString(shotData.summary) ??
                this.asNonEmptyString(shotData.text)?.slice(0, 200) ??
                null;

              await tx.shot.upsert({
                where: {
                  sceneId_index: {
                    sceneId: scene.id,
                    index: shotData.index,
                  },
                },
                create: {
                  sceneId: scene.id,
                  index: shotData.index,
                  title: this.asNullableString(shotData.title),
                  description,
                  type: 'novel_analysis',
                  params,
                  qualityScore: {} as Prisma.InputJsonValue,
                  shotType:
                    this.asNullableString(shotData.shotType) ??
                    this.extractCameraControl(shotData, ['shot_type', 'shotType', 'type']),
                  cameraMovement: this.extractCameraControl(shotData, [
                    'camera_movement',
                    'cameraMovement',
                    'movement',
                  ]),
                  cameraAngle: this.extractCameraControl(shotData, [
                    'camera_angle',
                    'cameraAngle',
                    'angle',
                  ]),
                  actionDescription,
                  emotion: this.asNullableString(shotData.emotion),
                  durationSec: shotData.durationSec ?? null,
                  novelQuote,
                },
                update: {
                  title: this.asNullableString(shotData.title),
                  description,
                  params,
                  shotType:
                    this.asNullableString(shotData.shotType) ??
                    this.extractCameraControl(shotData, ['shot_type', 'shotType', 'type']),
                  cameraMovement: this.extractCameraControl(shotData, [
                    'camera_movement',
                    'cameraMovement',
                    'movement',
                  ]),
                  cameraAngle: this.extractCameraControl(shotData, [
                    'camera_angle',
                    'cameraAngle',
                    'angle',
                  ]),
                  actionDescription,
                  emotion: this.asNullableString(shotData.emotion),
                  durationSec: shotData.durationSec ?? null,
                  novelQuote,
                },
              });
            }
          }
        }
      }
    });

    // 清理缓存
    await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
  }

  /**
   * Event Listener: CE06 Novel Parsing Succeeded
   */
  @OnEvent('job.ce06_succeeded', { async: true })
  async handleCE06Completed(payload: { projectId: string; result: any }) {
    const { projectId, result } = payload;
    const episodes = Array.isArray(result?.data?.episodes) ? result.data.episodes : [];

    if (episodes.length === 0) {
      this.logger.warn(
        `[Event] CE06 succeeded but no flat episodes found for project ${projectId}; legacy seasonal payload is no longer applied`
      );
      return;
    }

    this.logger.log(
      `[Event] Applying CE06 structure to DB for project ${projectId} (Found ${episodes.length} episodes)`
    );
    try {
      await this.applyAnalyzedStructureToDatabase({
        projectId,
        episodes: episodes as any,
        stats: {
          seasonsCount: 0,
          episodesCount: episodes.length,
          scenesCount: 0,
          shotsCount: 0,
        },
      } as any);
      this.logger.log(`[Event] Successfully applied CE06 structure for project ${projectId}`);
    } catch (error: any) {
      this.logger.error(`[Event] Failed to apply CE06 structure: ${error.message}`);
    }
  }
}
