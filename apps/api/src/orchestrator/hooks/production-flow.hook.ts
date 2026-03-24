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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Production Flow Hook
 *
 * Responsibilities:
 * - Listen for SHOT_RENDER completion.
 * - Aggregate shots and trigger PIPELINE_TIMELINE_COMPOSE.
 * - Listen for TIMELINE_COMPOSE completion and trigger TIMELINE_RENDER.
 * - Ensure PublishedVideo creation.
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
      // CE10 handles asset generation, VIDEO_RENDER handles PublishedVideo usually.
      // If TIMELINE_RENDER is used, we might need to trigger CE09 or Publish.
      // But let's focus on the chain: Shot -> Compose -> Render.
      // Timeline Render Processor logic already touches Asset.
      // But Runner waits for PublishedVideo. VIDEO_RENDER creates PublishedVideo.
      // TIMELINE_RENDER does NOT create PublishedVideo.

      // This suggests we should use VIDEO_RENDER instead of TIMELINE_RENDER if we want PublishedVideo.
      // Or trigger CE09 which triggers Publish.
      await this.handleTimelineRenderSuccess(evt);
    }
  }

  private async handleShotRenderSuccess(evt: JobEvent) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) return;

    const payload = isRecord(job.payload) ? job.payload : {};
    const pipelineRunId = getStringField(payload, 'pipelineRunId') || getStringField(payload, 'runId');
    const sceneId = job.sceneId;

    if (!pipelineRunId || !sceneId) return;

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
        await this.jobService.createCECoreJob({
          projectId: job.projectId,
          organizationId: job.organizationId,
          jobType: JobType.PIPELINE_TIMELINE_COMPOSE,
          payload: {
            sceneId,
            pipelineRunId,
            projectId: job.projectId,
          },
          traceId: job.traceId ?? undefined,
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
    if (!job) return;
    const payload = isRecord(job.payload) ? job.payload : {};
    const result = isRecord(job.result) ? job.result : {};
    const resultOutput = isRecord(result.output) ? result.output : undefined;
    const pipelineRunId = getStringField(payload, 'pipelineRunId');
    const sceneId = getStringField(payload, 'sceneId');
    const timelineStorageKey = resultOutput ? getStringField(resultOutput, 'timelineStorageKey') : undefined;

    if (!pipelineRunId || !timelineStorageKey) return;

    // Trigger TIMELINE_RENDER (or VIDEO_RENDER)
    // To get PublishedVideo, VIDEO_RENDER is preferred if it supports "pipelineRunId" aggregation.
    // BUT VIDEO_RENDER in Step 9088 logic aggregates based on SHOT_RENDER jobs.
    // It ignores timeline.json?
    // Step 9088: `if (pipelineRunId && frameKeys.length === 0) { ... Aggregating frames ... }`
    // It creates Concat of frames. It does NOT do the complex Timeline Compose logic (fade, ducking) which is in TIMELINE_RENDER.

    // So we want TIMELINE_RENDER for quality, but VIDEO_RENDER for PublishedVideo?
    // TIMELINE_RENDER creates Asset(VIDEO).
    // We can add a step to Publish that Asset.

    // Let's us TIMELINE_RENDER as it respects the timeline.json produced by Compose.
    const dedupeKey = `render_${pipelineRunId}_${sceneId}`;
    try {
      await this.jobService.createCECoreJob({
        projectId: job.projectId,
        organizationId: job.organizationId,
        jobType: JobType.TIMELINE_RENDER,
        payload: {
          sceneId,
          pipelineRunId,
          timelineStorageKey,
          projectId: job.projectId,
          publish: true, // We can add this param to timeline-render logic?
        },
        traceId: job.traceId ?? undefined,
        dedupeKey,
      });
      this.logger.log(`[ProductionFlow] Triggered TIMELINE_RENDER for ${dedupeKey}`);
    } catch (e: unknown) {
      // ignore dupes
    }
  }

  private async handleTimelineRenderSuccess(evt: JobEvent) {
    // If TIMELINE_RENDER succeeded, we have an Asset(VIDEO).
    // We need to create specific "PublishedVideo" record for the Runner to pass.

    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) return;

    const payload = isRecord(job.payload) ? job.payload : {};
    const publish = (payload.publish === true);
    if (publish) {
      // Manually create PublishedVideo if not created.
      // TIMELINE_RENDER processor (Step 9089) does NOT seem to look at `publish` param.
      // VIDEO_RENDER processor (Step 9088) DOES.

      // We should ideally use a PUBLISH job.
      // Or we can just insert it here directly as a quick fix for the Hook.
      // Using raw SQL to ensure bypass of constraints if needed, relying on Asset ID.

      const result = isRecord(job.result) ? job.result : {};
      const assetId = getStringField(result, 'assetId');
      const storageKey = getStringField(result, 'storageKey');
      const sceneId = getStringField(payload, 'sceneId');
      const pipelineRunId = getStringField(payload, 'pipelineRunId');

      if (assetId && storageKey && sceneId) {
        const project = await this.prisma.project.findUnique({ where: { id: job.projectId } });
        // Find episode?
        const scene = await this.prisma.scene.findUnique({
          where: { id: sceneId },
          include: { episode: true },
        });
        const episodeId = scene?.episodeId;

        if (episodeId) {
          const dedupeKey = `pub_${pipelineRunId}`;
          // Insert PublishedVideo
          // Use assetId as unique key per schema
          await this.prisma.publishedVideo.upsert({
            where: { assetId },
            create: {
              projectId: job.projectId,
              episodeId,
              assetId,
              storageKey,
              checksum: 'auto-generated',
              status: 'PUBLISHED',
              metadata: {
                pipelineRunId: getStringField(payload, 'pipelineRunId'),
                source: 'ProductionFlowHook',
                dedupeKey,
              },
            },
            update: {
              storageKey,
              status: 'PUBLISHED',
              updatedAt: new Date(),
            },
          });
            this.logger.log(
            `[ProductionFlow] Created PublishedVideo for assetId=${assetId}, pipelineRunId=${pipelineRunId}`
          );
        }
      }
    }

    if (!publish) {
      this.logger.warn(`[CE09_FANOUT_SKIPPED] reason=publish_false jobId=${job.id}`);
      return true;
    }

    const result = isRecord(job.result) ? job.result : {};
    const assetId = getStringField(result, 'assetId');
    if (!assetId) {
      this.logger.warn(`[CE09_FANOUT_SKIPPED] reason=missing_asset_id jobId=${job.id}`);
      return true;
    }

    const pipelineRunId = getStringField(payload, 'pipelineRunId') || job.id;
    const ce09DedupeKey = `ce09_${pipelineRunId}_${assetId}`;
    const videoPath = getStringField(result, 'storageKey');
    this.logger.log(
      `[CE09_FANOUT_ELIGIBLE] jobId=${job.id} assetId=${assetId} videoPath=${videoPath} pipelineRunId=${pipelineRunId}`
    );

    await this.jobService.createCECoreJob({
      projectId: job.projectId,
      organizationId: job.organizationId,
      taskId: job.taskId ?? undefined,
      jobType: JobType.CE09_MEDIA_SECURITY,
      traceId: job.traceId ?? undefined,
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
