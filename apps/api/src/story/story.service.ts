import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParseStoryDto } from './dto/parse-story.dto';
import { JobType as JobTypeEnum, TaskType as TaskTypeEnum } from 'database';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActions } from '../audit/audit.constants';
import { randomUUID } from 'crypto';
import { NovelImportService } from '../novel-import/novel-import.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const SHREDDER_THRESHOLD = 500000; // 50w 字符分流阈值

/**
 * Story Service
 * CE06: Novel Parsing 服务层
 *
 * 规则：
 * - 只负责参数校验 + 创建 Job
 * - 复用现有 JobService.createCECoreJob
 * - 不写业务逻辑，不复制解析算法
 */
@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly novelImportService: NovelImportService
  ) {}

  /**
   * 解析小说（CE06）
   *
   * @param dto 输入参数
   * @param userId 用户 ID
   * @param organizationId 组织 ID
   * @param ip IP 地址
   * @param userAgent UserAgent
   * @returns jobId, traceId, status
   */
  async parseStory(
    dto: ParseStoryDto,
    userId?: string,
    organizationId?: string,
    ip?: string,
    userAgent?: string,
    targetTraceId?: string,
    isVerification?: boolean
  ) {
    // 1. 参数校验（DTO 已通过 class-validator）
    // eslint-disable-next-line no-console
    console.log('[StoryService DEBUG] parseStory dto:', JSON.stringify(dto).slice(0, 100));
    const projectId = dto.projectId;
    this.logger.log(`Parsing story for project ${projectId}, isVerification=${isVerification}`);
    if (!dto.rawText || dto.rawText.trim().length === 0) {
      throw new BadRequestException('rawText is required and cannot be empty');
    }

    // 2. 如果提供了 projectId，验证项目存在
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new BadRequestException(`Project ${projectId} not found`);
      }
      if (organizationId && project.organizationId !== organizationId) {
        throw new BadRequestException(
          `Project ${projectId} does not belong to organization ${organizationId}`
        );
      }
    } else {
      // 如果没有提供 projectId，创建一个临时项目（可选，根据业务需求）
      // 这里暂时要求必须提供 projectId
      throw new BadRequestException('projectId is required');
    }

    // 3. 生成 traceId（Pipeline 级）
    const traceId = targetTraceId || `ce_pipeline_${randomUUID()}`;

    // [Stage 4] Shredder 分流逻辑
    if (dto.rawText.length > SHREDDER_THRESHOLD) {
      this.logger.log(
        `[Stage 4] Text length ${dto.rawText.length} exceeds threshold ${SHREDDER_THRESHOLD}, bypassing monolithic parsing.`
      );

      // 1. 确保 Novel 记录存在
      let novel = await this.prisma.novel.findFirst({ where: { projectId } });
      if (!novel) {
        novel = await this.prisma.novel.create({
          data: {
            projectId,
            title: dto.title || 'Untitled Story',
            author: dto.author || 'Unknown',
            rawFileUrl: '',
            status: 'UPLOADING',
          },
        });
      }

      // 2. 将内容写入磁盘作为流式源 (Shredder 模式必备)
      const uploadDir = path.join(process.cwd(), 'uploads/novels');
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, `shredder_${projectId}_${Date.now()}.txt`);
      await fs.writeFile(filePath, dto.rawText);

      // 3. 触发 Shredder 工作流
      const result = await this.novelImportService.triggerShredderWorkflow(
        novel.id,
        projectId,
        organizationId as string,
        userId || 'system',
        filePath,
        dto.title || 'Untitled Story',
        traceId,
        isVerification
      );

      // 4. 记录审计日志
      await this.auditLogService.record({
        userId,
        action: AuditActions.JOB_CREATED,
        resourceType: 'job',
        resourceId: result.jobId,
        ip,
        userAgent,
        details: {
          jobType: 'NOVEL_SCAN_TOC',
          mode: 'SHREDDER',
          taskId: result.taskId,
          traceId,
          projectId,
        },
      });

      return {
        jobId: result.jobId,
        traceId,
        status: 'PENDING',
        taskId: result.taskId,
      };
    }

    // 3.5 确保 Novel (NovelSource) 记录存在
    const novel = await this.prisma.novel.findFirst({ where: { projectId } });
    if (!novel) {
      await this.prisma.novel.create({
        data: {
          projectId,
          title: dto.title || 'Untitled Story',
          author: dto.author || 'Unknown',
          rawFileUrl: '', // Explicitly provide empty string to satisfy required/missing arg check
        },
      });
    } else {
      await this.prisma.novel.update({
        where: { id: novel.id },
        data: {
          title: dto.title,
          author: dto.author,
        },
      });
    }

    // 4. 创建 CE_CORE_PIPELINE Task
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    const task = await this.prisma.task.create({
      data: {
        projectId,
        organizationId,
        type: TaskTypeEnum.PIPELINE_E2E_VIDEO,
        status: 'PENDING',
        traceId, // Task 的 traceId 字段
        payload: {
          pipeline: [
            // [A5_FIX] CE06 is an Import Stub and forbidden as production dependency per LAUNCH_STANDARD_V1.1
            // 'CE06_NOVEL_PARSING', 
            'CE03_VISUAL_DENSITY',
            'CE04_VISUAL_ENRICHMENT',
            'VIDEO_EXPORT',
            'CE09_MEDIA_SECURITY',
          ],
          input: {
            rawText: dto.rawText,
            title: dto.title,
            author: dto.author,
          },
        },
      },
    });

    // 5. [A5_FIX] Skip CE06 Job creation for production pipeline.
    // Parsing/Shredding should be handled by truth-ready services or synchronous logic.
    /*
    const job = await this.jobService.createCECoreJob({
      projectId,
      organizationId,
      taskId: task.id,
      jobType: JobTypeEnum.CE06_NOVEL_PARSING,
      payload: {
        projectId,
        engineKey: 'ce06_novel_parsing',
        sourceText: dto.rawText,
        title: dto.title,
        author: dto.author,
        traceId,
      },
    });
    */

    // [A5_FIX] Trigger next step (CE03) directly or via Task flow adjustment
    this.logger.log(`Task ${task.id} created without CE06 dependency (Stub check).`);

    // 6. 记录审计日志
    await this.auditLogService.record({
      userId,
      action: AuditActions.JOB_CREATED,
      resourceType: 'task', // Changed from job to task
      resourceId: task.id,
      ip,
      userAgent,
      details: {
        jobType: 'CE03_VISUAL_DENSITY', // New head of pipeline
        taskId: task.id,
        traceId,
        projectId,
      },
    });

    this.logger.log(`Task created: ${task.id}, traceId: ${traceId} (CE06 Bypassed)`);

    // 7. 返回结果
    return {
      jobId: task.id, // Keep field name for compatibility prefixing taskId
      traceId,
      status: task.status,
      taskId: task.id,
    };
  }
}
