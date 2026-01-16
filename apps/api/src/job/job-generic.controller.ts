import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpException,
    HttpStatus,
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
        private readonly jobService: JobService,
        private readonly capacityGateService: CapacityGateService
    ) { }

    @Post()
    async createGenericJob(
        @Body() createJobDto: CreateJobDto,
        @CurrentUser() user: AuthenticatedUser,
        @CurrentOrganization() organizationId: string
    ): Promise<any> {
        // 权限与安全上下文劫持 (兼容 HMAC)
        if (!user.userId) {
            throw new HttpException('USER_CONTEXT_MISSING', HttpStatus.UNAUTHORIZED);
        }

        // 1. 容量校验 (P1 修复项：防止并发爆炸)
        const capacityResult = await this.capacityGateService.checkJobCapacity(
            createJobDto.type as JobType,
            organizationId,
            user.userId
        );

        if (!capacityResult.allowed) {
            throw new HttpException(
                capacityResult.reason || 'ORGANIZATION_CAPACITY_EXCEEDED',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // 2. 提取必要的 projectId
        const projectId = createJobDto.payload?.projectId;
        if (!projectId) {
            throw new HttpException('projectId is required in payload', HttpStatus.BAD_REQUEST);
        }

        // 3. 调用通用的 CECoreJob 创建逻辑
        const job = await this.jobService.createCECoreJob({
            projectId,
            organizationId,
            jobType: createJobDto.type as JobType,
            payload: createJobDto.payload,
            traceId: createJobDto.traceId,
            isVerification: createJobDto.isVerification,
            dedupeKey: createJobDto.dedupeKey,
        });

        return {
            success: true,
            data: job,
            requestId: randomUUID(),
            timestamp: new Date().toISOString(),
        };
    }
}
