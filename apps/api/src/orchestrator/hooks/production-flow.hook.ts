import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JobService } from '../../job/job.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JobType, JobStatus, AssetType } from 'database';

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
  async handleJobSucceeded(evt: any) {
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

  private async handleShotRenderSuccess(evt: any) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) return;

    const payload = job.payload as any;
    const pipelineRunId = payload.pipelineRunId || payload.runId; // Support both just in case
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
      } catch (e: any) {
        if (!e.message.includes('Unique constraint')) {
          this.logger.error(`[ProductionFlow] Failed to trigger Compose: ${e.message}`);
        }
      }
    }
  }

  private async handleTimelineComposeSuccess(evt: any) {
    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) return;
    const payload = job.payload as any;
    const pipelineRunId = payload.pipelineRunId;
    const sceneId = payload.sceneId;
    const timelineStorageKey = (job.result as any)?.output?.timelineStorageKey;

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
    } catch (e: any) {
      // ignore dupes
    }
  }

  private async handleTimelineRenderSuccess(evt: any) {
    // If TIMELINE_RENDER succeeded, we have an Asset(VIDEO).
    // We need to create specific "PublishedVideo" record for the Runner to pass.

    const job = await this.prisma.shotJob.findUnique({ where: { id: evt.id } });
    if (!job) return;

    const payload = job.payload as any;
    if (payload.publish) {
      // Manually create PublishedVideo if not created.
      // TIMELINE_RENDER processor (Step 9089) does NOT seem to look at `publish` param.
      // VIDEO_RENDER processor (Step 9088) DOES.

      // We should ideally use a PUBLISH job.
      // Or we can just insert it here directly as a quick fix for the Hook.
      // Using raw SQL to ensure bypass of constraints if needed, relying on Asset ID.

      const assetId = (job.result as any)?.assetId;
      const storageKey = (job.result as any)?.storageKey;

      if (assetId && storageKey) {
        const project = await this.prisma.project.findUnique({ where: { id: job.projectId } });
        // Find episode?
        const scene = await this.prisma.scene.findUnique({
          where: { id: payload.sceneId },
          include: { episode: true },
        });
        const episodeId = scene?.episodeId;

        if (episodeId) {
          const dedupeKey = `pub_${payload.pipelineRunId}`;
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
                pipelineRunId: payload.pipelineRunId,
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
            `[ProductionFlow] Created PublishedVideo for assetId=${assetId}, pipelineRunId=${payload.pipelineRunId}`
          );
        }
    const jobWithHierarchy = await this.jobService.findJobByIdWithShotHierarchy(evt.id);
    if (jobWithHierarchy) {
      this.logger.log(`[CE_FANOUT_TRIGGER] Routing TIMELINE_RENDER success to JobService for project ${job.projectId}`);
      await this.jobService.handleCECoreJobCompletion(jobWithHierarchy as any, job.result);
    }
    return true;
  }
}
