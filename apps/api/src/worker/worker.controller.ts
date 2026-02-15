import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { WorkerService } from './worker.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Request } from 'express';
import { AuditLogService } from '../audit-log/audit-log.service';
@Controller('workers')
@UseGuards(JwtOrHmacGuard) // 支持 JWT 或 HMAC 认证
export class WorkerController {
  constructor(
    private readonly workerService: WorkerService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService
  ) { }

  /**
   * Worker 注册
   * POST /workers/register
   */
  @Post('register')
  async register(
    @Body() registerDto: RegisterWorkerDto,
    @CurrentUser() user: { userId: string },
    @Req() request: Request
  ): Promise<any> {
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKey?.id;

    const worker = await this.workerService.registerWorker(
      registerDto.workerId,
      registerDto.name,
      registerDto.capabilities,
      registerDto.gpuCount,
      registerDto.gpuMemory,
      registerDto.gpuType,
      user?.userId,
      apiKeyId,
      requestInfo.ip,
      requestInfo.userAgent
    );

    if (!worker) {
      throw new NotFoundException('Worker not found after registration');
    }

    return {
      success: true,
      data: {
        id: worker.id,
        workerId: worker.workerId,
        status: worker.status,
        capabilities: worker.capabilities,
      },
    };
  }

  /**
   * Worker 心跳
   * POST /workers/:workerId/heartbeat
   * Stage2-B: 使用 WorkerHeartbeat 模型记录心跳
   */
  @Post(':workerId/heartbeat')
  async heartbeat(
    @Param('workerId') workerId: string,
    @Body() heartbeatDto: HeartbeatDto,
    @CurrentUser() user: { userId: string },
    @Req() request: Request
  ): Promise<any> {
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKey?.id;

    const worker = await this.workerService.heartbeat(
      workerId,
      heartbeatDto.status,
      heartbeatDto.tasksRunning,
      heartbeatDto.temperature,
      user?.userId,
      apiKeyId,
      requestInfo.ip,
      requestInfo.userAgent
    );

    return {
      ok: true,
      workerId: worker.workerId,
      ts: new Date().toISOString(),
    };
  }

  /**
   * 获取在线 Worker 列表
   * GET /workers/online
   */
  @Get('online')
  async getOnlineWorkers(@Param('jobType') jobType?: string) {
    const workers = await this.workerService.getOnlineWorkers(jobType);

    return {
      success: true,
      data: workers.map((w) => ({
        id: w.id,
        workerId: w.workerId,
        status: w.status,
        capabilities: w.capabilities,
        lastHeartbeat: w.lastHeartbeat,
        tasksRunning: w.tasksRunning,
      })),
    };
  }

  /**
   * Worker 拉取下一个 Job
   * POST /workers/:workerId/jobs/next
   */
  @Post(':workerId/jobs/next')
  async getNextJob(
    @Param('workerId') workerId: string,
    @CurrentUser() user: { userId: string },
    @Req() request: Request
  ): Promise<any> {
    const logger = new Logger(WorkerController.name);
    // logger.log(`[WorkerController] getNextJob called. WorkerId=${workerId}`);
    console.log(`[WorkerController] CONSOLE LOG: getNextJob called. WorkerId=${workerId}`);

    // 商业级审计：强制要求x-worker-id header
    const headerWorkerId = ((request.headers['x-worker-id'] as string) || '').trim();
    if (!headerWorkerId) {
      throw new NotFoundException('Missing x-worker-id header for claim audit');
    }
    if (headerWorkerId !== workerId) {
      throw new NotFoundException(
        `x-worker-id header mismatch: expected=${workerId} actual=${headerWorkerId}`
      );
    }

    // 通过 WorkerService 获取下一条待处理的 Job（解构后的入口）
    const job = await this.workerService.dispatchNextJobForWorker(workerId);

    // 结构化日志：WORKER_JOBS_NEXT_RESULT
    // const logger = new Logger(WorkerController.name); // Removed redeclaration
    logger.log(
      JSON.stringify({
        event: 'WORKER_JOBS_NEXT_RESULT',
        workerId,
        statusCode: 200,
        returnedJobId: job?.id || null,
        timestamp: new Date().toISOString(),
      })
    );

    if (!job) {
      return {
        success: true,
        data: null,
        message: 'No job available',
      };
    }

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKey?.id;
    const nonce = (request as any).hmacNonce as string | undefined;
    const signature = (request as any).hmacSignature as string | undefined;
    const hmacTimestamp = (request as any).hmacTimestamp as string | undefined;

    await this.auditLogService.record({
      userId: user?.userId,
      apiKeyId,
      action: 'JOB_STARTED',
      resourceType: 'job',
      resourceId: job.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: {
        workerId,
        taskId: job.taskId,
        type: job.type,
      },
      traceId: job.traceId || undefined,
    });

    return {
      success: true,
      data: {
        id: job.id,
        type: job.type,
        payload: job.payload,
        engineKey: (job as any).engineBinding?.engineKey || (job.payload as any)?.engineKey,
        taskId: job.taskId,
        shotId: job.shotId,
        projectId: job.projectId,
        episodeId: job.episodeId,
        sceneId: job.sceneId,
        organizationId: job.organizationId,
        traceId: job.traceId,
        isVerification: job.isVerification,
        createdAt: job.createdAt,
      },
    };
  }
}
