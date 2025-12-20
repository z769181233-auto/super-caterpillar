/**
 * CE Core Layer Processors (Stage13)
 * Worker 端处理 CE06/CE03/CE04 Job 的处理器
 */

import { PrismaClient } from 'database';
import { EngineHubClient } from './engine-hub-client';
import { ApiClient } from './api-client';
import {
  CE06NovelParsingInput,
  CE06NovelParsingOutput,
  CE03VisualDensityInput,
  CE03VisualDensityOutput,
  CE04VisualEnrichmentInput,
  CE04VisualEnrichmentOutput,
  WorkerJobBase,
} from '@scu/shared-types';
import { createHash } from 'crypto';

/**
 * 结构化日志输出函数
 */
function logStructured(level: 'info' | 'warn' | 'error', data: Record<string, any>): void {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const logMessage = JSON.stringify(logEntry);
  if (level === 'error') {
    console.error(logMessage);
  } else if (level === 'warn') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}

/**
 * 计算输入/输出的哈希值（用于审计）
 */
function hashData(data: any): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
}

/**
 * 处理 CE06 Novel Parsing Job
 */
export async function processCE06Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineClient: EngineHubClient,
  apiClient: ApiClient,
): Promise<CE06NovelParsingOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  // Stage13-Final: 使用 Job.traceId（Pipeline 级 traceId）
  const traceId = job.traceId;
  if (!traceId) {
    throw new Error(`CE06 Job ${jobId} missing traceId`);
  }

  logStructured('info', {
    action: 'CE06_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId,
  });

  try {
    // 1. 获取输入数据
    const novelSource = await prisma.novelSource.findFirst({
      where: { projectId: job.projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!novelSource?.rawText) {
      throw new Error('Novel source not found or rawText is empty');
    }

    // 2. 调用 CE06 Engine
    const input: CE06NovelParsingInput = {
      structured_text: novelSource.rawText,
      context: {
        projectId: job.projectId,
        novelSourceId: novelSource.id,
      },
    };

    const engineResult = await engineClient.invoke<CE06NovelParsingInput, CE06NovelParsingOutput>(
      {
        engineKey: 'ce06_novel_parsing',
        engineVersion: 'default',
        payload: input,
        metadata: {
          jobId,
          projectId: job.projectId,
        },
      },
    );

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE06 engine execution failed');
    }

    const result = engineResult.output;

    // 3. 落库
    await prisma.novelParseResult.upsert({
      where: { projectId: job.projectId },
      create: {
        projectId: job.projectId,
        volumes: result.volumes as any,
        chapters: result.chapters as any,
        scenes: result.scenes as any,
        parsingQuality: result.parsing_quality,
      },
      update: {
        volumes: result.volumes as any,
        chapters: result.chapters as any,
        scenes: result.scenes as any,
        parsingQuality: result.parsing_quality,
      },
    });

    const duration = Date.now() - jobStartTime;

    // 计算 input/output hash
    const inputHash = hashData(input);
    const outputHash = hashData(result);

    // 上报审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE06_NOVEL_PARSING',
        engineKey: 'ce06_novel_parsing',
        status: 'SUCCESS',
        inputHash,
        outputHash,
        latencyMs: duration,
        cost: 0, // 占位，后续接入成本体系
        auditTrail: result.audit_trail || { message: 'missing' },
      });
    } catch (auditError: any) {
      // 审计上报失败不影响主流程
      logStructured('warn', {
        action: 'CE06_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('info', {
      action: 'CE06_JOB_SUCCESS',
      jobId,
      projectId: job.projectId,
      durationMs: duration,
      parsingQuality: result.parsing_quality,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;

    // 上报失败审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE06_NOVEL_PARSING',
        engineKey: 'ce06_novel_parsing',
        status: 'FAILED',
        latencyMs: duration,
        errorMessage: error?.message || 'Unknown error',
      });
    } catch (auditError: any) {
      // 审计上报失败不影响主流程
      logStructured('warn', {
        action: 'CE06_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('error', {
      action: 'CE06_JOB_FAILED',
      jobId,
      projectId: job.projectId,
      error: error?.message || 'Unknown error',
      durationMs: duration,
    });

    throw error;
  }
}

/**
 * 处理 CE03 Visual Density Job
 */
export async function processCE03Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineClient: EngineHubClient,
  apiClient: ApiClient,
): Promise<CE03VisualDensityOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  // Stage13-Final: 使用 Job.traceId（Pipeline 级 traceId）
  const traceId = job.traceId;
  if (!traceId) {
    throw new Error(`CE03 Job ${jobId} missing traceId`);
  }

  logStructured('info', {
    action: 'CE03_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId,
  });

  try {
    // 1. 获取 CE06 结果
    const parseResult = await prisma.novelParseResult.findUnique({
      where: { projectId: job.projectId },
    });

    if (!parseResult) {
      throw new Error('CE06 result not found, CE03 requires CE06 to complete first');
    }

    // 2. 调用 CE03 Engine
    const input: CE03VisualDensityInput = {
      structured_text: JSON.stringify(parseResult.scenes),
      context: {
        projectId: job.projectId,
      },
    };

    const engineResult = await engineClient.invoke<CE03VisualDensityInput, CE03VisualDensityOutput>(
      {
        engineKey: 'ce03_visual_density',
        engineVersion: 'default',
        payload: input,
        metadata: {
          jobId,
          projectId: job.projectId,
        },
      },
    );

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE03 engine execution failed');
    }

    const result = engineResult.output;

    // 3. 落库
    await prisma.qualityMetrics.create({
      data: {
        projectId: job.projectId,
        engine: 'CE03',
        visualDensityScore: result.visual_density_score,
        metadata: result.quality_indicators as any,
      },
    });

    const duration = Date.now() - jobStartTime;

    // 计算 input/output hash
    const inputHash = hashData(input);
    const outputHash = hashData(result);

    // 上报审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE03_VISUAL_DENSITY',
        engineKey: 'ce03_visual_density',
        status: 'SUCCESS',
        inputHash,
        outputHash,
        latencyMs: duration,
        cost: 0,
        auditTrail: result.audit_trail || { message: 'missing' },
      });
    } catch (auditError: any) {
      logStructured('warn', {
        action: 'CE03_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('info', {
      action: 'CE03_JOB_SUCCESS',
      jobId,
      projectId: job.projectId,
      durationMs: duration,
      visualDensityScore: result.visual_density_score,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;

    // 上报失败审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE03_VISUAL_DENSITY',
        engineKey: 'ce03_visual_density',
        status: 'FAILED',
        latencyMs: duration,
        errorMessage: error?.message || 'Unknown error',
      });
    } catch (auditError: any) {
      logStructured('warn', {
        action: 'CE03_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('error', {
      action: 'CE03_JOB_FAILED',
      jobId,
      projectId: job.projectId,
      error: error?.message || 'Unknown error',
      durationMs: duration,
    });

    throw error;
  }
}

/**
 * 处理 CE04 Visual Enrichment Job
 */
export async function processCE04Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineClient: EngineHubClient,
  apiClient: ApiClient,
): Promise<CE04VisualEnrichmentOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  // Stage13-Final: 使用 Job.traceId（Pipeline 级 traceId）
  const traceId = job.traceId;
  if (!traceId) {
    throw new Error(`CE04 Job ${jobId} missing traceId`);
  }

  logStructured('info', {
    action: 'CE04_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId,
  });

  try {
    // 1. 获取 CE03 结果
    const qualityMetrics = await prisma.qualityMetrics.findFirst({
      where: {
        projectId: job.projectId,
        engine: 'CE03',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!qualityMetrics) {
      throw new Error('CE03 result not found, CE04 requires CE03 to complete first');
    }

    // 2. 调用 CE04 Engine
    const input: CE04VisualEnrichmentInput = {
      structured_text: JSON.stringify(qualityMetrics.metadata || {}),
      context: {
        projectId: job.projectId,
      },
    };

    const engineResult = await engineClient.invoke<CE04VisualEnrichmentInput, CE04VisualEnrichmentOutput>(
      {
        engineKey: 'ce04_visual_enrichment',
        engineVersion: 'default',
        payload: input,
        metadata: {
          jobId,
          projectId: job.projectId,
        },
      },
    );

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE04 engine execution failed');
    }

    const result = engineResult.output;

    // 3. 落库
    await prisma.qualityMetrics.create({
      data: {
        projectId: job.projectId,
        engine: 'CE04',
        enrichmentQuality: result.enrichment_quality,
        metadata: result.metadata as any,
      },
    });

    const duration = Date.now() - jobStartTime;

    // 计算 input/output hash
    const inputHash = hashData(input);
    const outputHash = hashData(result);

    // 上报审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE04_VISUAL_ENRICHMENT',
        engineKey: 'ce04_visual_enrichment',
        status: 'SUCCESS',
        inputHash,
        outputHash,
        latencyMs: duration,
        cost: 0,
        auditTrail: result.audit_trail || { message: 'missing' },
      });
    } catch (auditError: any) {
      logStructured('warn', {
        action: 'CE04_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('info', {
      action: 'CE04_JOB_SUCCESS',
      jobId,
      projectId: job.projectId,
      durationMs: duration,
      enrichmentQuality: result.enrichment_quality,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - jobStartTime;

    // 上报失败审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId: job.projectId,
        jobId,
        jobType: 'CE04_VISUAL_ENRICHMENT',
        engineKey: 'ce04_visual_enrichment',
        status: 'FAILED',
        latencyMs: duration,
        errorMessage: error?.message || 'Unknown error',
      });
    } catch (auditError: any) {
      logStructured('warn', {
        action: 'CE04_AUDIT_FAILED',
        jobId,
        error: auditError?.message || 'Unknown error',
      });
    }

    logStructured('error', {
      action: 'CE04_JOB_FAILED',
      jobId,
      projectId: job.projectId,
      error: error?.message || 'Unknown error',
      durationMs: duration,
    });

    throw error;
  }
}

// ... (existing code)

/**
 * Stage 4: SHOT_RENDER Job Processor (Asset Generation Loop)
 */
export async function processShotRenderJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineClient: EngineHubClient,
  apiClient: ApiClient,
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = job.traceId || `trace-${jobId}`;
  // @ts-ignore
  const shotId = (job.payload as any).shotId || job['shotId'];

  logStructured('info', {
    action: 'SHOT_RENDER_START',
    jobId,
    projectId: job.projectId,
    shotId,
    traceId
  });

  if (!shotId) {
    throw new Error('SHOT_RENDER job requires shotId');
  }

  try {
    // 1. Simulate Engine Call (Mock for Stage 4 MVP)
    // In real life, would call Stable Diffusion / Midjourney via EngineHub
    const mockEngineOutput = {
      storageKey: `projects/${job.projectId}/shots/${shotId}/render-${Date.now()}.png`,
      checksum: 'mock-checksum-1234567890abcdef',
      width: 1024,
      height: 576,
      format: 'png'
    };

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Create Asset Record (The P0 Requirement)
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        ownerType: 'SHOT',
        ownerId: shotId,
        type: 'IMAGE',
        status: 'GENERATED',
        storageKey: mockEngineOutput.storageKey,
        checksum: mockEngineOutput.checksum,
        createdByJobId: jobId
      }
    });

    // 3. Link Asset to Shot (Optional, but good for completeness if relation exists)
    // Note: The Asset->Shot relation is already handled by ownerId, but if Shot has a "coverAssetId" or similar, update it here.
    // For now, we rely on the Asset table query.

    const duration = Date.now() - jobStartTime;

    // 4. Audit Log
    await apiClient.postAuditLog({
      traceId,
      projectId: job.projectId,
      jobId,
      jobType: 'SHOT_RENDER',
      engineKey: 'mock_renderer',
      status: 'SUCCESS',
      inputHash: hashData(job.payload),
      outputHash: hashData(mockEngineOutput),
      latencyMs: duration,
      cost: 0.05, // Mock cost
      auditTrail: { message: 'Asset generated via mock renderer' },
      resourceId: asset.id,
      resourceType: 'asset'
    }).catch(e => console.warn('Audit failed', e));

    logStructured('info', {
      action: 'SHOT_RENDER_SUCCESS',
      jobId,
      assetId: asset.id,
      durationMs: duration
    });

    return {
      assetId: asset.id,
      secureUrl: `mock://${mockEngineOutput.storageKey}`, // Client will use AssetService to resolve this
      status: 'SUCCESS'
    };

  } catch (error: any) {
    const duration = Date.now() - jobStartTime;
    logStructured('error', {
      action: 'SHOT_RENDER_FAILED',
      jobId,
      error: error.message,
      durationMs: duration
    });
    throw error;
  }
}
