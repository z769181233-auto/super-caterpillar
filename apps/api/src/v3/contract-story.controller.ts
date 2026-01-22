import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { StoryService } from '../story/story.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetReceiptResolverService } from './asset-receipt-resolver.service';

@Controller('v3/story')
export class ContractStoryController {
  private readonly logger = new Logger(ContractStoryController.name);

  constructor(
    private readonly storyService: StoryService,
    private readonly prisma: PrismaService,
    private readonly assetResolver: AssetReceiptResolverService
  ) {}

  @Post('parse')
  async parseStory(
    @Body()
    body: {
      project_id: string;
      raw_text?: string;
      title?: string;
      author?: string;
      organization_id?: string;
      trace_id?: string;
      traceId?: string;
    }
  ) {
    this.logger.log(`[V3] parseStory called for project ${body.project_id}`);

    // Lookup Project to get OrgId if not provided
    const project = await this.prisma.project.findUnique({ where: { id: body.project_id } });
    if (!project) {
      this.logger.warn(`[V3] Project not found: ${body.project_id}`);
      throw new NotFoundException('Project not found');
    }

    try {
      const customTraceId = body.trace_id || body.traceId;
      const result = await this.storyService.parseStory(
        {
          projectId: body.project_id,
          rawText: body.raw_text || '',
          title: body.title,
          author: body.author,
        },
        project.ownerId, // userId (owner)
        body.organization_id || project.organizationId, // orgId
        '127.0.0.1', // ip
        'v3-api-client', // ua
        customTraceId
      );

      return {
        job_id: result.jobId,
        status: 'QUEUED', // V3 Status Mapping
        note: 'Async job started',
        trace_id: result.traceId,
      };
    } catch (e: any) {
      this.logger.error(`[V3] parseStory failed: ${e.message}`, e.stack);
      throw new InternalServerErrorException(e.message);
    }
  }

  @Get('job/:job_id')
  async getJob(@Param('job_id') jobId: string) {
    const job = await this.prisma.shotJob.findUnique({
      where: { id: jobId },
      include: {
        project: true,
        generatedAsset: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // 1. Map Status
    let v3Status = 'QUEUED';
    const status = job.status as string;
    if (['RUNNING', 'PROCESSING', 'EXECUTING'].includes(status)) v3Status = 'RUNNING';
    if (['SUCCEEDED', 'COMPLETED'].includes(status)) v3Status = 'SUCCEEDED';
    if (status === 'FAILED') v3Status = 'FAILED';

    // 2. Map Progress & Step (P10-2 SSOT)
    const jobType = job.type as string;
    let currentStep = 'CE06_PARSING';
    let progress = 0;

    if (v3Status === 'RUNNING') progress = 50;
    if (v3Status === 'SUCCEEDED') progress = 100;

    if (jobType === 'NOVEL_SCAN_TOC') currentStep = 'CE06_SCAN';
    if (jobType === 'NOVEL_CHUNK_PARSE' || jobType === 'CE06_NOVEL_PARSING')
      currentStep = 'CE06_PARSING';
    if (jobType === 'CE11_SHOT_GENERATOR') currentStep = 'CE11_SHOT_GEN';
    if (jobType === 'SHOT_RENDER') currentStep = 'SHOT_RENDER';
    if (jobType === 'VIDEO_RENDER') currentStep = 'VIDEO_MERGE';

    // 3. Result Preview (Unified stable set)
    const scenesCount = await this.prisma.scene.count({ where: { projectId: job.projectId } });
    const shotsCount = await this.prisma.shot.count({
      where: {
        scene: {
          projectId: job.projectId,
        },
      },
    });

    let resultPreview = null;
    if (v3Status === 'SUCCEEDED') {
      const assetReceipt = await this.assetResolver.resolveAsset({
        projectId: job.projectId,
        traceId: job.traceId || '',
        jobId: job.id,
        jobCreatedAt: job.createdAt,
      });
      resultPreview = {
        ...assetReceipt,
        scenes_count: scenesCount,
        shots_count: shotsCount,
        cost_ledger_count: 1,
      };
    } else {
      // Maintain stable key set for FAILED/RUNNING
      resultPreview = {
        asset_id: null,
        hls_url: null,
        mp4_url: null,
        checksum: null,
        storage_key: null,
        duration_sec: null,
        fallback_reason: null,
        scenes_count: scenesCount,
        shots_count: shotsCount,
        cost_ledger_count: 0,
        error_code: v3Status === 'FAILED' ? 'JOB_FAILED' : undefined,
      };
    }

    return {
      id: job.id,
      status: v3Status,
      progress: progress,
      current_step: currentStep,
      result_preview: resultPreview,
      error: job.status === 'FAILED' ? { code: 'JOB_FAILED', message: job.lastError } : null,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    };
  }
}
