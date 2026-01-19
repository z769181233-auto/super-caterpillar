import { JobType, PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { ProcessorContext } from '../types/processor-context';
import { CostLedgerService } from '../billing/cost-ledger.service';

/**
 * CE02 Visual Density Processor (Facade over CE03 core)
 * 遵循 Bible V3.0 协议：
 * Input: { "text": string }
 * Output: { "score": number, "breakdown": object, "verdict": string }
 */
export async function processCE02VisualDensityJob(
  context: ProcessorContext
): Promise<{ status: string; output?: any; error?: any }> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const engineHub = new EngineHubClient(apiClient);

  try {
    const payload = job.payload || {};
    const text = payload.text || payload.structured_text || '';
    const traceId = payload.traceId || job.id;
    const projectId = job.projectId || payload.projectId || 'unknown-project';

    if (!text) {
      throw new Error('Missing input text for CE02 Visual Density calculation');
    }

    // 1. 调用现有的 CE03 核心逻辑 (Facade)
    // 内部复用 ce03_visual_density 引擎
    const ce03Result = await engineHub.invoke({
      engineKey: 'ce03_visual_density',
      engineVersion: 'v1.0',
      payload: {
        structured_text: text,
        traceId,
      },
      metadata: { traceId, jobId: job.id },
    });

    if (!ce03Result.success) {
      throw new Error(`Internal CE03 invocation failed: ${ce03Result.error?.message}`);
    }

    const ce03Output = ce03Result.output as any;
    const score = ce03Output.visual_density_score || 0;
    const breakdown = ce03Output.quality_indicators || {};
    const verdict = score > 70 ? 'HIGH_DENSITY' : score > 30 ? 'MEDIUM_DENSITY' : 'LOW_DENSITY';

    // 2. 增量落库 (Red Line: 不改旧字段，只补齐写入)
    // 根据 payload 中的上下文决定落库目标
    const chapterId = payload.chapterId;
    const sceneId = payload.sceneId;

    if (chapterId) {
      await prisma.novelChapter.update({
        where: { id: chapterId },
        data: {
          visualDensityScore: score,
          visualDensityMeta: { breakdown, verdict, updatedAt: new Date().toISOString() },
        } as any, // 避免 TS 类型检查由于 migration 未及时刷新报错
      });
      logger.log(`[CE02] Updated chapter ${chapterId} with score ${score}`);
    }

    if (sceneId) {
      await prisma.scene.update({
        where: { id: sceneId },
        data: {
          visualDensityScore: score,
          visualDensityMeta: { breakdown, verdict, updatedAt: new Date().toISOString() },
        } as any,
      });
      logger.log(`[CE02] Updated scene ${sceneId} with score ${score}`);
    }

    // 3. 计费审计 (0-cost Audit)
    const costService = new CostLedgerService(apiClient, prisma);
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: 'CE02_VISUAL_DENSITY',
      traceId,
      projectId,
      userId: 'system',
      orgId: job.organizationId || 'default-org',
      engineKey: 'ce02_visual_density',
      runId: payload.pipelineRunId as string,
      billingUsage: ce03Output.billing_usage || {
        totalTokens: 0,
        completionTokens: 0,
        promptTokens: 0,
        model: 'ce02-facade-v1',
      },
      cost: 0,
    });

    return {
      status: 'SUCCEEDED',
      output: {
        score,
        breakdown,
        verdict,
        billing_usage: ce03Output.billing_usage || {
          totalTokens: 0,
          model: 'ce02-facade-v1',
          cost: 0,
        },
      },
    };
  } catch (error: any) {
    logger.error(`[CE02] Failed: ${error.message}`);
    return {
      status: 'FAILED',
      error: { message: error.message },
    };
  }
}
