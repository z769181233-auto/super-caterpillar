import { Controller, Get, Post, Param, Body, Query, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { JobService } from './job.service';
import { JobReportFacade } from './job-report.facade';
import { PermissionService } from '../permission/permission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { ReportJobDto } from './dto/report-job.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { RetryJobDto, ForceFailJobDto, BatchJobOperationDto } from './dto/job-operations.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { Request } from 'express';
import { randomUUID } from 'crypto';

@Controller()
@UseGuards(JwtOrHmacGuard)
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobReportFacade: JobReportFacade,
    private readonly permissionService: PermissionService,
    private readonly auditLogService: AuditLogService,
    private readonly capacityGateService: CapacityGateService,
  ) { }

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
      record: record ? { id: record.id, status: record.status } : null
    };
  }

  @Post('shots/:shotId/jobs')
  async createJob(
    @Param('shotId') shotId: string,
    @Body() createJobDto: CreateJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    const job = await this.jobService.create(shotId, createJobDto, user.userId, organizationId);
    return {
      success: true,
      data: job,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 简单容量探测：Gate2 使用
   * GET /api/jobs/capacity
   */
  @Get('jobs/capacity')
  async getCapacity(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    // 最小可验证实现：返回稳定结构，后续可接入真实 CapacityGateService
    return {
      ok: true,
      limits: { maxConcurrentJobs: 1 },
      usage: { runningJobs: 0 },
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

  @Get('jobs/:id')
  async getJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ): Promise<any> {
    console.log(`[DEBUG] Controller getJob: id=${id}, userId=${user?.userId}, orgId=${organizationId}`);
    const job = await this.jobService.findJobById(id, user.userId, organizationId);
    console.log(`[DEBUG] Controller job result: id=${job.id}, status=${job.status}, workerId=${job.workerId}`);
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
    const result = await this.jobService.batchRetry(body.jobIds, user.userId, organizationId, false);
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
    const result = await this.jobService.batchForceFail(body.jobIds, user.userId, organizationId, body.note);
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
    @Req() request: Request,
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
    @Req() request: Request,
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
}












