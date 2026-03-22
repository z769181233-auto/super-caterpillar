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
  UnauthorizedException,
  BadRequestException,
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
  private readonly logger = new Logger(JobGenericController.name);

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
      if (!process.env.ENABLE_JOB_GENERIC_CONTROLLER) {
        throw new HttpException('JobGenericController is disabled', HttpStatus.FORBIDDEN);
      }

      const userId = user?.userId || req.apiKeyId;
      if (!userId) {
        throw new UnauthorizedException('Authentication required');
      }

      if (!organizationId) {
        throw new BadRequestException('Organization context required');
      }

      // 1. 创建 Job
      const jobTypeStr = createJobDto.type ?? createJobDto.jobType;
      if (!jobTypeStr) {
        throw new BadRequestException('Job type is required');
      }

      const projectId = createJobDto.projectId ?? createJobDto.payload?.projectId;
      if (!projectId) {
        throw new BadRequestException('Project ID is required');
      }

      const orgId = createJobDto.organizationId ?? organizationId;
      if (!orgId) {
        throw new BadRequestException('Organization ID is required');
      }

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

      this.logger.log(`[JobGenericController] createGenericJob success jobId=${job.id}`);

      return {
        success: true,
        data: job,
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(
        `[JobGenericController] createGenericJob failed: ${error?.message || 'unknown'}`
      );
      throw error;
    }
  }
}
