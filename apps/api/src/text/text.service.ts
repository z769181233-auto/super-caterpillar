import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextSafetyService } from './text-safety.service';
import { QualityMetricsWriter } from '../quality/quality-metrics.writer';
import { VisualDensityDto } from './dto/visual-density.dto';
import { VisualEnrichDto } from './dto/visual-enrich.dto';
import { JobType as JobTypeEnum, TaskType as TaskTypeEnum, JobStatus as JobStatusEnum } from 'database';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActions } from '../audit/audit.constants';
import { randomUUID } from 'crypto';

/**
 * Text Service
 * CE03/CE04 服务层
 * 
 * 规则：
 * - 只负责参数校验 + 创建 Job
 * - CE04 前置 Safety Hook（TextSafetyService.sanitize）
 * - 复用现有 JobService.createCECoreJob
 * - 不写业务逻辑，不复制解析算法
 */
@Injectable()
export class TextService {
  private readonly logger = new Logger(TextService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService,
    private readonly textSafetyService: TextSafetyService,
    private readonly auditLogService: AuditLogService,
    private readonly qualityMetricsWriter: QualityMetricsWriter,
  ) {}

  /**
   * 视觉密度分析（CE03）
   * 
   * @param dto 输入参数
   * @param userId 用户 ID
   * @param organizationId 组织 ID
   * @param ip IP 地址
   * @param userAgent UserAgent
   * @returns jobId, traceId, status
   */
  async visualDensity(
    dto: VisualDensityDto,
    userId?: string,
    organizationId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    // 1. 参数校验（DTO 已通过 class-validator）
    if (!dto.text || dto.text.trim().length === 0) {
      throw new BadRequestException('text is required and cannot be empty');
    }

    // 2. 验证项目存在
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new BadRequestException(`Project ${dto.projectId} not found`);
    }
    if (organizationId && project.organizationId !== organizationId) {
      throw new BadRequestException(`Project ${dto.projectId} does not belong to organization ${organizationId}`);
    }

    // 3. 生成 traceId（Pipeline 级）
    const traceId = `ce_pipeline_${randomUUID()}`;

    // 4. 创建 CE_CORE_PIPELINE Task
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        organizationId,
        type: TaskTypeEnum.CE_CORE_PIPELINE,
        status: 'PENDING',
        traceId, // Task 的 traceId 字段
        payload: {
          pipeline: ['CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT'],
          input: {
            text: dto.text,
            sceneId: dto.sceneId,
            shotId: dto.shotId,
          },
        },
      },
    });

    // 5. 创建 CE03 Job（复用现有逻辑）
    const job = await this.jobService.createCECoreJob({
      projectId: dto.projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE03_VISUAL_DENSITY,
      payload: {
        projectId: dto.projectId,
        engineKey: 'ce03_visual_density',
        text: dto.text,
        sceneId: dto.sceneId,
        shotId: dto.shotId,
        traceId,
      },
    });

    // 6. 记录审计日志
    await this.auditLogService.record({
      userId,
      action: AuditActions.JOB_CREATED,
      resourceType: 'job',
      resourceId: job.id,
      ip,
      userAgent,
      details: {
        jobType: 'CE03_VISUAL_DENSITY',
        taskId: task.id,
        traceId,
        projectId: dto.projectId,
      },
    });

    this.logger.log(`CE03 Job created: ${job.id}, traceId: ${traceId}`);

    // 7. 返回结果
    return {
      jobId: job.id,
      traceId,
      status: job.status,
      taskId: task.id,
    };
  }

  /**
   * 视觉增强（CE04）
   * 
   * @param dto 输入参数
   * @param userId 用户 ID
   * @param organizationId 组织 ID
   * @param ip IP 地址
   * @param userAgent UserAgent
   * @returns jobId, traceId, status
   */
  async visualEnrich(
    dto: VisualEnrichDto,
    userId?: string,
    organizationId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    // 1. 参数校验（DTO 已通过 class-validator）
    if (!dto.text || dto.text.trim().length === 0) {
      throw new BadRequestException('text is required and cannot be empty');
    }

    // 2. 验证项目存在
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new BadRequestException(`Project ${dto.projectId} not found`);
    }
    if (organizationId && project.organizationId !== organizationId) {
      throw new BadRequestException(`Project ${dto.projectId} does not belong to organization ${organizationId}`);
    }

    // 3. CE04 前置 Safety Hook（最小实现）
    const safetyResult = await this.textSafetyService.sanitize(dto.text, userId, ip, userAgent);

    // 4. 如果安全检测不通过，直接创建 FAILED Job 并记录审计
    if (!safetyResult.passed) {
      if (!organizationId) {
        throw new BadRequestException('organizationId is required');
      }
      const traceId = `ce_pipeline_${randomUUID()}`;
      const task = await this.prisma.task.create({
        data: {
          projectId: dto.projectId,
          organizationId,
          type: TaskTypeEnum.CE_CORE_PIPELINE,
          status: 'FAILED',
          traceId, // Task 的 traceId 字段
          payload: {
            pipeline: ['CE04_VISUAL_ENRICHMENT'],
            input: {
              text: dto.text,
              sceneId: dto.sceneId,
              shotId: dto.shotId,
            },
            safetyCheck: {
              passed: false,
              flags: safetyResult.flags,
              sanitizedText: safetyResult.sanitizedText,
            },
          },
        },
      });

      // 创建 FAILED Job（使用 createCECoreJob 创建占位结构，然后标记为 FAILED）
      const job = await this.jobService.createCECoreJob({
        projectId: dto.projectId,
        organizationId,
        taskId: task.id,
        jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
        payload: {
          projectId: dto.projectId,
          engineKey: 'ce04_visual_enrichment',
          text: dto.text,
          sceneId: dto.sceneId,
          shotId: dto.shotId,
          traceId,
          safetyCheck: {
            passed: false,
            flags: safetyResult.flags,
            sanitizedText: safetyResult.sanitizedText,
          },
        },
      });

      // 立即标记为 FAILED
      await this.prisma.shotJob.update({
        where: { id: job.id },
        data: {
          status: JobStatusEnum.FAILED,
          lastError: `Safety check failed: ${safetyResult.flags.join(', ')}`,
        },
      });

      // 记录审计日志（包含清洗前后文本）
      await this.auditLogService.record({
        userId,
        action: AuditActions.JOB_CREATED,
        resourceType: 'job',
        resourceId: job.id,
        ip,
        userAgent,
        details: {
          jobType: 'CE04_VISUAL_ENRICHMENT',
          taskId: task.id,
          traceId,
          projectId: dto.projectId,
          status: 'FAILED',
          reason: 'SAFETY_CHECK_FAILED',
          safetyCheck: {
            passed: false,
            flags: safetyResult.flags,
            originalText: dto.text,
            sanitizedText: safetyResult.sanitizedText,
          },
        },
      });

      this.logger.warn(`CE04 Job rejected due to safety check: ${job.id}, flags: ${safetyResult.flags.join(', ')}`);

      return {
        jobId: job.id,
        traceId,
        status: 'FAILED',
        taskId: task.id,
        reason: 'SAFETY_CHECK_FAILED',
        safetyFlags: safetyResult.flags,
      };
    }

    // 5. 安全检测通过，继续创建 Job
    const traceId = `ce_pipeline_${randomUUID()}`;

    // 6. 创建 CE_CORE_PIPELINE Task
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        organizationId,
        type: TaskTypeEnum.CE_CORE_PIPELINE,
        status: 'PENDING',
        traceId, // Task 的 traceId 字段
        payload: {
          pipeline: ['CE04_VISUAL_ENRICHMENT'],
          input: {
            text: safetyResult.sanitizedText, // 使用清洗后的文本
            sceneId: dto.sceneId,
            shotId: dto.shotId,
            previousJobId: dto.previousJobId,
          },
          safetyCheck: {
            passed: true,
            flags: safetyResult.flags,
            sanitizedText: safetyResult.sanitizedText,
          },
        },
      },
    });

    // 7. 创建 CE04 Job（复用现有逻辑）
    const job = await this.jobService.createCECoreJob({
      projectId: dto.projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE04_VISUAL_ENRICHMENT,
      payload: {
        projectId: dto.projectId,
        engineKey: 'ce04_visual_enrichment',
        text: safetyResult.sanitizedText, // 使用清洗后的文本
        sceneId: dto.sceneId,
        shotId: dto.shotId,
        previousJobId: dto.previousJobId,
        traceId,
        safetyCheck: {
          passed: true,
          flags: safetyResult.flags,
        },
      },
    });

    // 8. 记录审计日志（包含清洗前后文本）
    await this.auditLogService.record({
      userId,
      action: AuditActions.JOB_CREATED,
      resourceType: 'job',
      resourceId: job.id,
      ip,
      userAgent,
      details: {
        jobType: 'CE04_VISUAL_ENRICHMENT',
        taskId: task.id,
        traceId,
        projectId: dto.projectId,
        safetyCheck: {
          passed: true,
          flags: safetyResult.flags,
          originalText: dto.text,
          sanitizedText: safetyResult.sanitizedText,
        },
      },
    });

    this.logger.log(`CE04 Job created: ${job.id}, traceId: ${traceId}`);

    // 9. 返回结果
    return {
      jobId: job.id,
      traceId,
      status: job.status,
      taskId: task.id,
    };
  }
}

