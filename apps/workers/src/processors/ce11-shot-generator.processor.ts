import { JobType, PrismaClient } from 'database';
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
    const scene = await (prisma as any).novelScene.findUnique({
      where: { id: novelSceneId },
    });

    if (!scene) {
      throw new Error(`Novel scene ${novelSceneId} not found`);
    }

    const sceneDescription = scene.enrichedText || scene.rawText || '';
    if (!sceneDescription) {
      throw new Error(
        `Scene ${novelSceneId} has no text content (raw_text and enriched_text are both empty)`
      );
    }

    // 2. 调用 CE11 引擎 (local mode uses mock)
    const engineResult = await engineHub.invoke({
      engineKey: payload.engine || 'ce11_shot_generator_mock',
      engineVersion: payload.engineVersion || 'v1.0',
      payload: {
        scene_description: sceneDescription,
        traceId,
      },
      metadata: { traceId, jobId: job.id },
    });

    if (!engineResult.success) {
      throw new Error(`CE11 Engine invocation failed: ${engineResult.error?.message}`);
    }

    const engineOutput = engineResult.output as any;
    const outputShots = engineOutput.shots || [];

    // 3. 落库到 shots 表 (增量写入)
    const createdShots = [];
    for (let i = 0; i < outputShots.length; i++) {
      const shotData = outputShots[i];

      // 构造 Bible V3.0 要求的 Shot 数据
      const shot = await (prisma as any).shot.create({
        data: {
          sceneId: novelSceneId,
          index: i + 1, // sequence_no 从 1 开始
          type: shotData.shot_type || 'MEDIUM_SHOT',
          shotType: shotData.shot_type,
          cameraMovement: shotData.camera_movement,
          cameraAngle: shotData.camera_angle,
          lightingPreset: shotData.lighting_preset,
          visualPrompt: shotData.visual_prompt || 'placeholder visual prompt',
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
      createdShots.push({ id: shot.id, index: shot.index });
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
      engineKey: 'ce11_shot_generator',
      runId: payload.pipelineRunId || traceId,
      billingUsage: engineOutput.billing_usage || { model: 'ce11-mock-v1', cost: 0 },
      cost: 0,
    });

    return {
      status: 'SUCCEEDED',
      output: {
        shots_count: createdShots.length,
        shots: createdShots,
        billing_usage: engineOutput.billing_usage || { model: 'ce11-mock-v1', cost: 0 },
      },
    };
  } catch (error: any) {
    logger.error(`[CE11] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: { message: error.message },
    };
  }
}
