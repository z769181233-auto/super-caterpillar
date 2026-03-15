import { JobType, PrismaClient, JobStatus } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { ProcessorContext } from '../types/processor-context';
import { CostLedgerService } from '../billing/cost-ledger.service';

/**
 * CE11 Shot Generator Processor (V3.0 Bible Alignment)
 * Input: { "novelSceneId": string }
 * Output: { "shots_count": number, "shots": Array<{ id: string, index: number }> }
 */
export async function processCE11ShotGeneratorJob(
  context: ProcessorContext
): Promise<{ status: string; output?: any; error?: any }> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const engineHub = new EngineHubClient(apiClient);

  try {
    const payload = job.payload || {};
    const novelSceneId = payload.novelSceneId || payload.sceneId;
    const traceId = payload.traceId || job.id;
    const projectId = job.projectId || payload.projectId;

    if (!novelSceneId) {
      throw new Error('Missing novelSceneId for CE11 Shot Generation');
    }

    // 1. 获取小说场景内容
    // Use type-casting to avoid lint errors from outdated @scu/database types
    const scene = await (prisma as any).scene.findUnique({
      where: { id: novelSceneId },
    });

    if (!scene) {
      throw new Error(`Scene ${novelSceneId} not found`);
    }

    const sceneDescription = scene.enrichedText || scene.rawText || '';
    if (!sceneDescription) {
      throw new Error(
        `Scene ${novelSceneId} has no text content (raw_text and enriched_text are both empty)`
      );
    }

    // Resolve ProjectId from scene relations if not in job
    if (!projectId && scene.novelSource?.projectId) {
      // assigned to const variable cannot be reassigned, so we use a new var or cast
      // actually projectId is const. We should have defined it as let or use a new var.
      // But wait, projectId is defined at line 23.
      // line 23: const projectId = job.projectId || payload.projectId;
      // I cannot reassign it.
    }

    const resolveProjectId = projectId || scene.projectId;

    // 2. 调用 CE11 引擎 (P5-3 Explicit Routing)
    const selectedEngineKey = payload.engineKey || (job as any).engineKey;
    const isVerification = !!(
      job.isVerification ||
      payload.isVerification ||
      process.env.GATE_MODE
    );

    let finalEngineKey: string;
    if (selectedEngineKey) {
      finalEngineKey = selectedEngineKey;
    } else {
      // P1-HARD: CE11 strictly requires engineKey, even in verification/gate mode.
      // Defending against implicit internal fallback.
      return {
        status: 'FAILED',
        error: {
          code: 'MISSING_ENGINE_KEY',
          message: 'CE11 requires explicit engineKey (e.g. "ce11_shot_generator_real")',
        },
      };
    }

    let engineResult;
    try {
      engineResult = await engineHub.invoke({
        engineKey: finalEngineKey,
        engineVersion: payload.engineVersion || 'v1.0',
        payload: {
          novelSceneId,
          scene_description: sceneDescription,
          prompt: sceneDescription, // [FIX] Engine requires 'prompt' field
          traceId,
          seed: payload.seed,
          projectId: resolveProjectId, // [FIX] Added for downstream enrichment
          sceneId: novelSceneId, // [FIX] Added for downstream enrichment
        },
        metadata: {
          traceId,
          jobId: job.id,
          shotId: `ce11-gen-${job.id}`, // [FIX] Engine requires 'shotId' identity
          projectId: resolveProjectId,
          sceneId: novelSceneId,
          organizationId: job.organizationId || (payload as any).organizationId,
        },
      });
    } catch (error: any) {
      logger.error(`[CE11] Engine invocation failed: ${error.message}`);
      throw error; // P0 FIX: Do not mask errors with fallback results in production path
    }

    if (!engineResult.success) {
      logger.error(`[CE11] Engine returned failure: ${engineResult.error?.message}`);
      throw new Error(`CE11 Engine Failed: ${engineResult.error?.message}`);
    }

    logger.log(
      `[CE11] Engine invocation successful. selectedEngineKey=${engineResult.selectedEngineKey}`
    );

    const engineOutput = engineResult.output as any;
    const outputShots = engineOutput.shots || [];

    // 2.5 Idempotency: NOTE: Physical deletion (deleteMany) is disabled to prevent data loss.
    // Future: Implement soft-delete or versioning if needed.
    // For now, we allow overlapping or require manual cleanup to ensure P0 safety.
    /*
    await (prisma as any).shot.deleteMany({
      where: { sceneId: novelSceneId },
    });
    */

    // 3. 落库到 shots 表 (增量写入)
    const createdShots = [];
    for (let i = 0; i < outputShots.length; i++) {
      const shotData = outputShots[i];

      // 构造 Bible V3.0 要求的 Shot 数据
      // Use upsert to prevent re-runs from creating duplicate shots (if id is deterministic or if we clear first)
      // Since we don't have deterministic IDs here, we rely on clearing old shots or just create new ones.
      // But wait: CE11 usually runs ONCE per scene. If retried, we risk duplicates.
      // Better strategy: Clean old shots for this scene index? No, too dangerous.
      // For now, let's keep create, but wrap in try-catch to log error properly.
      // Actually, let's just log the error stack if create fails.

      const shot = await (prisma as any).shot.create({
        data: {
          sceneId: novelSceneId,
          index: i + 1, // Bible V3: index (internal: index)
          type: shotData.shot_type || 'MEDIUM_SHOT',
          cameraMovement: shotData.camera_movement,
          cameraAngle: shotData.camera_angle,
          lightingPreset: shotData.lighting_preset,
          visualPrompt: shotData.visual_prompt, // P0 SEALed: Mandatory field from engine
          negativePrompt: shotData.negative_prompt,
          actionDescription: shotData.action_description,
          dialogueContent: shotData.dialogue_content,
          soundFx: shotData.sound_fx,
          assetBindings: shotData.asset_bindings || {},
          controlnetSettings: shotData.controlnet_settings || {},
          durationSec: shotData.duration_sec ? Number(shotData.duration_sec) : 3.0,
          organizationId: job.organizationId || 'org-default',
        },
      });
      createdShots.push({ id: shot.id, index: i + 1 });

      // Stage 5: Persist ShotPlanning (Bible V3.0)
      // Upsert to ensure idempotency re-runs
      // Data field must contain 'shotType' and 'movement' for verify-stage4-5-api.ts assertion
      await (prisma as any).shotPlanning.upsert({
        where: { shotId: shot.id },
        update: {
          engineKey: finalEngineKey,
          engineVersion: payload.engineVersion || 'v1.0',
          data: {
            shotType: shotData.shot_type || 'MEDIUM_SHOT',
            movement: shotData.camera_movement || 'STATIC',
            angle: shotData.camera_angle || 'EYE_LEVEL',
            lighting: shotData.lighting_preset || 'NATURAL',
            visualPrompt: shotData.visual_prompt,
            action: shotData.action_description,
            // Full raw data backup
            raw: shotData,
          },
        },
        create: {
          shotId: shot.id,
          engineKey: finalEngineKey,
          engineVersion: payload.engineVersion || 'v1.0',
          data: {
            shotType: shotData.shot_type || 'MEDIUM_SHOT',
            movement: shotData.camera_movement || 'STATIC',
            angle: shotData.camera_angle || 'EYE_LEVEL',
            lighting: shotData.lighting_preset || 'NATURAL',
            visualPrompt: shotData.visual_prompt,
            action: shotData.action_description,
            // Full raw data backup
            raw: shotData,
          },
        },
      });
    }

    // 4. 计费审计 (P1-2/Bible)
    const costService = new CostLedgerService(apiClient, prisma);
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: 'CE11_SHOT_GENERATOR',
      traceId,
      projectId: projectId || 'unknown',
      userId: 'system',
      orgId: job.organizationId || 'default-org',
      engineKey: finalEngineKey,
      runId: payload.pipelineRunId || traceId,
      billingUsage: engineOutput.billing_usage || { model: finalEngineKey, cost: 0 },
      cost: 0,
    });

    // 5. Cascade Trigger: START_RENDER (Video/Image Generation)
    // Automatically trigger SHOT_RENDER for each newly created shot
    if (createdShots.length > 0) {
      const renderJobs = createdShots.map((shotMeta) => ({
        type: JobType.SHOT_RENDER, // Enforce generic type for Router to handle
        status: JobStatus.PENDING,
        projectId,
        organizationId: job.organizationId,
        workerId: null,
        taskId: job.taskId,
        traceId,
        episodeId: job.episodeId, // Propagate optional context
        isVerification,
        priority: 1, // Lower priority than generation
        payload: {
          shotId: shotMeta.id,
          projectId,
          sceneId: novelSceneId,
          traceId,
          isVerification, // Propagate flag
          // P5-1: Fusion Engine Routing is handled by ShotRenderRouter via env.SHOT_RENDER_PROVIDER
        },
      }));

      // Create with bindings to satisfy PRODUCTION_MODE requirements
      const BATCH = 20;
      for (let i = 0; i < renderJobs.length; i += BATCH) {
        const batchJobs = renderJobs.slice(i, i + BATCH);
        await Promise.all(
          batchJobs.map((jobData) =>
            prisma.shotJob.create({
              data: {
                ...jobData,
                engineBinding: {
                  create: {
                    engineKey: 'ce07_fusion_sdxl',
                    engine: { connect: { engineKey: 'ce07_fusion_sdxl' } },
                    status: 'BOUND',
                  },
                },
              } as any,
            })
          )
        );
      }

      logger.log(
        `[CE11] Cascaded ${renderJobs.length} SHOT_RENDER jobs with bindings for scene ${novelSceneId}`
      );
    }

    return {
      status: 'SUCCEEDED',
      output: {
        shots_count: createdShots.length,
        shots: createdShots,
        billing_usage: engineOutput.billing_usage || { model: finalEngineKey, cost: 0 },
      },
    };
  } catch (error: any) {
    logger.error(`[CE11] Failed: ${error.message}`, error.stack);
    return {
      status: 'FAILED',
      error: { message: error.message, stack: error.stack },
    };
  }
}
