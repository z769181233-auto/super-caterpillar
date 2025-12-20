import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Req,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { NovelImportService } from './novel-import.service';
import { FileParserService } from './file-parser.service';
import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';
import { ImportNovelDto } from './dto/import-novel.dto';
import { ImportNovelFileDto } from './dto/import-novel-file.dto';
import { ProjectService } from '../project/project.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { EngineTaskService } from '../task/engine-task.service';
import { JobService } from '../job/job.service';
import { StructureGenerateService } from '../project/structure-generate.service';
import { SceneGraphService } from '../project/scene-graph.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TaskType as TaskTypeEnum, TaskStatus as TaskStatusEnum, JobType as JobTypeEnum } from 'database';
import { NovelAnalysisStatus } from '@scu/shared-types';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { diskStorage } from 'multer';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ProjectPermissions } from '../permission/permission.constants';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { TextSafetyService } from '../text-safety/text-safety.service';
import { UnprocessableEntityException } from '@nestjs/common';

@Controller('projects/:projectId/novel')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class NovelImportController {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'novels');

  constructor(
    @Inject(NovelImportService) private readonly novelImportService: NovelImportService,
    @Inject(FileParserService) private readonly fileParserService: FileParserService,
    @Inject(NovelAnalysisProcessorService) private readonly analysisProcessor: NovelAnalysisProcessorService,
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TaskService) private readonly taskService: TaskService,
    @Inject(EngineTaskService) private readonly engineTaskService: EngineTaskService,
    @Inject(JobService) private readonly jobService: JobService,
    @Inject(StructureGenerateService) private readonly structureGenerateService: StructureGenerateService,
    @Inject(SceneGraphService) private readonly sceneGraphService: SceneGraphService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(FeatureFlagService) private readonly featureFlagService: FeatureFlagService,
    @Inject(TextSafetyService) private readonly textSafetyService: TextSafetyService,
  ) {
    // 确保上传目录存在
    fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
  }

  /**
   * 安全审查辅助方法
   */
  private async performSafetyCheck(
    rawText: string,
    context: {
      projectId: string;
      userId: string;
      organizationId: string | null;
      traceId: string;
    }
  ): Promise<void> {
    const triStateOn = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_TRI_STATE');
    if (!triStateOn) {
      return;
    }

    const blockOnImport = this.featureFlagService.isEnabled('FEATURE_TEXT_SAFETY_BLOCK_ON_IMPORT');

    // 使用 traceId 作为 resourceId，或者让 TextSafetyService 生成
    const safetyResult = await this.textSafetyService.sanitize(rawText, {
      ...context,
      orgId: context.organizationId || undefined,
      resourceType: 'NOVEL_SOURCE',
      resourceId: context.traceId, // 暂用 traceId，实际落库时可能还没有 NovelSourceId
    });

    if (safetyResult.decision === 'BLOCK' && blockOnImport) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Content blocked by safety check',
        code: 'TEXT_SAFETY_VIOLATION',
        details: {
          decision: safetyResult.decision,
          riskLevel: safetyResult.riskLevel,
          reasons: safetyResult.reasons,
          flags: safetyResult.flags,
          traceId: safetyResult.traceId,
        },
      });
    }
  }

  @Post('import-file')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'novels');
          fs.mkdir(uploadDir, { recursive: true })
            .then(() => cb(null, uploadDir))
            .catch((err) => cb(err, uploadDir));
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
      fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.txt', '.docx', '.epub', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${ext} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`), false);
        }
      },
    })
  )
  @Permissions(ProjectPermissions.PROJECT_WRITE)
  @AuditAction(AuditActions.PROJECT_UPDATE)
  async importNovelFile(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() importNovelFileDto: ImportNovelFileDto,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }

    // 检查项目权限
    await this.projectService.checkOwnership(projectId, user.userId);

    const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
    const filePath = file.path;

    try {
      // 解析文件（传入文件名用于提取作品名）
      const parsed = await this.fileParserService.parseFile(filePath, fileExt, file.originalname);

      // 安全审查 (BLOCK 时必须零写入)
      const traceId = randomUUID();
      await this.performSafetyCheck(parsed.rawText, {
        projectId,
        userId: user.userId,
        organizationId,
        traceId,
      });

      // 使用解析后的数据或用户输入的数据
      // 优先级：用户输入 > 解析结果 > 文件名
      const novelTitle = importNovelFileDto.title || parsed.title || this.fileParserService.extractTitleFromFileName(file.originalname) || path.basename(file.originalname, path.extname(file.originalname));
      const novelAuthor = importNovelFileDto.author || parsed.author;

      // 创建 NovelSource（使用 novelTitle 和 novelAuthor）
      const novelSource = await this.prisma.novelSource.create({
        data: {
          projectId,
          novelTitle,
          novelAuthor,
          rawText: parsed.rawText, // 确保是 UTF-8 编码的干净文本
          filePath,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: fileExt,
          characterCount: parsed.characterCount,
          chapterCount: parsed.chapterCount,
          metadata: parsed.metadata ? JSON.parse(JSON.stringify(parsed.metadata)) : null,
        },
      });

      // 保存章节原文到 NovelChapter
      const savedChapters = [];
      for (let i = 0; i < parsed.chapters.length; i++) {
        const chapter = parsed.chapters[i];
        const savedChapter = await this.prisma.novelChapter.create({
          data: {
            novelSourceId: novelSource.id,
            orderIndex: i + 1,
            title: chapter.title,
            rawText: chapter.content, // 章节原始文本（UTF-8）
            characterCount: chapter.content.length,
          },
        });
        savedChapters.push(savedChapter);
      }

      // 记录审计日志：NOVEL_IMPORT_FILE
      const requestInfo = AuditLogService.extractRequestInfo(request);
      try {
        await this.auditLogService.record({
          userId: user.userId,
          action: 'NOVEL_IMPORT_FILE',
          resourceType: 'project',
          resourceId: projectId,
          ip: requestInfo.ip,
          userAgent: requestInfo.userAgent,
          details: {
            projectId,
            novelSourceId: novelSource.id,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: fileExt,
            mimeType: file.mimetype,
            characterCount: parsed.characterCount,
            chapterCount: parsed.chapterCount,
            novelTitle,
            novelAuthor,
          },
        });
      } catch (auditError) {
        // 审计日志写入失败不影响主流程
        console.error('Failed to record audit log for NOVEL_IMPORT_FILE:', auditError);
      }

      // 创建分析任务（通过 Job 系统异步处理，符合 Stage1 规则）
      const analysisJob = await this.prisma.novelAnalysisJob.create({
        data: {
          projectId,
          novelSourceId: novelSource.id,
          jobType: 'ANALYZE_ALL',
          status: 'PENDING',
        },
      });

      try {
        // 1. 创建 Task
        const task = await this.taskService.create({
          organizationId,
          projectId,
          type: TaskTypeEnum.NOVEL_ANALYSIS,
          status: TaskStatusEnum.PENDING,
          payload: {
            projectId,
            novelSourceId: novelSource.id,
            analysisJobId: analysisJob.id,
          },
        });

        // 2. 创建 NOVEL_ANALYSIS Job（只创建 1 个 Job，符合"只保留最新一条"规则）
        const job = await this.jobService.createNovelAnalysisJob(
          {
            type: 'NOVEL_ANALYSIS' as any,
            payload: {
              projectId,
              novelSourceId: novelSource.id,
              organizationId,
              userId: user.userId,
            },
          },
          user.userId,
          organizationId,
          task.id,
          undefined, // apiKeyId
          request.ip || request.headers['x-forwarded-for'] as string,
          request.headers['user-agent'],
        );

        // 3. 更新 NovelAnalysisJob 状态为 PENDING（等待 Worker 处理）
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: 'PENDING',
            progress: {
              message: 'Job created, waiting for worker',
              jobId: job.id,
              taskId: task.id,
            },
          },
        });

        return {
          success: true,
          data: {
            jobId: job.id,
            analysisJobId: analysisJob.id,
            novelSourceId: novelSource.id,
            novelTitle,
            novelAuthor,
            characterCount: parsed.characterCount,
            chapterCount: parsed.chapterCount,
          },
          message: 'Novel imported, analysis job created',
          requestId: randomUUID(),
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        // 更新任务状态为 FAILED
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: 'FAILED',
            errorMessage: error?.message || 'Unknown error',
          },
        });

        // 统一错误处理：将错误转换为明确的业务异常
        if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
          throw error;
        }

        // 其他未知错误，转换为 BadRequestException
        throw new BadRequestException(error?.message || '导入小说失败，请稍后重试');
      }
    } catch (error: any) {
      // 清理上传的文件
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }

      // 如果已经是封装好的 UnprocessableEntityException，直接抛出
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      // 明确区分错误类型，提供清晰的中文错误提示
      let errorMessage = '导入失败，请稍后重试';
      if (error instanceof BadRequestException) {
        // 如果已经是 BadRequestException，直接使用其 message
        errorMessage = error.message;
      } else if (error.message?.includes('Unsupported file type')) {
        errorMessage = '文件格式错误：不支持的文件类型';
      } else if (error.message?.includes('Failed to decode') || error.message?.includes('encoding')) {
        errorMessage = '编码错误：无法识别文件编码，请确保文件为 UTF-8 编码';
      } else if (error.message?.includes('parse') || error.message?.includes('解析')) {
        errorMessage = '解析错误：无法解析小说文本，请检查文件编码或内容格式';
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new BadRequestException(errorMessage);
    }
  }

  @Post('import')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  async importNovel(
    @Param('projectId') projectId: string,
    @Body() importNovelDto: ImportNovelDto,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request,
  ) {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }

    // 检查项目权限
    await this.projectService.checkOwnership(projectId, user.userId);

    // 1. 创建 NovelSource（文本导入模式）
    // 兼容多种 Payload 字段（支持前端直接传 title+content 或 title+rawText）
    let rawText = importNovelDto.rawText || importNovelDto.content || (request.body as any)?.rawText || (request.body as any)?.content;
    const title = importNovelDto.title || (request.body as any)?.title || '未命名作品';

    // 尝试查找已存在的最新 NovelSource（由 import-file 创建）
    let novelSource = await this.prisma.novelSource.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // 如果没有 rawText，检查是否是仅更新元数据或确认
    if (!rawText) {
      if (novelSource && (importNovelDto.novelName || importNovelDto.author || importNovelDto.fileUrl)) {
        // 更新元数据模式
        novelSource = await this.prisma.novelSource.update({
          where: { id: novelSource.id },
          data: {
            novelTitle: importNovelDto.novelName || novelSource.novelTitle,
            novelAuthor: importNovelDto.author || novelSource.novelAuthor,
            // filePath / fileUrl 等通常由 upload 决定，这里暂不覆盖除非明确
          },
        });
        // 获取 rawText 以便后续重新生成 Task/Job (如果需要)
        // 注意：如果是大文件，rawText 可能未全部加载。
        // 但根据当前逻辑，import-file 保存了 rawText，所以我们可以取出来。
        rawText = novelSource.rawText || '';
      }

      if (!rawText) {
        throw new BadRequestException('小说内容不能为空 (rawText or content is required)');
      }
    } else {
      // 安全审查 (BLOCK 时必须零写入)
      const traceId = randomUUID();
      await this.performSafetyCheck(rawText, {
        projectId,
        userId: user.userId,
        organizationId,
        traceId,
      });

      // 标准文本导入模式：创建新 Source
      novelSource = await this.prisma.novelSource.create({
        data: {
          projectId,
          novelTitle: title,
          rawText: rawText,
          characterCount: rawText.length,
        },
      });
    }

    if (!novelSource) {
      throw new BadRequestException('无法定位小说源且未提供新内容 (Novel source not found and no content provided)');
    }

    // 2. 检查现存章节（幂等性处理）
    let savedChapters = await this.prisma.novelChapter.findMany({
      where: { novelSourceId: novelSource.id },
      orderBy: { orderIndex: 'asc' },
    });

    if (savedChapters.length === 0) {
      // 没有任何章节（可能是新创建的 Source，或数据不完整），执行解析与保存
      const chapters = this.fileParserService.parseChaptersFromText(rawText);
      savedChapters = [];
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const savedChapter = await this.prisma.novelChapter.create({
          data: {
            novelSourceId: novelSource.id,
            orderIndex: i + 1,
            title: chapter.title,
            rawText: chapter.content,
            characterCount: chapter.content.length,
          },
        });
        savedChapters.push(savedChapter);
      }
    }

    // 4. 创建 Task（NOVEL_ANALYSIS 类型）
    const task = await this.taskService.create({
      organizationId,
      projectId,
      type: TaskTypeEnum.NOVEL_ANALYSIS,
      status: TaskStatusEnum.PENDING,
      payload: {
        novelSourceId: novelSource.id,
        chapterIds: savedChapters.map((ch) => ch.id),
      },
    });

    // 5. 为每个章节创建 Job（NOVEL_ANALYZE_CHAPTER 类型）
    const jobIds = [];
    for (const chapter of savedChapters) {
      const job = await this.jobService.createNovelAnalysisJob(
        {
          type: 'NOVEL_ANALYSIS' as any,
          payload: {
            chapterId: chapter.id,
            projectId,
            organizationId,
            userId: user.userId,
          },
        },
        user.userId,
        organizationId,
        task.id,
        undefined, // apiKeyId
        request.ip || request.headers['x-forwarded-for'] as string,
        request.headers['user-agent'],
      );
      jobIds.push(job.id);
    }

    // 记录审计日志：NOVEL_IMPORT
    const requestInfo = AuditLogService.extractRequestInfo(request);
    try {
      await this.auditLogService.record({
        userId: user.userId,
        action: 'NOVEL_IMPORT',
        resourceType: 'project',
        resourceId: projectId,
        ip: requestInfo.ip,
        userAgent: requestInfo.userAgent,
        details: {
          projectId,
          novelSourceId: novelSource.id,
          novelTitle: importNovelDto.title,
          characterCount: rawText.length,
          chapterCount: savedChapters.length,
          importMode: 'text',
        },
      });
    } catch (auditError) {
      // 审计日志写入失败不影响主流程
      console.error('Failed to record audit log for NOVEL_IMPORT:', auditError);
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        novelSourceId: novelSource.id,
        chapterCount: savedChapters.length,
        jobIds,
      },
      message: 'Novel imported, analysis tasks created',
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('jobs')
  async getAnalysisJobs(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }

    // 检查项目权限
    await this.projectService.checkOwnership(projectId, user.userId);

    // 返回 NOVEL_ANALYSIS 类型的 ShotJob（符合前端期望）
    const jobs = await this.prisma.shotJob.findMany({
      where: {
        projectId,
        type: JobTypeEnum.NOVEL_ANALYSIS,
        organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // 只返回最新的 10 条，符合"只保留最新一条有效记录"的规则
    });

    // 映射为前端期望的格式
    const mappedJobs = jobs.map((job: any) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      payload: job.payload,
      // 额外可观测字段：用于前端展示“为什么一直重试/失败”
      lastError: job.lastError ?? null,
      retryCount: job.retryCount ?? null,
    }));

    // 查询 EngineTask 视图（只读聚合，不修改数据）
    const engineTasks = await this.engineTaskService.findEngineTasksByProject(
      projectId,
      'NOVEL_ANALYSIS',
    );

    return {
      success: true,
      data: {
        jobs: mappedJobs, // 保持原有字段，确保前端兼容
        engineTasks, // 新增字段：EngineTask 视图
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('analyze')
  @RequireSignature() // CE10: 高成本接口（触发解析/增强），强制签名验证
  @Permissions(ProjectPermissions.PROJECT_GENERATE)
  @AuditAction(AuditActions.JOB_CREATE)
  async analyzeNovel(
    @Param('projectId') projectId: string,
    @Body() body: { chapterId?: string }, // 如果提供 chapterId，只分析单章；否则分析全书
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request,
  ) {
    if (!organizationId) {
      throw new ForbiddenException('No organization context');
    }

    // 检查项目权限
    await this.projectService.checkOwnership(projectId, user.userId);

    // 获取 NovelSource
    const novelSource = await this.prisma.novelSource.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!novelSource) {
      throw new NotFoundException('当前项目没有可用的小说源，请先导入小说文件');
    }

    // 创建分析任务
    const analysisJob = await this.prisma.novelAnalysisJob.create({
      data: {
        projectId,
        novelSourceId: novelSource.id,
        chapterId: body.chapterId || null,
        jobType: body.chapterId ? 'ANALYZE_CHAPTER' : 'ANALYZE_ALL',
        status: 'PENDING',
      },
    });

    // 如果是单章分析，立即处理
    let job: any = null;

    if (body.chapterId) {
      try {
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: { status: 'RUNNING' },
        });

        // TODO: 这里应该通过 Job 系统处理，暂时直接调用
        // 未来应该创建 NOVEL_ANALYZE_CHAPTER 类型的 Job，由 Worker 处理
        await this.novelImportService.analyzeChapter(body.chapterId);

        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: { status: 'DONE' },
        });

        // 记录审计日志：NOVEL_ANALYZE（单章分析）
        const requestInfo = AuditLogService.extractRequestInfo(request);
        try {
          await this.auditLogService.record({
            userId: user.userId,
            action: 'NOVEL_ANALYZE',
            resourceType: 'novel_analysis_job',
            resourceId: analysisJob.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
              projectId,
              novelSourceId: novelSource.id,
              jobType: analysisJob.jobType,
              chapterId: body.chapterId,
            },
          });
        } catch (auditError) {
          // 审计日志写入失败不影响主流程
          console.error('Failed to record audit log for NOVEL_ANALYZE:', auditError);
        }
      } catch (error: any) {
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: 'FAILED',
            errorMessage: error?.message || 'Unknown error',
          },
        });
        throw error;
      }
    } else {
      // 全书分析：通过 Job 系统异步处理
      try {
        // 1. 创建 Task
        const task = await this.taskService.create({
          organizationId,
          projectId,
          type: TaskTypeEnum.NOVEL_ANALYSIS,
          status: TaskStatusEnum.PENDING,
          payload: {
            projectId,
            novelSourceId: novelSource.id,
            analysisJobId: analysisJob.id,
          },
        });

        // 2. 创建 NOVEL_ANALYSIS Job（不需要 shotId，使用 createNovelAnalysisJob 但传入最小 payload）
        // 注意：createNovelAnalysisJob 会创建占位结构，但 Worker 会重新生成完整结构
        job = await this.jobService.createNovelAnalysisJob(
          {
            type: 'NOVEL_ANALYSIS' as any,
            payload: {
              projectId,
              novelSourceId: novelSource.id,
              organizationId,
              userId: user.userId,
            },
          },
          user.userId,
          organizationId,
          task.id,
          undefined, // apiKeyId
          request.ip || request.headers['x-forwarded-for'] as string,
          request.headers['user-agent'],
        );

        // 3. 更新 NovelAnalysisJob 状态为 PENDING（等待 Worker 处理）
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: 'PENDING',
            progress: {
              message: 'Job created, waiting for worker',
              jobId: job.id,
              taskId: task.id,
            },
          },
        });

        console.log(`[NovelImport] Created NOVEL_ANALYSIS Job: ${job.id}, Task: ${task.id}`);

        // 记录审计日志：NOVEL_ANALYZE
        const requestInfo = AuditLogService.extractRequestInfo(request);
        try {
          await this.auditLogService.record({
            userId: user.userId,
            action: 'NOVEL_ANALYZE',
            resourceType: 'novel_analysis_job',
            resourceId: analysisJob.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
              projectId,
              novelSourceId: novelSource.id,
              jobType: analysisJob.jobType,
              chapterId: body.chapterId || null,
              jobId: job.id,
              taskId: task.id,
            },
          });
        } catch (auditError) {
          // 审计日志写入失败不影响主流程
          console.error('Failed to record audit log for NOVEL_ANALYZE:', auditError);
        }
      } catch (error: any) {
        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            status: 'FAILED',
            errorMessage: error?.message || 'Unknown error',
          },
        });
        throw error;
      }
    }

    return {
      success: true,
      data: {
        jobId: job?.id || analysisJob.id,
        analysisStatus: (body.chapterId ? 'DONE' : 'ANALYZING') as NovelAnalysisStatus,
        message: body.chapterId ? 'Chapter analysis started' : 'Full novel analysis started',
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}








