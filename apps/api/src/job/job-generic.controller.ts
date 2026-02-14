import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Req,
  Inject,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { randomUUID } from 'crypto';
import { CapacityGateService } from '../capacity/capacity-gate.service';
import { JobType } from 'database';

/**
 * JobGenericController
 * 处理不带 shotId 路径前缀的 Job 请求，例如 POST /api/jobs
 * 专门用于项目级别的编排任务（如 VIDEO_RENDER）
 */
@Controller('jobs')
@UseGuards(JwtOrHmacGuard)
export class JobGenericController {
  constructor(
    @Inject(JobService)
    private readonly jobService: JobService
    // private readonly capacityGateService: CapacityGateService
  ) {}

  @Post()
  async createGenericJob(
    @Body() createJobDto: CreateJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string,
    @Req() req: any
  ): Promise<any> {
    try {
      console.log('[JobGenericController] Received request:', JSON.stringify(createJobDto));
      console.log('[JobGenericController] User:', JSON.stringify(user));

      if (!process.env.ENABLE_JOB_GENERIC_CONTROLLER) {
        throw new HttpException('JobGenericController is disabled', HttpStatus.FORBIDDEN);
      }

      const userId = user?.userId || req.apiKeyId || 'system-worker';
      if (!userId) {
        throw new HttpException('USER_CONTEXT_MISSING', HttpStatus.UNAUTHORIZED);
      }

      // 1. 容量校验 (Disabled for now)
      // ...

      // 2. 创建 Job
      // Security Hardening: Only use root jobType/projectId/orgId for system-worker/HMAC requests
      const isSystemWorker = !!(req.apiKeyId || user?.userId === 'system-worker');

      const jobTypeStr = isSystemWorker
        ? (createJobDto.jobType ?? createJobDto.type)
        : createJobDto.type;
      const projectId = isSystemWorker
        ? (createJobDto.projectId ?? createJobDto.payload?.projectId ?? user?.userId)
        : (createJobDto.payload?.projectId ?? user?.userId);
      const orgId = isSystemWorker
        ? (createJobDto.organizationId ?? organizationId ?? 'org-default')
        : (organizationId ?? 'org-default');

      const job = await this.jobService.createCECoreJob({
        projectId,
        organizationId: orgId,
        jobType: jobTypeStr as JobType,
        payload: createJobDto.payload,
        traceId: createJobDto.traceId,
        isVerification: createJobDto.isVerification,
        dedupeKey: createJobDto.dedupeKey,
        priority: createJobDto.priority,
        // taskId: undefined // Explicitly undefined to avoid parentJobId mapping
      });

      console.log('[JobGenericController] SUCCESS. Job:', JSON.stringify(job));

      return {
        success: true,
        data: job,
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[JobGenericController] CRITICAL ERROR:', error.message, error.stack);
      throw error;
    }
  }
}
