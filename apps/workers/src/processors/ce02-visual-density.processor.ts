import { JobType, Prisma, PrismaClient } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { ProcessorContext } from '../types/processor-context';
import { CostLedgerService } from '../billing/cost-ledger.service';

type CE03VisualDensityOutput = {
  visual_density_score?: number;
  quality_indicators?: Record<string, unknown>;
  billing_usage?: {
    totalTokens?: number;
    completionTokens?: number;
    promptTokens?: number;
    model?: string;
  };
};

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
    const projectId = job.projectId || payload.projectId;
    const orgId = job.organizationId;

    if (!text) {
      throw new Error('Missing input text for CE02 Visual Density calculation');
    }
    if (!orgId) {
      throw new Error(`[CE02] Organization ID is required for job ${job.id}`);
    }
    if (!projectId) {
      throw new Error(`[CE02] Project ID is required for job ${job.id}`);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project?.ownerId) {
      throw new Error(`[CE02] Project owner is required for job ${job.id}`);
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

    const ce03Output = ce03Result.output as CE03VisualDensityOutput;
    const score = ce03Output.visual_density_score || 0;
    const breakdown = ce03Output.quality_indicators || {};
    const verdict = score > 70 ? 'HIGH_DENSITY' : score > 30 ? 'MEDIUM_DENSITY' : 'LOW_DENSITY';
    const visualDensityMeta = {
      breakdown,
      verdict,
      updatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;
    const billingUsage = ce03Output.billing_usage
      ? {
          totalTokens: ce03Output.billing_usage.totalTokens ?? 0,
          completionTokens: ce03Output.billing_usage.completionTokens ?? 0,
          promptTokens: ce03Output.billing_usage.promptTokens ?? 0,
          model: ce03Output.billing_usage.model ?? 'ce02-facade-v1',
        }
      : {
          totalTokens: 0,
          completionTokens: 0,
          promptTokens: 0,
          model: 'ce02-facade-v1',
        };

    // 2. 增量落库 (Red Line: 不改旧字段，只补齐写入)
    // 根据 payload 中的上下文决定落库目标
    const chapterId = payload.chapterId;
    const sceneId = payload.sceneId;

    if (chapterId) {
      await prisma.novelChapter.update({
        where: { id: chapterId },
        data: {
          visualDensityScore: score,
          visualDensityMeta,
        },
      });
      logger.log(`[CE02] Updated chapter ${chapterId} with score ${score}`);
    }

    if (sceneId) {
      await prisma.scene.update({
        where: { id: sceneId },
        data: {
          visualDensityScore: score,
          visualDensityMeta,
        },
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
      userId: project.ownerId,
      orgId,
      engineKey: 'ce02_visual_density',
      runId: payload.pipelineRunId as string,
      billingUsage,
      cost: 0,
    });

    return {
      status: 'SUCCEEDED',
      output: {
        score,
        breakdown,
        verdict,
        billing_usage: billingUsage,
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
