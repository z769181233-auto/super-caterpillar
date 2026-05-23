import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import {
  Controller,
  Post,
  Body,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Param,
  Get,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { JobService } from '../job/job.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobType } from 'database';
import { AssetReceiptResolverService } from './asset-receipt-resolver.service';

class RenderShotBodyDto {
  @IsString()
  reference_sheet_id!: string;

  @IsOptional()
  @IsString()
  organization_id?: string;

  @IsOptional()
  @IsString()
  trace_id?: string;

  @IsOptional()
  @IsString()
  dedupe_key?: string;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsObject()
  engine_config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  is_verification?: boolean;
}

@Controller('v3/shot')
export class ContractShotController {
  private readonly logger = new Logger(ContractShotController.name);

  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService,
    private readonly assetResolver: AssetReceiptResolverService
  ) {}

  private emptyReceipt(errorCode: string) {
    return {
      asset_id: null,
      hls_url: null,
      mp4_url: null,
      checksum: null,
      storage_key: null,
      duration_sec: null,
      fallback_reason: null,
      error_code: errorCode,
    };
  }

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
    const traceId = randomUUID();

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
      trace_id: job.traceId ?? traceId,
    };
  }

  @Post(':id/render')
  async renderShot(@Param('id') id: string, @Body() body: RenderShotBodyDto) {
    const shot = await this.prisma.shot.findUnique({
      where: { id },
      include: {
        scene: {
          include: {
            episode: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });
    if (!shot) throw new NotFoundException('Shot not found');

    const scene = shot.scene;
    const episode = scene?.episode;
    const project = episode?.project;
    if (!scene || !episode || !project) {
      throw new NotFoundException('Shot hierarchy is incomplete');
    }

    const orgId = body.organization_id || project.organizationId;
    const traceId = body.trace_id || randomUUID();

    const job = await this.jobService.create(
      shot.id,
      {
        type: JobType.SHOT_RENDER,
        payload: {
          shotId: shot.id,
          sceneId: scene.id,
          episodeId: episode.id,
          projectId: project.id,
          organizationId: orgId,
          referenceSheetId: body.reference_sheet_id,
          engine: body.engine,
          engineConfig: body.engine_config ?? {},
          traceId,
        },
        engine: body.engine,
        engineConfig: body.engine_config ?? {},
        traceId,
        dedupeKey: body.dedupe_key,
        isVerification: body.is_verification,
      },
      project.ownerId,
      orgId
    );

    return {
      shot_id: shot.id,
      job_id: job.id,
      status: 'QUEUED',
      render_status: 'QUEUED',
      trace_id: job.traceId ?? traceId,
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

    if (jobType === 'CE11_SHOT_GENERATOR') currentStep = v3Status === 'SUCCEEDED' ? 'SHOT_PERSIST' : 'CE11_SHOT_GEN';
    if (jobType === 'SHOT_RENDER') currentStep = v3Status === 'SUCCEEDED' ? 'SHOT_PERSIST' : 'SHOT_RENDER';
    if (jobType === 'VIDEO_RENDER') currentStep = v3Status === 'SUCCEEDED' ? 'PUBLISH_HLS' : 'VIDEO_MERGE';

    // 3. Result Preview (Unified stable set)
    const scenesCount = await this.prisma.scene.count({ where: { projectId: job.projectId } });
    const shotsCount = await this.prisma.shot.count({
      where: {
        scene: {
          projectId: job.projectId,
        },
      },
    });
    const costLedgerCount = await this.prisma.billingLedger.count({
      where: { jobId: job.id },
    });

    let resultPreview = null;
    if (v3Status === 'SUCCEEDED') {
      const assetReceipt = job.traceId
        ? await this.assetResolver.resolveAsset({
            projectId: job.projectId,
            traceId: job.traceId,
            jobId: job.id,
            jobCreatedAt: job.createdAt,
          })
        : this.emptyReceipt('ERR_TRACE_ID_MISSING');
      resultPreview = {
        ...assetReceipt,
        scenes_count: scenesCount,
        shots_count: shotsCount,
        cost_ledger_count: costLedgerCount,
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
        cost_ledger_count: costLedgerCount,
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
