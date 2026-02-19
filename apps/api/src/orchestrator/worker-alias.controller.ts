import {
    Controller,
    Post,
    Param,
    Body,
    Get,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { WorkerService } from '../worker/worker.service';
import { RegisterWorkerDto } from '../worker/dto/register-worker.dto';
import { HeartbeatDto } from '../worker/dto/heartbeat.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Request } from 'express';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrchestratorService } from './orchestrator.service';

/**
 * Worker Alias Controller (Migrated to Orchestrator to break circular dependency)
 * 提供 /api/workers 复数路径的兼容层
 */
@Controller('workers')
@UseGuards(JwtOrHmacGuard)
export class WorkerAliasController {
    constructor(
        private readonly workerService: WorkerService,
        private readonly auditLogService: AuditLogService
    ) { }

    /**
     * Worker 注册
     * POST /api/workers
     */
    @Post()
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
            throw new Error('Worker not found after registration');
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
     * POST /api/workers/:workerId/heartbeat
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
     * Worker 拉取下一个 Job
     * GET /api/workers/:workerId/jobs/next
     * POST /api/workers/:workerId/jobs/next
     */
    @Get(':workerId/jobs/next')
    @Post(':workerId/jobs/next')
    async getNextJob(
        @Param('workerId') workerId: string,
        @CurrentUser() user: { userId: string },
        @Req() request: Request
    ): Promise<any> {
        console.log(`[XXX_DEBUG] WorkerAliasController.getNextJob called for ${workerId}`);
        const job = await this.workerService.dispatchNextJobForWorker(workerId);

        if (!job) {
            return {
                success: true,
                data: null,
                message: 'No job available',
            };
        }

        const requestInfo = AuditLogService.extractRequestInfo(request);
        const apiKeyId = (request as any).apiKey?.id;
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
                taskId: job.taskId,
                shotId: job.shotId,
            },
        };
    }
}
