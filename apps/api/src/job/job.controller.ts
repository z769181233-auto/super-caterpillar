import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { JobService } from './job.service';
import { JobReportFacade } from './job-report.facade';
import { PermissionService } from '../permission/permission.service';

import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { QuotaGuard } from '../auth/guards/quota.guard';
import { BudgetGuard } from '../auth/guards/budget.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { ReportJobDto } from './dto/report-job.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { InstantiateCE01Dto } from './dto/instantiate-ce01.dto';
import { RetryJobDto, ForceFailJobDto, BatchJobOperationDto } from './dto/job-operations.dto';
import { AuditActions } from '../audit/audit.constants';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Controller()
@UseGuards(JwtOrHmacGuard)
export class JobController {
  private readonly logger = new Logger(JobController.name);

  constructor(
    @Inject(JobService)
    private readonly jobService: JobService,
    @Inject(JobReportFacade)
    private readonly jobReportFacade: JobReportFacade,
    @Inject(PermissionService)
    private readonly permissionService: PermissionService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    @Inject(CapacityGateService)
    private readonly capacityGateService: CapacityGateService
  ) {}

  @Get('debug-key/:key')
  @Public()
  async debugKey(@Param('key') key: string): Promise<any> {
    const prisma = (this.jobService as any).prisma;
    const record = await prisma.apiKey.findUnique({ where: { key } });
    const count = await prisma.project.count();
    return {
      found: !!record,
      key,
      dbUrlEnv: process.env.DATABASE_URL,
      projectCount: count,
      record: record ? { id: record.id, status: record.status } : null,
    };
  }

  @Post('shots/:shotId/jobs')
  @UseGuards(QuotaGuard, BudgetGuard)
  async createJob(
    @Param('shotId') shotId: string,
    @Body() createJobDto: CreateJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<any> {
    const u = (req as any).user;
    // Fix: Handle HMAC/Worker mode where u might be null
    const effectiveUserId = u?.userId || (req as any).apiKeyId || 'system-worker';

    // P1-1: API Backpressure Check
    const { env: scuEnv } = await import('@scu/config');
    if ((scuEnv as any).apiBackpressureEnabled) {
      const snapshot = await this.jobService.getQueueSnapshot();
      if (
        snapshot.pending >= (scuEnv as any).apiQueuePendingLimit ||
        snapshot.running >= (scuEnv as any).apiQueueRunningLimit
      ) {
        // Record rejection audit
        await this.auditLogService.record({
          userId: effectiveUserId,
          action: 'JOB_REJECTED_BACKPRESSURE',
          resourceType: 'job',
          details: {
            snapshot,
            limits: {
              pending: (scuEnv as any).apiQueuePendingLimit,
              running: (scuEnv as any).apiQueueRunningLimit,
            },
          },
        });

        const retryAfter = (scuEnv as any).apiRetryAfterSeconds || 5;
        // P1-1: 注入标准的 Retry-After 响应头
        if (res && typeof res.set === 'function') {
          res.set('Retry-After', retryAfter.toString());
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'System busy: Queue capacity reached. Please retry later.',
            code: 'API_BACKPRESSURE_LIMIT',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    // Fix: Use effectiveUserId instead of u.userId to ensure consistency
    const job = await this.jobService.create(shotId, createJobDto, effectiveUserId, organizationId);
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('shots/:shotId/jobs')
  async getJobsByShot(
    @Param('shotId') shotId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    const jobs = await this.jobService.findByShotId(shotId, user.userId, organizationId);
    return {
      success: true,
      data: jobs,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取容量使用情况
   * GET /api/jobs/capacity
   */
  @Get('jobs/capacity')
  async getCapacityUsage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    const usage = await this.capacityGateService.getCapacityUsage(organizationId);
    return {
      success: true,
      data: usage,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('jobs/:id')
  async getJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    this.logger.debug(
      `Controller getJob: id=${id}, userId=${user?.userId}, orgId=${organizationId}`
    );
    const job = await this.jobService.findJobById(id, user.userId, organizationId);
    this.logger.debug(
      `Controller job result: id=${job.id}, status=${job.status}, workerId=${job.workerId}`
    );
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('jobs')
  async listJobs(
    @Query() query: ListJobsDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    const result = await this.jobService.listJobs(user.userId, organizationId, query);
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * S3-C.2: Engine 质量摘要 API
   * GET /api/jobs/engine-summary?engineKey=xxx&projectId=xxx
   */
  @Get('jobs/engine-summary')
  async getEngineSummary(
    @Query('engineKey') engineKey: string,
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    const summary = await this.jobService.getEngineSummary(
      engineKey,
      projectId,
      user.userId,
      organizationId
    );
    return {
      success: true,
      data: summary,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/:id/retry')
  async retryJob(
    @Param('id') id: string,
    @Body() body: RetryJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const job = await this.jobService.retryJob(id, user.userId, organizationId, body.resetAttempts);
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/:id/cancel')
  async cancelJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const job = await this.jobService.cancelJob(id, user.userId, organizationId);
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/:id/force-fail')
  async forceFailJob(
    @Param('id') id: string,
    @Body() body: ForceFailJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const job = await this.jobService.forceFailJob(id, user.userId, organizationId, body.message);
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/batch/retry')
  async batchRetry(
    @Body() body: BatchJobOperationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const result = await this.jobService.batchRetry(
      body.jobIds,
      user.userId,
      organizationId,
      false
    );
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/batch/cancel')
  async batchCancel(
    @Body() body: BatchJobOperationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const result = await this.jobService.batchCancel(body.jobIds, user.userId, organizationId);
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('jobs/batch/force-fail')
  async batchForceFail(
    @Body() body: BatchJobOperationDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // Studio v0.7: 权限检查（仅 OWNER/ADMIN 可操作）
    await this.permissionService.assertCanManageJobs(user.userId, organizationId);
    const result = await this.jobService.batchForceFail(
      body.jobIds,
      user.userId,
      organizationId,
      body.note
    );
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Worker 上报 Job 开始执行（DISPATCHED → RUNNING）
   * POST /jobs/:id/start
   * Stage2-B: Worker 执行闭环
   */
  @Post('jobs/:id/start')
  async startJob(
    @Param('id') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKey?.id;

    // 从请求中获取 workerId（可以通过 header 或 body）
    const workerId = (request.body as any)?.workerId || (request.headers['x-worker-id'] as string);
    if (!workerId) {
      throw new BadRequestException('Worker ID is required');
    }

    const job = await this.jobService.markJobRunning(jobId, workerId);

    // 记录审计日志
    await this.auditLogService.record({
      userId: user?.userId,
      apiKeyId,
      action: 'JOB_STARTED',
      resourceType: 'job',
      resourceId: jobId,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: {
        workerId,
        jobType: job.type,
        taskId: job.taskId,
      },
    });

    return {
      ok: true,
      jobId: job.id,
      status: job.status,
    };
  }

  /**
   * Worker 回传 Job 执行结果
   * POST /jobs/:id/report
   */
  @Post('jobs/:id/report')
  async reportJob(
    @Param('id') jobId: string,
    @Body() reportDto: ReportJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKey?.id;
    const nonce = (request as any).hmacNonce as string | undefined;
    const signature = (request as any).hmacSignature as string | undefined;
    const hmacTimestamp = (request as any).hmacTimestamp as string | undefined;

    // 使用 Facade 层处理回报（自动触发质量闭环）
    const result = await this.jobReportFacade.handleReport({
      jobId,
      status: reportDto.status,
      result: reportDto.result,
      errorMessage: reportDto.errorMessage,
      userId: user?.userId,
      apiKeyId,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      hmacMeta: {
        nonce,
        signature,
        hmacTimestamp,
      },
      attempts: reportDto.attempts,
    });

    // Stage2-D: 返回格式 { ok: true, jobId, status }
    if (!result) {
      throw new NotFoundException(`Job ${jobId} not found after report`);
    }
    return {
      ok: true,
      jobId: result.id,
      status: result.status,
    };
  }

  /**
   * Stage 2: Worker Acknowledge Job (DISPATCHED -> RUNNING)
   * POST /jobs/:id/ack
   */
  @Post('jobs/:id/ack')
  async ackJob(@Param('id') jobId: string, @Req() request: Request): Promise<any> {
    const workerId = (request.body as any)?.workerId || (request.headers['x-worker-id'] as string);
    if (!workerId) {
      throw new BadRequestException('Worker ID is required');
    }

    const result = await this.jobService.ackJob(jobId, workerId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Stage 2: Worker Complete Job (RUNNING -> SUCCEEDED | FAILED)
   * POST /jobs/:id/complete
   */
  @Post('jobs/:id/complete')
  async completeJob(
    @Param('id') jobId: string,
    @Body() body: { status: 'SUCCEEDED' | 'FAILED'; result?: any; errorMessage?: string },
    @Req() request: Request
  ): Promise<any> {
    const workerId = (request.body as any)?.workerId || (request.headers['x-worker-id'] as string);
    if (!workerId) {
      throw new BadRequestException('Worker ID is required');
    }

    const result = await this.jobService.completeJob(jobId, workerId, body);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 实例化角色基准图 (CE01)
   * POST /jobs/ce01/instantiate
   */
  @Post('jobs/ce01/instantiate')
  async instantiateCE01(
    @Body() body: InstantiateCE01Dto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string,
    @Req() request: Request
  ): Promise<any> {
    const { characterId, projectId, posePreset, styleSeed, traceId } = body;

    // 1. 调用 Service 执行实例化
    const result = await this.jobService.createCharacterReferenceSheetJob({
      characterId,
      projectId,
      organizationId,
      posePreset,
      styleSeed,
      userId: user.userId,
      traceId,
    });

    // 2. 记录审计
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.JOB_CREATED,
      resourceType: 'job',
      resourceId: result.referenceSheetId,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: {
        type: 'CE01_REFERENCE_SHEET',
        characterId,
        projectId,
        fingerprint: result.fingerprint,
      },
    });

    return {
      ok: true,
      data: result,
    };
  }
}
