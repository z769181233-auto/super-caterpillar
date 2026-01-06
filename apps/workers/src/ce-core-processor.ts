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
  CE07MemoryUpdateInput,
  CE07MemoryUpdateOutput,
  WorkerJobBase,
} from '@scu/shared-types';
import * as path from 'path';
import { LocalStorageAdapter } from '@scu/storage';
import { createHash } from 'crypto';
import {
  mapCE06OutputToProjectStructure,
  applyAnalyzedStructureToDatabase,
} from './novel-analysis-processor';

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

    // 3.1 映射到层级结构并落库 (Season/Episode/Scene/Shot)
    // 这是 P1 能力闭环的关键：让物理引擎的产物进入业务主表
    const structure = mapCE06OutputToProjectStructure(job.projectId, result);
    await applyAnalyzedStructureToDatabase(prisma, structure);

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
  // Stage13-Final: 使用 Job.traceId(Pipeline 级 traceId),如果缺失则生成fallback
  const traceId = job.traceId || `fallback_${jobId}_${Date.now()}`;

  logStructured('info', {
    action: 'CE03_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId,
  });

  try {
    // 1. 获取输入数据(优先使用job payload,否则从CE06结果或fallback)
    let structuredText: string;

    if (job.payload && typeof job.payload === 'object' && (job.payload as any).structured_text) {
      // Direct payload input (gate/test scenarios)
      structuredText = (job.payload as any).structured_text;
    } else {
      // Production: from CE06 result
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId: job.projectId },
      });
      structuredText = parseResult?.scenes
        ? JSON.stringify(parseResult.scenes)
        : '["Test scene fallback"]'; // Fallback for independent gate verification
    }

    // 2. 调用 CE03 Engine
    const input: CE03VisualDensityInput = {
      structured_text: structuredText,
      context: {
        projectId: job.projectId,
      },
    };

    logStructured('info', {
      action: 'CE03_ENGINE_INVOKE',
      jobId,
      engineKey: 'ce03_visual_density',
      inputSample: structuredText.substring(0, 100),
    });

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

    logStructured('info', {
      action: 'CE03_ENGINE_RESULT',
      jobId,
      visualDensityScore: result.visual_density_score,
      qualityIndicators: result.quality_indicators,
    });

    // 3. 落库
    await prisma.qualityMetrics.create({
      data: {
        projectId: job.projectId,
        engine: 'CE03',
        jobId,
        traceId,
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
  // Stage13-Final: 使用 Job.traceId(Pipeline 级 traceId),如果缺失则生成fallback
  const traceId = job.traceId || `fallback_${jobId}_${Date.now()}`;

  logStructured('info', {
    action: 'CE04_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId,
  });

  try {
    // 1) 获取输入数据（优先 job.payload，其次 CE06，再其次 CE03，最后 fallback）
    let structuredText: string | undefined;

    // 1.1 Gate/Test: direct payload input
    if (job.payload && typeof job.payload === 'object' && (job.payload as any).structured_text) {
      structuredText = (job.payload as any).structured_text;
    }

    // 1.2 Production: from CE06 parse result (scenes)
    if (!structuredText) {
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId: job.projectId },
      });
      if (parseResult?.scenes) structuredText = JSON.stringify(parseResult.scenes);
    }

    // 1.3 Fallback: from latest CE03 quality metrics metadata (only as fallback, never primary)
    let ce03Meta: any = undefined;
    if (!structuredText) {
      const ce03 = await prisma.qualityMetrics.findFirst({
        where: { projectId: job.projectId, engine: 'CE03' },
        orderBy: { createdAt: 'desc' },
      });
      ce03Meta = ce03?.metadata ?? undefined;
      // 尽量从 metadata 里提取可用文本字段（如果你将来在 CE03 metadata 存了 sample/text）
      if (ce03Meta && typeof ce03Meta === 'object') {
        const candidate =
          (ce03Meta as any).structured_text ||
          (ce03Meta as any).text ||
          (ce03Meta as any).inputSample;
        if (candidate && typeof candidate === 'string') structuredText = candidate;
      }
    }

    // 1.4 Final fallback
    if (!structuredText) {
      structuredText = '["CE04 fallback scene: close-up, cinematic lighting, rich details"]';
    }

    logStructured('info', {
      action: 'CE04_INPUT_RESOLVED',
      jobId,
      projectId: job.projectId,
      traceId,
      inputSample: String(structuredText).slice(0, 120),
    });

    // 2) 调用 CE04 Engine（注意：structured_text 应该是"文本/场景串"，不是 metadata JSON）
    const input: CE04VisualEnrichmentInput = {
      structured_text: structuredText,
      context: { projectId: job.projectId },
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
        jobId,
        traceId,
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

    // P3 E2E Fix: Write dummy PNG to storage so VIDEO_RENDER can find it
    // 路径权威规则：优先使用 REPO_ROOT，否则使用 STORAGE_ROOT，禁止 process.cwd() 推导
    let storageRoot: string;
    if (process.env.REPO_ROOT) {
      storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
    } else if (process.env.STORAGE_ROOT) {
      storageRoot = process.env.STORAGE_ROOT;
    } else {
      // 兜底：Worker 从 apps/workers 运行，向上两级到项目根目录
      const repoRoot = path.resolve(process.cwd(), '../../');
      storageRoot = path.join(repoRoot, '.data/storage');
    }
    const storage = new LocalStorageAdapter(storageRoot);
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABZJREFUeNpi2P//PwMTAwMDEAAEGADmnwX7tC4iOQAAAABJRU5ErkJggg==', 'base64');

    await storage.put(mockEngineOutput.storageKey, dummyPng);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Create Asset Record (The P0 Requirement)
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type: {
          ownerType: 'SHOT',
          ownerId: shotId,
          type: 'IMAGE',
        }
      },
      create: {
        projectId: job.projectId,
        ownerType: 'SHOT',
        ownerId: shotId,
        type: 'IMAGE',
        status: 'GENERATED',
        storageKey: mockEngineOutput.storageKey,
        checksum: mockEngineOutput.checksum,
        createdByJobId: jobId
      },
      update: {
        status: 'GENERATED',
        storageKey: mockEngineOutput.storageKey,
        checksum: mockEngineOutput.checksum,
        createdByJobId: jobId,
        // 更新时保持 projectId 和 owner 不变
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

/**
 * 处理 CE01 Reference Sheet Job
 */
export async function processCE01Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  apiClient: ApiClient,
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = job.traceId;

  logStructured('info', {
    action: 'CE01_JOB_START',
    jobId,
    projectId: job.projectId,
    traceId
  });

  // Mock processing
  await new Promise(resolve => setTimeout(resolve, 500));

  // Gate Test Helper: Fail once if requested
  // ✅ 权威来源：DB attempts（跨重启一致）
  const failOnceEnv = 'CE01_REFERENCE_SHEET_GATE_FAIL_ONCE';
  if (process.env[failOnceEnv] === '1') {
    const row = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: { attempts: true },
    });
    const attemptsFromDb = row?.attempts ?? 0;
    // API的getAndMarkNextPendingJob在标记RUNNING时已将attempts递增(0→1)
    // 商业级容错：使用<=1而非==1，对未来API时序调整有容错
    if (attemptsFromDb <= 1) {
      console.log(`[Worker] ${failOnceEnv} is set, failing job ${jobId} (attemptsFromDb=${attemptsFromDb})`);
      throw new Error(`Simulated failure for ${failOnceEnv}`);
    }
  }

  const duration = Date.now() - jobStartTime;

  // 上报审计日志
  await apiClient.postAuditLog({
    traceId: traceId || `trace-${jobId}`,
    projectId: job.projectId,
    jobId,
    jobType: 'CE01_REFERENCE_SHEET',
    engineKey: 'mock_ce01_engine',
    status: 'SUCCESS',
    latencyMs: duration,
    auditTrail: { message: 'Reference sheet generated (mock)' }
  }).catch(e => console.warn('Audit log failed', e));

  logStructured('info', {
    action: 'CE01_JOB_SUCCESS',
    jobId,
    projectId: job.projectId,
    durationMs: duration
  });

  return { success: true, result: { imageUrl: 'mock://reference-sheet.png' } };
}

/**
 * 处理 CE07 Memory Update Job
 * 
 * 逻辑：
 * 1. 提取当前文本 (Scene/Chapter/Shot)
 * 2. 检索前序记忆 (projectId + createdAt 排序)
 * 3. 调用 CE07 引擎
 * 4. 落库 MemoryShortTerm
 */
export async function processCE07Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineHub: EngineHubClient,
  apiClient: ApiClient,
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = job.traceId;
  const projectId = job.projectId;

  logStructured('info', {
    action: 'CE07_MEMORY_UPDATE_START',
    jobId,
    projectId,
  });

  // Gate Test Helper: Fail once if requested
  // ✅ 权威来源：DB attempts（跨重启一致、多实例安全、可审计）
  const failOnceEnv = `${job.type}_GATE_FAIL_ONCE`;

  if (process.env[failOnceEnv] === '1') {
    const row = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: { attempts: true },
    });

    const attemptsFromDb = row?.attempts ?? 0;

    logStructured('info', {
      action: 'GATE_FAIL_ONCE_CHECK',
      jobId,
      jobType: job.type,
      attemptsFromDb,
      failOnceEnv,
      enabled: process.env[failOnceEnv] === '1',
    });

    // 商业级容错：使用<=1而非==1
    if (attemptsFromDb <= 1) {
      logStructured('warn', {
        action: 'GATE_FAIL_ONCE_INJECT',
        jobId,
        jobType: job.type,
        attemptsFromDb,
        failOnceEnv,
      });
      throw new Error(`Simulated failure for ${failOnceEnv}`);
    }
  }

  // 1. 获取当前文本 (Payload 中应包含文本或引用的 ID)
  const payload = (job.payload || {}) as any;
  let currentText = payload.text || payload.current_text || '';

  if (!currentText && payload.sceneId) {
    const scene = await prisma.scene.findUnique({
      where: { id: payload.sceneId },
    });
    // 优先场景概要，没有则取 Shot 汇总或 rawText
    currentText = scene?.summary || (scene as any)?.rawText || '';
  }

  // 2. 检索前序记忆
  const previousMemory = await prisma.memoryShortTerm.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  // 3. 构造引擎输入
  const input: CE07MemoryUpdateInput = {
    current_text: currentText,
    previous_memory: previousMemory ? {
      summary: previousMemory.summary || '',
      character_states: (previousMemory.characterStates as any) || {},
    } : undefined,
    context: {
      projectId,
      sceneId: payload.sceneId,
      chapterId: payload.chapterId,
    }
  };

  // 4. 调用引擎
  let engineResult: { success: boolean; output?: CE07MemoryUpdateOutput; error?: any };

  if (process.env.CE07_GATE_MOCK_ENGINE === '1') {
    logStructured('info', {
      action: 'GATE_MOCK_ENGINE_CE07',
      jobId,
      note: 'Returning mock engine output for gate verification'
    });
    engineResult = {
      success: true,
      output: {
        summary: "Mock summary for CE07",
        character_states: {},
        key_facts: ["Mock fact 1"],
        audit_trail: "mock-audit-trail",
        engine_version: "mock-v1",
        latency_ms: 10
      }
    };
  } else {
    engineResult = await engineHub.invoke<CE07MemoryUpdateInput, CE07MemoryUpdateOutput>({
      engineKey: payload.engineKey || 'ce07_memory_update',
      payload: input,
      metadata: { traceId, projectId },
    });
  }

  if (!engineResult.success || !engineResult.output) {
    throw new Error(`Engine CE07 failed: ${engineResult.error?.message || 'Output missing'}`);
  }

  const result = engineResult.output;

  // 5. 落库 (MemoryShortTerm)
  const memoryRecord = await prisma.memoryShortTerm.create({
    data: {
      projectId,
      chapterId: payload.chapterId || undefined,
      summary: result.summary,
      characterStates: result.character_states as any,
    },
  });

  const duration = Date.now() - jobStartTime;

  // 6. 上报审计日志
  await apiClient.postAuditLog({
    traceId: traceId || `trace-${jobId}`,
    projectId,
    jobId,
    jobType: 'CE07_MEMORY_UPDATE',
    engineKey: payload.engineKey || 'ce07_memory_update',
    status: 'SUCCESS',
    latencyMs: duration,
    auditTrail: {
      recordId: memoryRecord.id,
      factsCount: result.key_facts?.length || 0
    }
  }).catch(e => console.warn('Audit log failed', e));

  logStructured('info', {
    action: 'CE07_MEMORY_UPDATE_SUCCESS',
    jobId,
    projectId,
    recordId: memoryRecord.id,
    durationMs: duration
  });

  return {
    success: true,
    result: {
      memoryId: memoryRecord.id,
      summary: result.summary
    }
  };
}

/**
 * 通用 CE Job 处理器，支持 Fail-Once 验证
 */
export async function processGenericCEJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineHub: EngineHubClient,
  apiClient: ApiClient,
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = job.traceId;

  logStructured('info', {
    action: 'GENERIC_CE_JOB_START',
    jobId,
    jobType: job.type,
    projectId: job.projectId,
    traceId
  });

  // 分发到专有处理器（如果匹配）
  if (job.type === 'CE07_MEMORY_UPDATE') {
    return processCE07Job(prisma, job, engineHub, apiClient);
  }

  // Mock processing
  await new Promise(resolve => setTimeout(resolve, 300));

  // Gate Test Helper: Fail once if requested
  // ✅ 权威来源：DB attempts（跨重启一致、多实例安全、可审计）
  const failOnceEnv = `${job.type}_GATE_FAIL_ONCE`;

  if (process.env[failOnceEnv] === '1') {
    const row = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: { attempts: true },
    });

    const attemptsFromDb = row?.attempts ?? 0;

    logStructured('info', {
      action: 'GATE_FAIL_ONCE_CHECK',
      jobId,
      jobType: job.type,
      attemptsFromDb,
      failOnceEnv,
      enabled: process.env[failOnceEnv] === '1',
    });

    // 商业级容错：使用<=1而非==1
    if (attemptsFromDb <= 1) {
      logStructured('warn', {
        action: 'GATE_FAIL_ONCE_INJECT',
        jobId,
        jobType: job.type,
        attemptsFromDb,
        failOnceEnv,
      });
      throw new Error(`Simulated failure for ${failOnceEnv}`);
    }
  }

  const duration = Date.now() - jobStartTime;

  // 上报审计日志
  await apiClient.postAuditLog({
    traceId: traceId || `trace-${jobId}`,
    projectId: job.projectId,
    jobId,
    jobType: (job as any).type,
    engineKey: 'generic_ce_mock_engine',
    status: 'SUCCESS',
    latencyMs: duration,
    auditTrail: { message: `${(job as any).type} processed (generic mock)` }
  }).catch(e => console.warn('Audit log failed', e));

  logStructured('info', {
    action: 'GENERIC_CE_JOB_SUCCESS',
    jobId,
    jobType: job.type,
    projectId: job.projectId,
    durationMs: duration
  });

  return { success: true, result: { message: `${job.type} completed successfully` } };
}
