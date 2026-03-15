import {
  Controller,
  Post,
  Body,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Param,
  Get,
} from '@nestjs/common';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobType } from 'database';
import { AssetReceiptResolverService } from './asset-receipt-resolver.service';

@Controller('v3/shot')
export class ContractShotController {
  private readonly logger = new Logger(ContractShotController.name);

  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService,
    private readonly assetResolver: AssetReceiptResolverService
  ) {}

  @Post('batch-generate')
  async batchGenerate(
    @Body() body: { scene_id: string; organization_id?: string; project_id?: string }
  ) {
    this.logger.log(`[V3] batchGenerate called for scene ${body.scene_id}`);
    // V3: scene_id required.

    // 1. Validate Scene
    const scene = await this.prisma.scene.findUnique({
      where: { id: body.scene_id },
    });
    if (!scene) throw new NotFoundException('Scene not found');

    const projectId = body.project_id || scene.projectId;
    if (!projectId) throw new NotFoundException('Project context missing');

    // Lookup project to get OrgId
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const orgId = body.organization_id || project.organizationId;
    const traceId = `v3_bg_${scene.id}_${Date.now()}`;

    // 2. Trigger Real CE11 Batch Job
    // Using JobService.createCECoreJob as it supports payload construction nicely
    // and delegates to ShotJob creation.
    // JobType: CE11_SHOT_GENERATOR (Must match Enum)

    const job = await this.jobService.createCECoreJob({
      projectId: project.id,
      organizationId: orgId,
      jobType: JobType.CE11_SHOT_GENERATOR,
      payload: {
        sceneId: scene.id,
        novelSceneId: scene.id, // Support processor flexibility
        engineKey: 'ce11_shot_generator_real',
        traceId,
      },
      traceId,
    });

    return {
      job_id: job.id,
      status: 'QUEUED',
      trace_id: job.traceId || traceId,
    };
  }

  @Post(':id/render')
  async renderShot(@Param('id') id: string) {
    const shot = await this.prisma.shot.findUnique({ where: { id } });
    if (!shot) throw new NotFoundException('Shot not found');

    // TODO: Trigger Shot Render Job
    return {
      id: shot.id,
      render_status: 'PENDING',
    };
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

    // 2. Map Progress & Step
    const jobType = job.type as string;
    let currentStep = 'CE11_SHOT_GEN';
    let progress = 0;

    if (v3Status === 'RUNNING') progress = 50;
    if (v3Status === 'SUCCEEDED') progress = 100;

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
