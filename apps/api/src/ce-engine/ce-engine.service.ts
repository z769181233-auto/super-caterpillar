import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JobService } from '../job/job.service';
import { TaskService } from '../task/task.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobType as JobTypeEnum, TaskType as TaskTypeEnum } from 'database';
import { randomUUID } from 'crypto';

/**
 * CEEngineService
 * CE 核心引擎服务层包装
 *
 * 规则：
 * - 只负责参数校验 + 创建 Job
 * - 实际执行仍然走现有 JobService / Worker
 * - 不复制业务逻辑
 */
@Injectable()
export class CEEngineService {
  private readonly logger = new Logger(CEEngineService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly taskService: TaskService,
    private readonly textSafetyService: TextSafetyService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * CE06: 解析小说
   * POST /story/parse
   */
  async parseStory(
    dto: {
      projectId: string;
      rawText: string;
      options?: {
        engineKey?: string;
        engineVersion?: string;
      };
    },
    userId: string,
    organizationId: string,
    apiKeyId?: string
  ): Promise<{
    jobId: string;
    traceId: string;
    status: string;
  }> {
    // 1. 验证项目存在
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // 2. 创建 CE_CORE_PIPELINE Task（只包含 CE06）
    const traceId = `ce_pipeline_${randomUUID()}`;
    const task = await this.taskService.create({
      organizationId,
      projectId: dto.projectId,
      type: TaskTypeEnum.CE_CORE_PIPELINE,
      payload: {
        // Strict Sequence: CE06 -> CE03 -> CE04 -> TIMELINE_RENDER -> CE09
        pipeline: [
          'CE06_NOVEL_PARSING',
          'CE03_VISUAL_DENSITY',
          'CE04_VISUAL_ENRICHMENT',
          'TIMELINE_RENDER',
          'CE09_MEDIA_SECURITY',
        ],
        traceId,
      },
      traceId,
    });

    // 3. 创建 CE06 Job
    const job = await this.jobService.createCECoreJob({
      projectId: dto.projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE06_NOVEL_PARSING,
      payload: {
        projectId: dto.projectId,
        rawText: dto.rawText,
        engineKey: dto.options?.engineKey || 'ce06_novel_parsing',
        engineVersion: dto.options?.engineVersion,
        apiKeyId,
      },
    });

    this.logger.log(
      `CE06 Job created: ${job.id} for project ${dto.projectId} (apiKeyId: ${apiKeyId || 'none'})`
    );

    return {
      jobId: job.id,
      traceId,
      status: job.status,
    };
  }

  /**
   * CE03: 视觉密度分析
   * POST /text/visual-density
   */
  async analyzeVisualDensity(
    dto: {
      projectId: string;
      text: string;
      options?: {
        engineKey?: string;
        engineVersion?: string;
      };
    },
    userId: string,
    organizationId: string,
    apiKeyId?: string
  ): Promise<{
    jobId: string;
    traceId: string;
    status: string;
  }> {
    // 1. 验证项目存在
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // 2. 创建 CE_CORE_PIPELINE Task（只包含 CE03）
    const traceId = `ce_pipeline_${randomUUID()}`;
    const task = await this.taskService.create({
      organizationId,
      projectId: dto.projectId,
      type: TaskTypeEnum.CE_CORE_PIPELINE,
      payload: {
        pipeline: ['CE03_VISUAL_DENSITY'],
        traceId,
      },
      traceId,
    });

    // 3. 创建 CE03 Job
    const job = await this.jobService.createCECoreJob({
      projectId: dto.projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE03_VISUAL_DENSITY,
      payload: {
        projectId: dto.projectId,
        text: dto.text,
        engineKey: dto.options?.engineKey || 'ce03_visual_density',
        engineVersion: dto.options?.engineVersion,
        apiKeyId,
      },
    });

    this.logger.log(
      `CE03 Job created: ${job.id} for project ${dto.projectId} (apiKeyId: ${apiKeyId || 'none'})`
    );

    return {
      jobId: job.id,
      traceId,
      status: job.status,
    };
  }

  /**
   * CE04: 文本增强
   * POST /text/enrich
   *
   * 前置 Safety Hook：在创建 Job 前进行安全清洗
   */
  async enrichText(
    dto: {
      projectId: string;
      text: string;
      options?: {
        engineKey?: string;
        engineVersion?: string;
      };
    },
    userId: string,
    organizationId: string,
    apiKeyId?: string,
    ip?: string,
    userAgent?: string
  ): Promise<{
    jobId: string;
    traceId: string;
    status: string;
  }> {
    // 1. 验证项目存在
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // 2. CE04 前置 Safety Hook
    const safetyResult = await this.textSafetyService.sanitize(dto.text, {
      projectId: dto.projectId,
      userId,
      apiKeyId,
      ip,
      userAgent,
    });

    if (safetyResult.decision === 'BLOCK') {
      // 安全检查不通过，不创建 Job，直接返回失败
      throw new BadRequestException(`Text safety check failed: ${safetyResult.reasons.join(', ')}`);
    }

    // 3. 创建 CE_CORE_PIPELINE Task（只包含 CE04）
    const traceId = `ce_pipeline_${randomUUID()}`;
    const task = await this.taskService.create({
      organizationId,
      projectId: dto.projectId,
      type: TaskTypeEnum.CE_CORE_PIPELINE,
      payload: {
        pipeline: ['CE04_VISUAL_ENRICHMENT'],
        traceId,
      },
      traceId,
    });

    // 4. 创建 CE04 Job（使用清洗后的文本）
    const job = await this.jobService.createCECoreJob({
      projectId: dto.projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
      payload: {
        projectId: dto.projectId,
        text: safetyResult.sanitizedText, // 使用清洗后的文本
        originalText: dto.text, // 保留原始文本用于审计
        flags: safetyResult.flags,
        engineKey: dto.options?.engineKey || 'ce04_visual_enrichment',
        engineVersion: dto.options?.engineVersion,
      },
    });

    this.logger.log(
      `CE04 Job created: ${job.id} for project ${dto.projectId} (safety check passed)`
    );

    return {
      jobId: job.id,
      traceId,
      status: job.status,
    };
  }
}
