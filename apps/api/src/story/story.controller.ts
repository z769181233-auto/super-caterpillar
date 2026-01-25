import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { StoryService } from './story.service';
import { ApiSecurityService } from '../security/api-security/api-security.service';
import { JobService } from '../job/job.service';
import * as crypto from 'crypto';
import { JobType, PrismaClient } from 'database';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('story')
export class StoryController {
  constructor(
    private readonly storyService: StoryService,
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) { }

  /**
   * POST /api/story/parse
   * 小说结构化解析入口 (CE06)
   * 对齐 APISpec V1.1 & ce06_core_blueprint.md
   */
  @Post('parse')
  @UseGuards(JwtOrHmacGuard)
  async parseStory(@Body() body: any, @Req() req: any) {
    const { raw_text, context, projectId: topProjectId, title, author } = body;

    const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
    const userId = req.user?.id || req.apiKeyOwnerUserId;
    const traceId =
      req.headers['x-request-id'] || req.headers['x-trace-id'] || `req_${Date.now()}`;

    // Delegate to StoryService for Task & CE06 Job creation
    const result = await this.storyService.parseStory(
      {
        projectId: context?.projectId || topProjectId,
        rawText: raw_text,
        title: title || 'Direct Input',
        author: author || 'Direct Input',
      },
      userId,
      organizationId,
      req.ip,
      req.headers['user-agent'],
      traceId
    );

    return {
      success: true,
      data: {
        jobId: result.jobId,
        status: result.status,
        taskId: result.taskId,
        traceId: result.traceId,
      },
    };
  }
}
