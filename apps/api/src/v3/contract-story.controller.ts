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
      is_verification?: boolean;
    }
  ) {
    this.logger.log(
      `[V3] parseStory called for project ${body.project_id}, is_verification=${body.is_verification}`
    );

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
        customTraceId,
        body.is_verification
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
        task: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // 0. 特殊处理：Shredder 模式聚合进度 (Stage 4 关键优化)
    const taskPayload = job.task?.payload as any;
    const isShredder = taskPayload?.mode === 'SHREDDER';

    let totalChunks = 0;
    let succeededChunks = 0;
    let failedChunks = 0;
    let runningChunks = 0;

    // Stage 5 Stats
    let totalShotJobs = 0;
    let succeededShotJobs = 0;
    let failedShotJobs = 0;

    if (isShredder) {
      const chunkStats = await this.prisma.shotJob.groupBy({
        by: ['status'],
        where: {
          taskId: job.taskId,
          type: 'NOVEL_CHUNK_PARSE',
        },
        _count: true,
      });

      for (const stat of chunkStats) {
        const count = stat._count;
        totalChunks += count;
        if (stat.status === 'SUCCEEDED') succeededChunks += count;
        if (stat.status === 'FAILED') failedChunks += count;
        if (stat.status === 'RUNNING') runningChunks += count;
      }
      const shotGenStats = await this.prisma.shotJob.groupBy({
        by: ['status'],
        where: {
          taskId: job.taskId,
          type: 'CE11_SHOT_GENERATOR',
        },
        _count: true,
      });

      for (const stat of shotGenStats) {
        const count = stat._count;
        totalShotJobs += count;
        if (stat.status === 'SUCCEEDED') succeededShotJobs += count;
        if (stat.status === 'FAILED') failedShotJobs += count;
      }
    }

    // 1. Map Status
    let v3Status = 'QUEUED';
    const status = job.status as string;

    if (isShredder) {
      // Shredder Mode: All Chunks AND All ShotGens must succeed
      const chunksDone = totalChunks > 0 && succeededChunks === totalChunks;
      const shotsDone = totalShotJobs > 0 && succeededShotJobs === totalShotJobs;
      const shotsEmpty = totalShotJobs === 0; // If no shots generated (e.g. empty novel), but chunks done

      if (job.status === 'FAILED' || failedChunks > 0 || failedShotJobs > 0) {
        v3Status = 'FAILED';
      } else if (chunksDone && (shotsDone || shotsEmpty)) {
        if (job.status === 'SUCCEEDED') v3Status = 'SUCCEEDED';
        else v3Status = 'RUNNING'; // Parent verify pending?
      } else {
        v3Status = 'RUNNING';
      }
    } else {
      if (['RUNNING', 'PROCESSING', 'EXECUTING'].includes(status)) v3Status = 'RUNNING';
      if (['SUCCEEDED', 'COMPLETED'].includes(status)) v3Status = 'SUCCEEDED';
      if (status === 'FAILED') v3Status = 'FAILED';
    }

    // 2. Map Progress & Step (P10-2 SSOT)
    const jobType = job.type as string;
    let currentStep = 'CE06_PARSING';
    let progress = 0;

    if (isShredder) {
      if (job.status === 'PENDING' || job.status === 'RUNNING') {
        // Scanning Phase (Root Job)
        currentStep = 'CE06_SCAN';
        progress = 5;
        // If chunks started appearing, switch to parsing view?
        if (totalChunks > 0) {
          currentStep = 'CE06_PARSING';
          // 5% - 50%
          progress = 5 + Math.floor((succeededChunks / totalChunks) * 45);
        }
      } else {
        // Root Scan Done.
        if (succeededChunks < totalChunks) {
          currentStep = 'CE06_PARSING';
          progress = 5 + Math.floor((succeededChunks / totalChunks) * 45);
        } else {
          // Parsing Done. Planning Phase (50% - 100%)
          // totalShotJobs is known now
          if (totalShotJobs > 0) {
            const shotProgress = succeededShotJobs / totalShotJobs;
            if (shotProgress < 1) {
              currentStep = 'CE11_PLANNING';
              progress = 50 + Math.floor(shotProgress * 45);
            } else {
              currentStep = 'CE11_PLANNING'; // Or DONE
              progress = 95; // Almost done
            }
          } else {
            progress = 90; // No shots?
          }
        }
      }

      if (v3Status === 'SUCCEEDED') {
        progress = 100;
        currentStep = 'Done';
      }
    } else {
      if (v3Status === 'RUNNING') progress = 50;
      if (v3Status === 'SUCCEEDED') progress = 100;

      if (jobType === 'NOVEL_SCAN_TOC') currentStep = 'CE06_SCAN';
      if (jobType === 'NOVEL_CHUNK_PARSE' || jobType === 'CE06_NOVEL_PARSING')
        currentStep = 'CE06_PARSING';
      if (jobType === 'CE11_SHOT_GENERATOR') currentStep = 'CE11_SHOT_GEN';
      if (jobType === 'SHOT_RENDER') currentStep = 'SHOT_RENDER';
      if (jobType === 'VIDEO_RENDER') currentStep = 'VIDEO_MERGE';
    }

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
