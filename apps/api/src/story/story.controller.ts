import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiSecurityService } from '../security/api-security/api-security.service';
import { JobService } from '../job/job.service';
import * as crypto from 'crypto';
import { JobType, PrismaClient } from 'database';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('story')
export class StoryController {
  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * POST /api/story/parse
   * 小说结构化解析入口 (CE06)
   * 对齐 APISpec V1.1 & ce06_core_blueprint.md
   */
  @Post('parse')
  @UseGuards(JwtOrHmacGuard)
  async parseStory(@Body() body: any, @Req() req: any) {
    const { raw_text, context, projectId: topProjectId } = body;

    if (!raw_text) {
      return {
        success: false,
        message: 'raw_text is required',
        code: 4001,
      };
    }

    const projectId = context?.projectId || topProjectId;
    const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
    const userId = req.user?.id || req.apiKeyOwnerUserId;
    const traceId =
      req.headers['x-request-id'] || req.headers['x-trace-id'] || `req_${Date.now()} `;

    let novelSourceId = context?.novelSourceId;

    // Create NovelSource if validation passed
    if (projectId && raw_text) {
      const source = await this.prisma.novelSource.create({
        data: {
          projectId,
          fileName: 'Direct Input',
          fileSize: raw_text.length,
          rawText: raw_text,
        },
      });
      novelSourceId = source.id;
    }

    // 创建 CE06 异步任务
    const job = await this.jobService.createCECoreJob({
      jobType: JobType.CE06_NOVEL_PARSING,
      projectId,
      organizationId,
      traceId,
      payload: {
        raw_text,
        projectId,
        novelSourceId,
        parser_config: context?.parser_config || {},
        engineKey: 'ce06_novel_parsing',
      },
    });

    return {
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }
}
