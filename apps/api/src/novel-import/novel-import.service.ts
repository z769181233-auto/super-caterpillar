import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';
import { randomUUID } from 'crypto';

/**
 * 小说分析结果结构（为未来接入 LLM 预留）
 */
interface OutlineResult {
  seasons: Array<{
    name: string;
    episodes: Array<{
      name: string;
      scenes: Array<{
        summary: string;
        shots: Array<{
          title: string;
          description: string;
          type: string;
        }>;
      }>;
    }>;
  }>;
}

@Injectable()
export class NovelImportService {
  private readonly logger = new Logger(NovelImportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly analysisProcessor: NovelAnalysisProcessorService
  ) { }

  /**
   * 分析单个章节
   */
  async analyzeChapter(chapterId: string): Promise<void> {
    await this.analysisProcessor.analyzeChapter(chapterId);
  }

  /**
   * 分析小说并生成结构
   * 1. 保存章节原文到 NovelChapter
   * 2. 为每章生成初始 SceneDraft（纯规则版）
   * 3. 创建 Season/Episode/Scene 结构
   */
  async analyzeNovelAndGenerateStructure(
    novelSourceId: string,
    projectId: string,
    userId: string,
    organizationId: string,
    chapters?: Array<{ title: string; content: string }>,
    savedChapters?: Array<{ id: string; index: number; title: string; rawText: string }>
  ): Promise<void> {
    // 获取小说源
    const novelSource = await this.prisma.novel.findUnique({
      where: { id: novelSourceId },
    });

    if (!novelSource) {
      throw new NotFoundException('当前项目没有可用的小说源，请先导入小说文件');
    }

    // 如果没有提供 savedChapters，从数据库读取
    let chaptersToProcess = savedChapters;
    if (!chaptersToProcess) {
      const dbChapters = await this.prisma.novelChapter.findMany({
        where: { novelSourceId },
        orderBy: { index: 'asc' },
        include: { scenes: true },
      });

      chaptersToProcess = dbChapters.map((c) => ({
        id: c.id,
        index: c.index,
        title: c.title || `Chapter ${c.index}`,
        rawText: c.rawContent || '',
      }));
    }

    if (!chaptersToProcess || chaptersToProcess.length === 0) {
      throw new BadRequestException('小说章节为空或解析失败，请检查文件内容');
    }

    // 遍历章节（1 章 = 1 Episode，直接关联 Project，移除 Season 层）
    for (let chIdx = 0; chIdx < chaptersToProcess.length; chIdx++) {
      const chapter = chaptersToProcess[chIdx];
      this.logger.log(`Creating episode ${chIdx + 1} (Chapter: ${chapter.title})...`);

      // 创建 Episode（关联到 NovelChapter，直接关联 Project）
      const episode = await this.projectService.createEpisode(projectId, {
        index: chIdx + 1,
        name: chapter.title,
      });
      this.logger.log(`Episode ${chIdx + 1} created: ${episode.id}`);

      // 更新 Episode 关联到 NovelChapter
      await this.prisma.episode.update({
        where: { id: episode.id },
        data: { chapterId: chapter.id },
      });

      // 为每章生成初始 SceneDraft（纯规则版，先不接 LLM）
      // 每章先生成 1 个 SceneDraft
      const sceneDraft = await this.prisma.sceneDraft.create({
        data: {
          chapterId: chapter.id,
          index: 1,
          title: `${chapter.title} - 场景 1`,
          summary: chapter.rawText.substring(0, 100) || '场景摘要', // 前100字作为摘要
          status: 'DRAFT',
        },
      });
      this.logger.log(`SceneDraft created: ${sceneDraft.id}`);

      // 创建 Scene（关联到 SceneDraft）
      const scene = await this.projectService.createScene(episode.id, {
        index: 1,
        summary: sceneDraft.summary || undefined,
        title: sceneDraft.title || undefined,
      });
      this.logger.log(`Scene created: ${scene.id}`);

      // 更新 Scene 关联到 SceneDraft
      await this.prisma.scene.update({
        where: { id: scene.id },
        data: { sceneDraftId: sceneDraft.id },
      });

      // 按段落切分生成 Shots（Stage-1 规则）
      const paragraphs = chapter.rawText.split(/\n\n+/).filter((p) => p.trim().length > 10);
      this.logger.log(`Segmenting chapter into ${paragraphs.length} paragraphs/shots...`);

      const shotsData = [];
      // MVP: 限制每章最多 10 个镜头，防止过长
      const maxShots = Math.min(paragraphs.length, 10);

      for (let shIdx = 0; shIdx < maxShots; shIdx++) {
        const paragraph = paragraphs[shIdx].trim();
        const shotParams = {
          prompt: paragraph.substring(0, 800), // 控制提示词长度
          aspect_ratio: '16:9',
          seed: Math.floor(Math.random() * 1000000),
          engine_params: {
            steps: 20,
            guidance_scale: 7.0,
            scheduler: 'DPMSolverMultistepScheduler',
          },
        };

        const shot = await this.projectService.createShot(
          scene.id,
          {
            index: shIdx + 1,
            type: this.inferShotType(paragraph),
            params: shotParams,
            title: `Shot ${shIdx + 1}`,
            description: paragraph.substring(0, 200),
          } as any,
          organizationId
        );

        shotsData.push({
          shotId: shot.id,
          index: shIdx + 1,
          ...shotParams,
        });
      }

      // 记录段落切分证据 (Snapshot)
      this.logger.log(
        `[Stage-1 Evidence] Generated structure for Episode ${episode.id} with ${shotsData.length} shots.`
      );
    }
  }

  /**
   * 使用章节信息生成大纲（占位实现）
   * 1 章 = 1 Episode
   */
  private async callLLMForOutlineWithChapters(
    chapters: Array<{ title: string; content: string }>,
    title?: string
  ): Promise<OutlineResult> {
    const episodes = [];

    for (let epIdx = 0; epIdx < chapters.length; epIdx++) {
      const chapter = chapters[epIdx];
      const scenes = [];

      // 每个章节按段落切分为场景（简单实现，未来用 LLM）
      const paragraphs = chapter.content.split(/\n\n+/).filter((p) => p.trim().length > 50);
      const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));

      for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
        const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
        const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
        const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
        const sceneText = sceneParagraphs.join('\n\n');

        // 每个场景生成 3-5 个 Shot（根据内容长度）
        const shots = [];
        const shotCount = Math.min(5, Math.max(3, Math.ceil(sceneText.length / 500)));

        for (let shIdx = 0; shIdx < shotCount; shIdx++) {
          const shotStart = Math.floor((sceneText.length / shotCount) * shIdx);
          const shotEnd = Math.floor((sceneText.length / shotCount) * (shIdx + 1));
          const shotText = sceneText.substring(shotStart, shotEnd);

          shots.push({
            title: `${chapter.title} - 场景 ${scIdx + 1} - 镜头 ${shIdx + 1}`,
            description: shotText.substring(0, 200) || `场景 ${scIdx + 1} 的镜头 ${shIdx + 1}`,
            type: this.inferShotType(shotText),
          });
        }

        scenes.push({
          summary: sceneParagraphs[0]?.substring(0, 100) || `场景 ${scIdx + 1}`,
          shots,
        });
      }

      episodes.push({
        name: chapter.title,
        scenes,
      });
    }

    return {
      seasons: [
        {
          name: title || '第一季',
          episodes,
        },
      ],
    };
  }

  /**
   * 调用 LLM 生成大纲（占位实现）
   * 未来替换为真实的大模型 API 调用
   */
  private async callLLMForOutline(rawText: string, title?: string): Promise<OutlineResult> {
    // 占位实现：按 \n\n 分段
    const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 0);

    // 取前 3 段作为 Episode，每段生成 3 个 Scene，每个 Scene 5 个 Shot
    const episodes = [];
    const maxEpisodes = Math.min(3, paragraphs.length);

    for (let epIdx = 0; epIdx < maxEpisodes; epIdx++) {
      const paragraph = paragraphs[epIdx] || '';
      const scenes = [];

      // 每个 Episode 生成 3 个 Scene
      for (let scIdx = 0; scIdx < 3; scIdx++) {
        const sceneText = paragraph.substring(
          Math.floor((paragraph.length / 3) * scIdx),
          Math.floor((paragraph.length / 3) * (scIdx + 1))
        );

        const shots = [];
        // 每个 Scene 生成 5 个 Shot
        for (let shIdx = 0; shIdx < 5; shIdx++) {
          const shotText = sceneText.substring(
            Math.floor((sceneText.length / 5) * shIdx),
            Math.floor((sceneText.length / 5) * (shIdx + 1))
          );

          shots.push({
            title: `第 ${epIdx + 1} 集 - 场景 ${scIdx + 1} - 镜头 ${shIdx + 1}`,
            description: shotText.substring(0, 100) || `场景 ${scIdx + 1} 的镜头 ${shIdx + 1}`,
            type: 'close-up',
          });
        }

        scenes.push({
          summary: `Scene ${scIdx + 1}`,
          shots,
        });
      }

      episodes.push({
        name: `第 ${epIdx + 1} 集`,
        scenes,
      });
    }

    return {
      seasons: [
        {
          name: title || '第一季',
          episodes,
        },
      ],
    };
  }

  /**
   * 触发 Shredder (Stage 4) 流程：流式扫描与分片解析
   * 适用于 100万字以上的长篇小说
   */
  async triggerShredderWorkflow(
    novelSourceId: string,
    projectId: string,
    organizationId: string,
    userId: string,
    filePath: string,
    title: string,
    traceId?: string,
    isVerification?: boolean
  ): Promise<any> {
    this.logger.log(`[Stage 4] Triggering Shredder workflow for Novel: ${novelSourceId} (${projectId})`);

    // 1. 创建 Task (类型为 NOVEL_ANALYSIS，符合现有架构)
    const task = await this.prisma.task.create({
      data: {
        organizationId,
        projectId,
        type: 'NOVEL_ANALYSIS' as any,
        status: 'PENDING',
        traceId: traceId || `tr_shredder_${randomUUID()}`,
        payload: {
          novelSourceId,
          projectId,
          mode: 'SHREDDER', // 标记为分片模式
          isVerification: !!isVerification,
        },
      },
    });

    // 2. 创建 NOVEL_SCAN_TOC Job
    // 使用 createCECoreJob 确保符合 Job 系统规范（带占位层级）
    const job = await this.prisma.shotJob.create({
      data: {
        organizationId,
        projectId,
        // 下面这几个 ID 在 createCECoreJob 中是自动创建占位的，
        // 这里为了简单，我们直接手动模拟 Job 系统的“带占位”创建
        // 后续 Scan 任务会创建真实的 Season/Episode
        taskId: task.id,
        type: 'NOVEL_SCAN_TOC' as any,
        status: 'PENDING',
        priority: 10, // 高优先级，因为是根任务
        maxRetry: 3,
        payload: {
          novelSourceId,
          projectId,
          organizationId,
          userId,
          fileKey: filePath,
          title,
          isVerification: !!isVerification,
        },
        traceId: task.traceId,
      },
    });

    this.logger.log(`[Stage 4] Shredder root job (NOVEL_SCAN_TOC) created: ${job.id}`);

    return {
      jobId: job.id,
      taskId: task.id,
    };
  }

  /**
   * 根据文本内容推断镜头类型（简单实现）
   */
  private inferShotType(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('特写') || lowerText.includes('close') || lowerText.includes('face')) {
      return 'close_up';
    }
    if (
      lowerText.includes('全景') ||
      lowerText.includes('wide') ||
      lowerText.includes('landscape')
    ) {
      return 'wide_shot';
    }
    return 'medium_shot';
  }
}
