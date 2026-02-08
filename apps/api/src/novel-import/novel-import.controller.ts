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
  Logger,
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
import {
  TaskType as TaskTypeEnum,
  TaskStatus as TaskStatusEnum,
  JobType as JobTypeEnum,
} from 'database';
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
  private readonly logger = new Logger(NovelImportController.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'novels');
  private readonly SHREDDER_THRESHOLD_CHARACTERS = 1000000;

  constructor(
    @Inject(NovelImportService) private readonly novelImportService: NovelImportService,
    @Inject(FileParserService) private readonly fileParserService: FileParserService,
    @Inject(NovelAnalysisProcessorService)
    private readonly analysisProcessor: NovelAnalysisProcessorService,
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TaskService) private readonly taskService: TaskService,
    @Inject(EngineTaskService) private readonly engineTaskService: EngineTaskService,
    @Inject(JobService) private readonly jobService: JobService,
    @Inject(StructureGenerateService)
    private readonly structureGenerateService: StructureGenerateService,
    @Inject(SceneGraphService) private readonly sceneGraphService: SceneGraphService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    @Inject(FeatureFlagService) private readonly featureFlagService: FeatureFlagService,
    @Inject(TextSafetyService) private readonly textSafetyService: TextSafetyService
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
      resourceId: context.traceId, // 暂用 traceId，实际落库时可能还没有 NovelId
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
          cb(
            new BadRequestException(
              `File type ${ext} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`
            ),
            false
          );
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
    @Req() request: Request
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!organizationId) throw new ForbiddenException('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);

    const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
    const filePath = file.path;
    const traceId = randomUUID();

    try {
      // 1. 预创建核心记录 (SSOT)
      const initialTitle =
        importNovelFileDto.title ||
        this.fileParserService.extractTitleFromFileName(file.originalname) ||
        path.basename(file.originalname, path.extname(file.originalname));

      const novelSource = await this.prisma.novel.create({
        data: {
          projectId,
          organizationId,
          title: initialTitle,
          author: importNovelFileDto.author || 'Unknown',
          status: 'PARSING',
          metadata: {
            originalFileName: file.originalname,
            fileSize: file.size,
            importType: 'FILE',
            traceId,
          },
        },
      });

      const analysisJob = await this.prisma.novelAnalysisJob.create({
        data: {
          projectId,
          novelSourceId: novelSource.id,
          jobType: 'ANALYZE_ALL',
          status: 'PENDING',
        },
      });

      // P0-S4: Massive File Guard (0-Memory-Bomb)
      // 如果文件 > 5MB，直接进入 Shredder，不走 FileParserService
      if (file.size > 5000000) {
        const result = await this.novelImportService.triggerShredderWorkflow(
          novelSource.id,
          projectId,
          organizationId,
          user.userId,
          filePath,
          file.originalname,
          traceId
        );

        await this.prisma.novelAnalysisJob.update({
          where: { id: analysisJob.id },
          data: {
            progress: {
              message: 'Massive file detected, Shredder Scan started',
              jobId: result.jobId,
              taskId: result.taskId,
              mode: 'SHREDDER',
            },
          },
        });

        return {
          success: true,
          data: {
            jobId: result.jobId,
            taskId: result.taskId,
            novelSourceId: novelSource.id,
            mode: 'SHREDDER',
          },
          message: 'Massive novel detected, Shredder scanning started',
          requestId: randomUUID(),
          timestamp: new Date().toISOString(),
        };
      }

      // 2. 普通解析路径
      const parsed = await this.fileParserService.parseFile(filePath, fileExt, file.originalname);

      // 安全审查
      await this.performSafetyCheck(parsed.rawText, {
        projectId,
        userId: user.userId,
        organizationId,
        traceId,
      });

      // 3. 更新模型并创建结构 (V3.0)
      const title = importNovelFileDto.title || parsed.title || initialTitle;
      const author = importNovelFileDto.author || parsed.author || 'Unknown';

      await this.prisma.novel.update({
        where: { id: novelSource.id },
        data: {
          title,
          author,
          characterCount: parsed.characterCount,
          chapterCount: parsed.chapterCount,
          metadata: parsed.metadata ? JSON.parse(JSON.stringify(parsed.metadata)) : novelSource.metadata,
        },
      });

      const volume = await this.prisma.novelVolume.create({
        data: { projectId, novelSourceId: novelSource.id, index: 1, title: '默认卷' },
      });

      for (let j = 0; j < parsed.chapters.length; j++) {
        const ch = parsed.chapters[j];
        const savedChapter = await this.prisma.novelChapter.create({
          data: {
            novelSourceId: novelSource.id,
            volumeId: volume.id,
            index: j + 1,
            title: ch.title,
            rawContent: ch.content,
          },
        });
        await this.prisma.scene.create({
          data: {
            chapterId: savedChapter.id,
            projectId,
            sceneIndex: 1,
            title: 'Scene 1',
          },
        });
      }

      // 4. 发起异步 Job
      const task = await this.taskService.create({
        organizationId,
        projectId,
        type: 'NOVEL_ANALYSIS',
        status: 'PENDING',
        traceId,
      });

      const job = await this.jobService.createNovelAnalysisJob(
        {
          type: JobTypeEnum.NOVEL_ANALYSIS as any,
          payload: {
            projectId,
            novelSourceId: novelSource.id,
            taskId: task.id,
            traceId,
            title,
            author,
            chapterCount: parsed.chapterCount,
          },
        },
        user.userId,
        organizationId,
        task.id,
        undefined,
        request.ip || (request.headers['x-forwarded-for'] as string),
        request.headers['user-agent']
      );

      await this.prisma.novelAnalysisJob.update({
        where: { id: analysisJob.id },
        data: {
          progress: { message: 'Job created', jobId: job.id, taskId: task.id },
        },
      });

      // 审计日志
      const requestInfo = AuditLogService.extractRequestInfo(request);
      this.auditLogService
        .record({
          userId: user.userId,
          action: 'NOVEL_IMPORT_FILE',
          resourceType: 'project',
          resourceId: projectId,
          ip: requestInfo.ip,
          userAgent: requestInfo.userAgent,
          details: { novelSourceId: novelSource.id, title, characterCount: parsed.characterCount },
        })
        .catch((e) => this.logger.error('Audit fail', e));

      return {
        success: true,
        data: {
          jobId: job.id,
          analysisJobId: analysisJob.id,
          novelSourceId: novelSource.id,
          title,
          author,
          characterCount: parsed.characterCount,
          chapterCount: parsed.chapterCount,
        },
        message: 'Novel imported, analysis job created',
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (filePath) await fs.unlink(filePath).catch(() => { });
      if (error instanceof UnprocessableEntityException) throw error;
      throw new BadRequestException(error.message || 'Import failed');
    }
  }
  @Post('import')
  @RequireSignature()
  async importNovel(
    @Param('projectId') projectId: string,
    @Body() importNovelDto: ImportNovelDto,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request
  ) {
    if (!organizationId) throw new ForbiddenException('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);

    const rawText = importNovelDto.rawText || importNovelDto.content || '';
    if (!rawText) throw new BadRequestException('小说内容不能为空');

    const traceId = randomUUID();
    const title = importNovelDto.title || 'Direct Import ' + new Date().toISOString();

    // P0-S4: Massive Text Guard (Shredder)
    if (rawText.length > this.SHREDDER_THRESHOLD_CHARACTERS) {
      this.logger.log(`[Stage 4] Large text import detected (${rawText.length} chars), offloading to Shredder.`);

      const tempFileName = `direct-import-${Date.now()}.txt`;
      const tempPath = path.join(this.uploadDir, tempFileName);
      await fs.writeFile(tempPath, rawText);

      const novelSource = await this.prisma.novel.create({
        data: {
          projectId,
          organizationId,
          title,
          author: importNovelDto.author || 'Unknown',
          status: 'PARSING',
          metadata: { importType: 'TEXT', traceId, originalFileName: tempFileName },
        },
      });

      const result = await this.novelImportService.triggerShredderWorkflow(
        novelSource.id,
        projectId,
        organizationId,
        user.userId,
        tempPath,
        tempFileName,
        traceId
      );

      return {
        success: true,
        data: { jobId: result.jobId, taskId: result.taskId, novelSourceId: novelSource.id, mode: 'SHREDDER' },
        message: 'Massive text detected, Shredder scanning started',
      };
    }

    // 普通文本导入路径
    await this.performSafetyCheck(rawText, { projectId, userId: user.userId, organizationId, traceId });

    const novelSource = await this.prisma.novel.create({
      data: {
        projectId,
        organizationId,
        title,
        author: importNovelDto.author || 'Unknown',
        characterCount: rawText.length,
        status: 'PARSING',
      },
    });

    // 创建 V3.0 结构：Volume -> Chapter -> Scene
    const volume = await this.prisma.novelVolume.create({
      data: { projectId, novelSourceId: novelSource.id, index: 1, title: '默认卷' },
    });

    const chapters = this.fileParserService.parseChaptersFromText(rawText);
    const savedChapterIds = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const savedChapter = await this.prisma.novelChapter.create({
        data: {
          novelSourceId: novelSource.id,
          volumeId: volume.id,
          index: i + 1,
          title: ch.title,
          rawContent: ch.content,
        },
      });
      await this.prisma.scene.create({
        data: { chapterId: savedChapter.id, projectId, sceneIndex: 1, title: 'Scene 1' },
      });
      savedChapterIds.push(savedChapter.id);
    }

    const task = await this.taskService.create({
      organizationId,
      projectId,
      type: 'NOVEL_ANALYSIS',
      status: 'PENDING',
      traceId,
    });

    const job = await this.jobService.createNovelAnalysisJob(
      {
        type: JobTypeEnum.NOVEL_ANALYSIS as any,
        payload: {
          projectId,
          novelSourceId: novelSource.id,
          taskId: task.id,
          traceId,
          title,
          chapterCount: chapters.length,
        },
      },
      user.userId,
      organizationId,
      task.id,
      undefined,
      request.ip || (request.headers['x-forwarded-for'] as string),
      request.headers['user-agent']
    );

    return {
      success: true,
      data: { jobId: job.id, taskId: task.id, novelSourceId: novelSource.id, chapterCount: chapters.length },
      message: 'Novel imported, analysis job created',
    };
  }

  @Get('jobs')
  async getAnalysisJobs(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null
  ) {
    if (!organizationId) throw new ForbiddenException('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);

    const jobs = await this.prisma.novelAnalysisJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      data: { jobs },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('analyze')
  @RequireSignature()
  @Permissions(ProjectPermissions.PROJECT_GENERATE)
  async analyzeNovel(
    @Param('projectId') projectId: string,
    @Body() body: { chapterId?: string },
    @CurrentUser() user: { userId: string },
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request
  ) {
    if (!organizationId) throw new ForbiddenException('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);

    const novelSource = await this.prisma.novel.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!novelSource) throw new NotFoundException('找不到小说源');

    const task = await this.taskService.create({
      organizationId,
      projectId,
      type: 'NOVEL_ANALYSIS',
      status: 'PENDING',
    });

    const job = await this.jobService.createNovelAnalysisJob(
      {
        type: JobTypeEnum.NOVEL_ANALYSIS as any,
        payload: {
          projectId,
          novelSourceId: novelSource.id,
          chapterId: body.chapterId,
          organizationId,
          userId: user.userId,
        },
      },
      user.userId,
      organizationId,
      task.id,
      undefined,
      request.ip || (request.headers['x-forwarded-for'] as string),
      request.headers['user-agent']
    );

    return {
      success: true,
      data: { jobId: job.id, taskId: task.id },
      message: 'Analysis started',
    };
  }
}
