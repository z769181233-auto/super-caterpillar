import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JobService } from '../../job/job.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JobType, JobStatus, AssetType } from 'database';

type JsonRecord = Record<string, unknown>;

type JobEvent = {
  id: string;
  type?: string;
};

type TraceableJob = {
  id: string;
  traceId?: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getOutputRecord(source: JsonRecord): JsonRecord | undefined {
  const output = source.output;
  return isRecord(output) ? output : undefined;
}

function requireJobTraceId(job: TraceableJob, contextTag: string): string {
  if (typeof job.traceId === 'string' && job.traceId.length > 0) {
    return job.traceId;
  }
  throw new Error(`[${contextTag}] Missing traceId for job ${job.id}`);
}

/**
 * Production Flow Hook
 *
 * Responsibilities:
 * - Listen for SHOT_RENDER completion.
 * - Aggregate shots and trigger PIPELINE_TIMELINE_COMPOSE.
 * - Listen for TIMELINE_COMPOSE completion and trigger TIMELINE_RENDER.
 * - Fan out CE09 after TIMELINE_RENDER when publish is requested.
 */
@Injectable()
export class ProductionFlowHook {
  private readonly logger = new Logger(ProductionFlowHook.name);

  constructor(
    private readonly jobService: JobService,
    private readonly prisma: PrismaService
  ) {}

  @OnEvent('job.succeeded')
  async handleJobSucceeded(evt: JobEvent) {
    if (evt.type === 'SHOT_RENDER') {
      await this.handleShotRenderSuccess(evt);
    } else if (evt.type === 'PIPELINE_TIMELINE_COMPOSE') {
      await this.handleTimelineComposeSuccess(evt);
    } else if (evt.type === 'TIMELINE_RENDER') {
      await this.handleTimelineRenderSuccess(evt);
    }
  }

  private async handleShotRenderSuccess(evt: JobEvent) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) {
      this.logger.warn(`[ProductionFlow] SHOT_RENDER event for missing job ${evt.id}; skipping.`);
      return;
    }

    const payload = isRecord(job.payload) ? job.payload : {};
    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    const payloadSceneId = getStringField(payload, 'sceneId');
    if (job.sceneId && payloadSceneId && payloadSceneId !== job.sceneId) {
      this.logger.error(
        `[ProductionFlow] SHOT_RENDER ${job.id} sceneId mismatch: job.sceneId=${job.sceneId} payload.sceneId=${payloadSceneId}.`
      );
      return;
    }
    const sceneId = job.sceneId ?? payloadSceneId;

    if (!pipelineRunId) {
      this.logger.error(
        `[ProductionFlow] SHOT_RENDER ${job.id} missing payload.pipelineRunId; refusing compose fanout.`
      );
      return;
    }

    if (!sceneId) {
      this.logger.error(`[ProductionFlow] SHOT_RENDER ${job.id} missing sceneId; refusing compose fanout.`);
      return;
    }

    // Check if this is part of a managed pipeline
    // Simple check: do we have other shots?

    // Count total shots in scene
    const totalShots = await this.prisma.shot.count({ where: { sceneId } });

    // Count succeeded SHOT_RENDER jobs for this pipelineRunId
    // Standardize query
    const finishedJobs = await this.prisma.shotJob.count({
      where: {
        type: 'SHOT_RENDER',
        status: 'SUCCEEDED',
        sceneId,
        payload: {
          path: ['pipelineRunId'],
          equals: pipelineRunId,
        },
      },
    });

    this.logger.log(
      `[ProductionFlow] [${pipelineRunId}] Scene ${sceneId}: ${finishedJobs}/${totalShots} shots rendered.`
    );

    if (finishedJobs >= totalShots) {
      // All shots done! Trigger Compose.
      // Idempotency check via dedupeKey
      const dedupeKey = `compose_${pipelineRunId}_${sceneId}`;

      try {
        const traceId = requireJobTraceId(job, 'ProductionFlow.SHOT_RENDER_TO_COMPOSE');
        await this.jobService.createCECoreJob({
          projectId: job.projectId,
          organizationId: job.organizationId,
          jobType: JobType.PIPELINE_TIMELINE_COMPOSE,
          payload: {
            sceneId,
            pipelineRunId,
            projectId: job.projectId,
          },
          traceId,
          dedupeKey,
        });
        this.logger.log(`[ProductionFlow] Triggered TIMELINE_COMPOSE for ${dedupeKey}`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'unknown error';
        if (!message.includes('Unique constraint')) {
          this.logger.error(`[ProductionFlow] Failed to trigger Compose: ${message}`);
        }
      }
    }
  }

  private async handleTimelineComposeSuccess(evt: JobEvent) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) {
      this.logger.warn(`[ProductionFlow] PIPELINE_TIMELINE_COMPOSE event for missing job ${evt.id}; skipping.`);
      return;
    }
    const payload = isRecord(job.payload) ? job.payload : {};
    const result = isRecord(job.result) ? job.result : {};
    const resultOutput = isRecord(result.output) ? result.output : undefined;
    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    const sceneId = getStringField(payload, 'sceneId');
    const timelineStorageKey = resultOutput ? getStringField(resultOutput, 'timelineStorageKey') : undefined;

    if (!pipelineRunId) {
      this.logger.error(
        `[ProductionFlow] PIPELINE_TIMELINE_COMPOSE ${job.id} missing payload.pipelineRunId; refusing render fanout.`
      );
      return;
    }

    if (!sceneId) {
      this.logger.error(
        `[ProductionFlow] PIPELINE_TIMELINE_COMPOSE ${job.id} missing payload.sceneId; refusing render fanout.`
      );
      return;
    }

    if (!timelineStorageKey) {
      this.logger.error(
        `[ProductionFlow] PIPELINE_TIMELINE_COMPOSE ${job.id} missing timelineStorageKey; refusing render fanout.`
      );
      return;
    }

    // Use TIMELINE_RENDER as the authoritative renderer for composed timeline output.
    // Publish is reconciled later through CE09 instead of direct worker-side publication.
    const dedupeKey = `render_${pipelineRunId}_${sceneId}`;
    try {
      const traceId = requireJobTraceId(job, 'ProductionFlow.TIMELINE_COMPOSE_TO_RENDER');
      await this.jobService.createCECoreJob({
        projectId: job.projectId,
        organizationId: job.organizationId,
        jobType: JobType.TIMELINE_RENDER,
        payload: {
          sceneId,
          pipelineRunId,
          timelineStorageKey,
          projectId: job.projectId,
          publish: true,
        },
        traceId,
        dedupeKey,
      });
      this.logger.log(`[ProductionFlow] Triggered TIMELINE_RENDER for ${dedupeKey}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown error';
      if (!message.includes('Unique constraint')) {
        this.logger.error(`[ProductionFlow] Failed to trigger TIMELINE_RENDER: ${message}`);
      }
    }
  }

  private async handleTimelineRenderSuccess(evt: JobEvent) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) {
      this.logger.warn(`[ProductionFlow] TIMELINE_RENDER event for missing job ${evt.id}; skipping.`);
      return;
    }

    const payload = isRecord(job.payload) ? job.payload : {};
    const publish = (payload.publish === true);

    if (!publish) {
      this.logger.warn(`[CE09_FANOUT_SKIPPED] reason=publish_false jobId=${job.id}`);
      return true;
    }

    const result = isRecord(job.result) ? job.result : {};
    const resultOutput = getOutputRecord(result) ?? {};
    const assetId = getStringField(result, 'assetId') ?? getStringField(resultOutput, 'assetId');
    if (!assetId) {
      this.logger.warn(`[CE09_FANOUT_SKIPPED] reason=missing_asset_id jobId=${job.id}`);
      return true;
    }

    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    if (!pipelineRunId) {
      this.logger.error(
        `[CE09_FANOUT_BLOCKED] TIMELINE_RENDER ${job.id} missing payload.pipelineRunId; refusing CE09 fanout.`
      );
      return true;
    }

    let traceId: string;
    try {
      traceId = requireJobTraceId(job, 'ProductionFlow.TIMELINE_RENDER_TO_CE09');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CE09_FANOUT_BLOCKED] ${message}`);
      return true;
    }

    const ce09DedupeKey = `ce09_${pipelineRunId}_${assetId}`;
    const videoPath =
      getStringField(result, 'storageKey') ?? getStringField(resultOutput, 'storageKey');
    this.logger.log(
      `[CE09_FANOUT_ELIGIBLE] jobId=${job.id} assetId=${assetId} videoPath=${videoPath} pipelineRunId=${pipelineRunId}`
    );

    await this.jobService.createCECoreJob({
      projectId: job.projectId,
      organizationId: job.organizationId,
      taskId: job.taskId ?? undefined,
      jobType: JobType.CE09_MEDIA_SECURITY,
      traceId,
      dedupeKey: ce09DedupeKey,
        payload: {
          projectId: job.projectId,
          sceneId: getStringField(payload, 'sceneId'),
          assetId,
          videoPath,
          pipelineRunId,
          originJobId: job.id,
          engineKey: 'ce09_media_security',
        },
    });

    this.logger.log(`[CE09_FANOUT_ENQUEUED] jobId=${job.id} assetId=${assetId} dedupeKey=${ce09DedupeKey}`);
    return true;
  }
}
