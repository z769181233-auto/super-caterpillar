import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { JobService } from '../job/job.service';
import { JobType } from 'database';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Controller('timeline')
export class TimelineController {
  constructor(private readonly jobService: JobService) {}

  @Post('preview')
  @UseGuards(JwtOrHmacGuard)
  async createPreview(@Body() body: any, @Req() req: any) {
    // 1. Validate Payload
    const { projectId, ...timelineData } = body;
    if (!projectId) throw new BadRequestException('projectId is required');
    if (
      !timelineData.shots ||
      !Array.isArray(timelineData.shots) ||
      timelineData.shots.length === 0
    ) {
      throw new BadRequestException('shots array must be provided and non-empty');
    }

    // 2. Resolve User/Org
    const userId = req.user?.id || req.apiKeyOwnerUserId;
    // Fallback: If req.user doesn't have orgId (e.g. specialized auth), try apiKey attribute or body or default
    const orgId =
      req.user?.orgId ||
      req.user?.defaultOrganizationId ||
      req.apiKeyOwnerOrgId ||
      body.organizationId;

    if (!userId || !orgId) {
      throw new BadRequestException('User context invalid (userId or orgId missing)');
    }

    // 3. Persist Timeline Data (Contract with Processor: expects file)
    // Path: .runtime/timelines/<projectId>/<uuid>.json
    const runtimeDir = path.resolve(process.cwd(), '.runtime');
    const storageKeyRaw = `timelines/${projectId}/${randomUUID()}.json`;
    const absPath = path.join(runtimeDir, storageKeyRaw);

    try {
      if (!fs.existsSync(path.dirname(absPath))) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
      }
      fs.writeFileSync(absPath, JSON.stringify(timelineData, null, 2));
    } catch (e: any) {
      throw new InternalServerErrorException(`Failed to persist timeline data: ${e.message}`);
    }

    // 4. Create Job
    // Anchor to first shot for ShotJob requirement
    const firstShotId = timelineData.shots[0].shotId;
    if (!firstShotId) throw new BadRequestException('First shot must have a valid shotId');

    const job = await this.jobService.create(
      firstShotId,
      {
        type: JobType.TIMELINE_PREVIEW,
        payload: {
          projectId,
          timelineStorageKey: storageKeyRaw,
          pipelineRunId: `run-${Date.now()}`,
          // Pass optional params if needed by processor
          width: timelineData.width,
          height: timelineData.height,
          fps: timelineData.fps,
        },
      },
      userId,
      orgId
      // taskId is optional
    );

    return { success: true, jobId: job.id };
  }
}
