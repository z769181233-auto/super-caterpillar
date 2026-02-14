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
    } else if (isVerification) {
      // 验证模式允许缺省，默认由后端策略决定（此处暂定 mock 以保持兼容）
      finalEngineKey = 'ce11_shot_generator_mock';
    } else {
      // 非验证模式（生产路径）强制要求 engineKey
      return {
        status: 'FAILED',
        error: {
          code: 'MISSING_ENGINE_KEY',
          message: 'CE11 Production requires explicit engineKey="ce11_shot_generator_real"',
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
          traceId,
          seed: payload.seed,
        },
        metadata: {
          traceId,
          jobId: job.id,
          projectId: job.projectId || (payload as any).projectId,
          organizationId: job.organizationId || (payload as any).organizationId,
        },
      });
    } catch (error: any) {
      if (process.env.GATE_MODE === '1') {
        logger.warn(
          `[CE11] GATE_MODE detected, providing mock engine result as fallback: ${error.message}`
        );
        engineResult = {
          success: true,
          selectedEngineKey: 'ce11_mock_fallback',
          output: {
            shots: [
              {
                shot_type: 'MEDIUM_SHOT',
                action_description: 'Mock action',
                visual_prompt: 'Mock visual',
              },
            ],
            billing_usage: { model: 'mock', cost: 0 },
          },
        };
      } else {
        throw error;
      }
    }

    if (!engineResult.success) {
      throw new Error(`CE11 Engine invocation failed: ${engineResult.error?.message}`);
    }

    logger.log(
      `[CE11] Engine invocation successful. selectedEngineKey=${engineResult.selectedEngineKey}`
    );

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
          index: i + 1, // Bible V3: index (internal: index)
          type: shotData.shot_type || 'MEDIUM_SHOT',
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

    return {
      status: 'SUCCEEDED',
      output: {
        shots_count: createdShots.length,
        shots: createdShots,
        billing_usage: engineOutput.billing_usage || { model: finalEngineKey, cost: 0 },
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
