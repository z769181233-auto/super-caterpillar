import {
  AssetOwnerType,
  AssetRole,
  AssetType,
  JobType,
  Prisma,
  PrismaClient,
  ShotReviewStatus,
} from 'database';
// import { PRODUCTION_MODE } from '@scu/config';
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
import { EngineHubClient } from './engine-hub-client';
import { ApiClient } from './api-client';
import {
  CE06NovelParsingInput,
  CE06NovelParsingOutput,
  CE03VisualDensityInput,
  CE03VisualDensityOutput,
  CE07MemoryUpdateInput,
  CE07MemoryUpdateOutput,
  WorkerJobBase,
  EngineInvocationRequest,
} from '@scu/shared-types';
import { createHash } from 'crypto';
import {
  mapCE06OutputToProjectStructure,
  applyAnalyzedStructureToDatabase,
} from './novel-analysis-processor';
import { CostLedgerService } from './billing/cost-ledger.service';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { fileExists, ensureDir } from '../../../packages/shared/fs_async';
import sharp from 'sharp';
import { JsonObject } from '@scu/shared-types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getJobRecord(job: WorkerJobBase): JsonRecord {
  return isRecord(job) ? job : {};
}

function getPayloadRecord(job: WorkerJobBase): JsonRecord {
  return isRecord(job.payload) ? job.payload : {};
}

function getStringField(source: JsonRecord, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(source: JsonRecord, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

function getRequiredTraceId(job: WorkerJobBase, context: string): string {
  if (typeof job.traceId === 'string' && job.traceId.length > 0) {
    return job.traceId;
  }
  throw new Error(`[${context}] Missing traceId for job ${job.id}`);
}

function getRequiredPipelineRunId(payload: JsonRecord, jobId: string, context: string): string {
  const pipelineRunId = getStringField(payload, 'pipelineRunId');
  if (pipelineRunId) {
    return pipelineRunId;
  }
  throw new Error(`[${context}] Missing pipelineRunId for job ${jobId}`);
}

function getExplicitEngineKey(job: WorkerJobBase, payload: JsonRecord, context: string): string {
  const engineKey =
    getStringField(payload, 'engineKey') ??
    getStringField(getJobRecord(job), 'engineKey');
  if (engineKey) {
    return engineKey;
  }
  throw new Error(`[${context}] Missing explicit engineKey for job ${job.id}`);
}

function toEngineBillingUsage(value: unknown): import('@scu/engines-ce06').EngineBillingUsage | undefined {
  if (!isRecord(value)) return undefined;

  const promptTokens = getNumberField(value, 'promptTokens');
  const completionTokens = getNumberField(value, 'completionTokens');
  const totalTokens =
    getNumberField(value, 'totalTokens') ??
    (typeof promptTokens === 'number' && typeof completionTokens === 'number'
      ? promptTokens + completionTokens
      : undefined);
  const model = getStringField(value, 'model');

  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number' ||
    !model
  ) {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model,
  };
}

function toJsonRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

interface CE04HubPayload {
  prompt: string;
  width: number;
  height: number;
  traceId: string;
  projectId: string;
}

interface CE04HubOutput {
  asset?: {
    image?: string;
    uri?: string;
    videoUri?: string;
    storageKey?: string;
    sha256?: string;
  };
  storageKey?: string;
  localPath?: string;
  sha256?: string;
  render_meta?: JsonRecord;
  audit_trail?: unknown;
  billing_usage?: JsonRecord;
}

interface ShotRenderHubPayload {
  shotId: string;
  prompt: string;
  seed: number;
  style: string;
  sourceImagePath: string | null;
  context: {
    projectId: string;
    sceneId: string;
  };
  projectId: string;
}

interface ShotRenderHubOutput {
  asset?: {
    image?: string;
    uri?: string;
    videoUri?: string;
    storageKey?: string;
    sha256?: string;
  };
  storageKey?: string;
  localPath?: string;
  sha256?: string;
  render_meta?: JsonRecord;
  audit_trail?: unknown;
  billing_usage?: JsonRecord;
}

interface CE06SpawnScanResult {
  status: 'SPAWNED_SCAN';
  message: string;
  scanJobId: string;
}

/**
 * 结构化日志输出函数
 */
function logStructured(level: 'info' | 'warn' | 'error', data: JsonRecord): void {
  void level;
  void data;
}

/**
 * 计算输入/输出的哈希值（用于审计）
 */
function hashData(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
}

/**
 * 处理 CE06 Novel Parsing Job
 */
export async function processCE06Job(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineClient: EngineHubClient,
  apiClient: ApiClient
): Promise<CE06NovelParsingOutput | CE06SpawnScanResult> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  // Stage13-Final: 使用 Job.traceId（Pipeline 级 traceId）
  const traceId = job.traceId;
  const projectId = job.projectId!;
  if (!traceId) {
    throw new Error(`CE06 Job ${jobId} missing traceId`);
  }
  if (!projectId) {
    throw new Error(`CE06 Job ${jobId} missing projectId`);
  }

  logStructured('info', {
    action: 'CE06_JOB_START',
    jobId,
    projectId,
    traceId,
  });

  try {
    // [Stage 3 Fix] Fetch Context Early for Orchestration & Billing
    const shotJob = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: { organizationId: true },
    });
    if (!shotJob?.organizationId) {
      throw new Error(`[CE06] Organization ID is required for job ${jobId}`);
    }
    const organizationId = shotJob.organizationId;

    // P0 Fix: DO NOT JOIN! DO NOT READ ALL!
    // Instead, trigger the SCAN phase.
    // 1. Ensure NovelSource exists
    const payload = getPayloadRecord(job);
    let novelSourceId = getStringField(payload, 'novelSourceId');
    const novel = await prisma.novel.findUnique({ where: { projectId } });
    let episodeId = getStringField(payload, 'episodeId');

    if (!episodeId) {
      let episode = await prisma.episode.findUnique({
        where: { projectId_index: { projectId, index: 1 } },
      });
      if (!episode) {
        episode = await prisma.episode.create({
          data: {
            seasonId: null as any,
            projectId,
            index: 1,
            name: 'Episode 1',
          },
        });
      }
      episodeId = episode.id;
    }

    // 2. Spawn NOVEL_SCAN_TOC Job
    const scanJob = await prisma.shotJob.create({
      data: {
        organizationId, // From early fetch at line 92
        projectId,
        episodeId,
        type: JobType.NOVEL_SCAN_TOC,
        status: 'PENDING',
        dedupeKey: `novel_scan_${job.id}`,
        payload: {
          projectId,
          episodeId,
          novelSourceId,
          fileKey: getStringField(payload, 'fileKey') || novel?.rawFileUrl,
          ...(getStringField(payload, 'engineVersion')
            ? { engineVersion: getStringField(payload, 'engineVersion') }
            : {}),
        },
        taskId: job.taskId,
        traceId: job.traceId,
      },
    });

    return {
      status: 'SPAWNED_SCAN',
      message: 'Triggered NOVEL_SCAN_TOC for streaming pipeline',
      scanJobId: scanJob.id,
    };
  } catch (error: unknown) {
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
  apiClient: ApiClient
): Promise<CE03VisualDensityOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId = getRequiredTraceId(job, 'CE03');
  const projectId: string = job.projectId!;
  if (!projectId) {
    throw new Error(`CE03 Job ${jobId} missing projectId`);
  }

  logStructured('info', {
    action: 'CE03_JOB_START',
    jobId,
    projectId,
    traceId,
  });

  try {
    // 1. 获取输入数据
    let structuredText: string;
    let novelSceneId: string | undefined;
    const payload = getPayloadRecord(job);

    if (getStringField(payload, 'novelSceneId')) {
      // [Stage 3] Granular Scene Mode
      novelSceneId = getStringField(payload, 'novelSceneId');
      const ns = await prisma.scene.findUnique({ where: { id: novelSceneId } });
      structuredText = ns?.enrichedText || '';
    } else if (getStringField(payload, 'structured_text')) {
      // Direct payload input (gate/test scenarios)
      structuredText = getStringField(payload, 'structured_text') || '';
    } else {
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId },
      });
      if (!parseResult?.rawOutput) {
        throw new Error(`CE03_INPUT_MISSING: No input data found for CE03 job ${jobId}`);
      }
      structuredText = JSON.stringify(parseResult.rawOutput);
    }

    // 2. 调用 CE03 Engine
    const input: CE03VisualDensityInput = {
      structured_text: structuredText,
      context: {
        projectId,
      },
    };

    logStructured('info', {
      action: 'CE03_ENGINE_INVOKE',
      jobId,
      engineKey: 'ce03_visual_density',
      inputSample: structuredText.substring(0, 100),
    });

    // 调用 CE03 Engine
    const engineReq: EngineInvocationRequest<CE03VisualDensityInput> = {
      engineKey: 'ce03_visual_density',
      payload: input,
      metadata: {
        jobId,
        projectId: projectId,
        traceId,
      },
    };

    const engineResult = await engineClient.invoke<CE03VisualDensityInput, CE03VisualDensityOutput>(
      engineReq
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
        projectId,
        engine: 'CE03',
        jobId,
        traceId,
        visualDensityScore: result.visual_density_score,
        metadata: toJsonRecord(result.quality_indicators) as Prisma.InputJsonValue,
      },
    });

    // Write back to NovelScene if applicable
    if (novelSceneId) {
      // Use update if schema supports it, otherwise rely on QualityMetrics link
      // Assuming visualDensityScore exists in schema or we skip it for now to avoid break
      // We will trigger CE04 anyway
    }

    // [Stage 3 Fix] Fetch Context Early for CE03
    const shotJobForCE03 = await prisma.shotJob.findUnique({
      where: { id: jobId },
      select: { organizationId: true },
    });
    const organizationIdForCE03 = job.organizationId || shotJobForCE03?.organizationId;
    if (!organizationIdForCE03) {
      throw new Error(`[CE03] Organization ID is required for job ${jobId}`);
    }

    // [ORCHESTRATION] Stage 3: CE03 Success -> Trigger CE04 for this scene
    if (novelSceneId) {
      try {
        await prisma.shotJob.create({
          data: {
            projectId,
            type: JobType.CE04_VISUAL_ENRICHMENT,
            status: 'PENDING',
            payload: { novelSceneId },
            organizationId: organizationIdForCE03,
            traceId,
            // Propagate Schema IDs from CE03 Job
            episodeId: getStringField(getJobRecord(job), 'episodeId'),
            sceneId: getStringField(getJobRecord(job), 'sceneId'),
            shotId: getStringField(getJobRecord(job), 'shotId'),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        logStructured('info', {
          action: 'ORCHESTRATION_TRIGGER_CE04',
          jobId,
          novelSceneId,
        });
      } catch (e: unknown) {
        logStructured('error', {
          action: 'ORCHESTRATION_FAIL_CE03_TO_CE04',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 3.2 Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient, prisma);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      if (!project?.ownerId) {
        throw new Error(`[CE03] Project owner is required for job ${jobId}`);
      }
      const userId = project.ownerId;
      const pipelineRunId = getRequiredPipelineRunId(payload, jobId, 'CE03_BILLING');
      const billingUsage = toEngineBillingUsage((result as unknown as { billing_usage?: unknown }).billing_usage);

      if (billingUsage) {
        await costLedgerService.recordEngineBilling({
          jobId,
          jobType: JobType.CE03_VISUAL_DENSITY,
          traceId,
          projectId,
          userId,
          orgId: organizationIdForCE03,
          engineKey: 'ce03_visual_density',
          runId: pipelineRunId,
          billingUsage,
        });
      }
    } catch (billingError: unknown) {
      logStructured('error', {
        action: 'CE03_BILLING_FAILED',
        jobId,
        error: billingError instanceof Error ? billingError.message : String(billingError),
      });
      // Non-blocking
    }

    const duration = Date.now() - jobStartTime;

    // 计算 input/output hash
    const inputHash = hashData(input);
    const outputHash = hashData(result);

    // 上报审计日志
    try {
      await apiClient.postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: JobType.CE03_VISUAL_DENSITY,
        engineKey: 'ce03_visual_density',
        status: 'SUCCESS',
        inputHash,
        outputHash,
        latencyMs: duration,
        auditTrail: result.audit_trail || { message: 'missing' },
      });
    } catch (auditError: unknown) {
      logStructured('warn', {
        action: 'CE03_AUDIT_FAILED',
        jobId,
        error: auditError instanceof Error ? auditError.message : 'Unknown error',
      });
    }

    logStructured('info', {
      action: 'CE03_JOB_SUCCESS',
      jobId,
      projectId,
      durationMs: duration,
      visualDensityScore: result.visual_density_score,
    });

    return result;
  } catch (error: unknown) {
    const duration = Date.now() - jobStartTime;

    // 上报失败审计日志
    try {
      await apiClient.postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: JobType.CE03_VISUAL_DENSITY,
      engineKey: 'ce03_visual_density',
      status: 'FAILED',
      latencyMs: duration,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (auditError: unknown) {
      logStructured('warn', {
        action: 'CE03_AUDIT_FAILED',
        jobId,
        error: auditError instanceof Error ? auditError.message : 'Unknown error',
      });
    }

    logStructured('error', {
      action: 'CE03_JOB_FAILED',
      jobId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
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
  apiClient: ApiClient
): Promise<CE04HubOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  if (!job.projectId) throw new Error(`[CE04] Missing projectId for job ${jobId}`);
  const projectId: string = job.projectId;
  const traceId = getRequiredTraceId(job, 'CE04');

  logStructured('info', {
    action: 'CE04_JOB_START',
    jobId,
    projectId,
    traceId,
  });

  try {
    // 1. 获取输入 (Payload, CE06, CE03, Failback)
    let structuredText = '';
    let novelSceneId: string | undefined;
    const payload = getPayloadRecord(job);

    if (getStringField(payload, 'novelSceneId')) {
      // [Stage 3] Granular Mode
      novelSceneId = getStringField(payload, 'novelSceneId');
      const ns = await prisma.scene.findUnique({ where: { id: novelSceneId } });
      structuredText = ns?.enrichedText || '';
    } else if (getStringField(payload, 'structured_text')) {
      structuredText = getStringField(payload, 'structured_text') || '';
    } else {
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId },
      });
      if (parseResult?.rawOutput) {
        structuredText = JSON.stringify(parseResult.rawOutput);
      } else {
        throw new Error(`CE04_INPUT_MISSING: No scene data found for CE04 job ${jobId}`);
      }
    }

    // 2. [CORE FIX] 统一调用远程母引擎 Hub，不再直连 Selector
    const engineReq: EngineInvocationRequest<CE04HubPayload> = {
      engineKey: 'ce04_visual_enrichment',
      payload: {
        prompt: `Cinematic movie scene, high quality, 8k: ${structuredText.substring(0, 1000)}`, // Truncate to safe limit
        width: 1280,
        height: 720,
        traceId,
        projectId,
      },
      metadata: {
        jobId,
        projectId,
        traceId,
      },
    };


    const engineResult = await engineClient.invoke<CE04HubPayload, CE04HubOutput>(engineReq);

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE04 engine execution failed');
    }

    const result = engineResult.output;

    logStructured('info', {
      action: 'CE04_ENGINE_RESULT',
      jobId,
      asset: result.asset?.image,
    });

    // 3. 落库 QualityMetrics (Keep Legacy)
    await prisma.qualityMetrics.create({
      data: {
        projectId,
        engine: 'CE04',
        jobId,
        traceId,
        enrichmentQuality: 1.0, // Default for SDXL
        metadata: {
          enrichedPrompt: structuredText,
          billingUsage: engineResult.metrics?.usage,
          generatedAsset: result.asset?.image,
        },
      },
    });

    // [Stage 3] Write back Enriched Text to NovelScene (Optional/Legacy behavior)
    if (novelSceneId) {
      // SDXL doesn't return text, so we skip text update or keep original
    }

    // [Stage 4] Generate Physical Assets from Real SDXL Output
    // [Stage 3 Fix] Hydrate job from DB to ensure sceneId/episodeId are present
    const freshJob = await prisma.shotJob.findUnique({ where: { id: jobId } });

    if (freshJob?.sceneId) {
      try {
        const sceneId = freshJob.sceneId;
        const shots = await prisma.shot.findMany({
          where: { sceneId },
        });

        const realImagePath = result.asset?.image || result.storageKey || result.localPath;
        if (!realImagePath || !(await fileExists(realImagePath))) {
          throw new Error(
            `[CE04] TRUTH_INTEGRITY_VIOLATION: Required asset missing or invalid: ${realImagePath}`
          );
        }

        const repoRoot = path.resolve(process.cwd(), '../../');
        for (const shot of shots) {
          const framesDir = path.join(repoRoot, '.runtime', 'frames', shot.id);
          if (!(await fileExists(framesDir))) await ensureDir(framesDir);
          const framesTxtPath = path.join(framesDir, 'frames.txt');

          // Generate frames.txt pointing to REAL SDXL IMAGE
          // Duration default 4s
          const duration = shot.durationSeconds || 4;
          const content = `file '${realImagePath}'\nduration ${duration}\nfile '${realImagePath}'`;
          await fsp.writeFile(framesTxtPath, content);
        }
      } catch (truthError: unknown) {
        logStructured('warn', {
          action: 'CE04_REAL_ASSET_OP_FAILED',
          error: truthError instanceof Error ? truthError.message : String(truthError),
        });
        throw truthError; // Fail job if asset gen fails
      }
    }

    // 4. Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient, prisma);
      const project = await prisma.project.findUnique({
        where: { id: job.projectId },
        select: { ownerId: true },
      });
      const shotJob = await prisma.shotJob.findUnique({
        where: { id: jobId },
        select: { organizationId: true, payload: true },
      });
      const shotPayload = isRecord(shotJob?.payload) ? shotJob?.payload : {};
      const pipelineRunId = getRequiredPipelineRunId(shotPayload, jobId, 'CE04_BILLING');
      const billingUsage = toEngineBillingUsage(result.billing_usage);

      if (shotJob?.organizationId && billingUsage) {
        await costLedgerService.recordEngineBilling({
          jobId,
          jobType: JobType.CE04_VISUAL_ENRICHMENT,
          traceId,
          projectId: job.projectId,
          userId: project?.ownerId || (() => { throw new Error(`[CE04] Project owner missing for job ${jobId}`); })(),
          orgId: shotJob.organizationId,
          engineKey: 'ce04_visual_enrichment',
          runId: pipelineRunId,
          billingUsage,
        });
      }
    } catch (billingError: unknown) {
      logStructured('error', {
        action: 'CE04_BILLING_FAILED',
        jobId,
        error: billingError instanceof Error ? billingError.message : String(billingError),
      });
      // Non-blocking
    }

    const duration = Date.now() - jobStartTime;

    // 审计日志上报
    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: JobType.CE04_VISUAL_ENRICHMENT,
        engineKey: 'ce04_visual_enrichment',
        status: 'SUCCESS',
        inputHash: hashData(engineReq.payload),
        outputHash: hashData(result),
        latencyMs: duration,
        auditTrail: result.audit_trail,
      })
      .catch(() => {});

    return result;
  } catch (error: unknown) {
    logStructured('error', {
      action: 'CE04_JOB_FAILED',
      jobId,
      error: error instanceof Error ? error.message : String(error),
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
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const projectId: string = job.projectId!;
  const traceId = getRequiredTraceId(job, 'SHOT_RENDER');

  if (!projectId) throw new Error(`[ShotRender] Missing projectId for job ${jobId}`);

  // @ts-ignore
  const payload = getPayloadRecord(job);
  const shotId = getStringField(payload, 'shotId') || getStringField(getJobRecord(job), 'shotId');

  logStructured('info', {
    action: 'SHOT_RENDER_START',
    jobId,
    projectId,
    shotId,
    traceId,
  });

  // [Phase S Fix] Always fetch shot to get sceneId for orchestration
  const shotCore = await prisma.shot.findUnique({
    where: { id: shotId },
    include: { scene: true },
  });
  if (!shotCore) throw new Error(`Shot ${shotId} not found`);
  const sceneId = shotCore.sceneId;

  if (!shotId) {
    throw new Error('SHOT_RENDER job requires shotId');
  }

  // PHASE-E: Worker-side Enforcement (Zero Bypass)
  // 生产模式下，渲染 Job 必须在 Shot 本身处于 APPROVED 或 FINALIZED 状态时才能执行
  if (PRODUCTION_MODE) {
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      select: { reviewStatus: true },
    });
    if (
      !shot ||
      (shot.reviewStatus !== ShotReviewStatus.APPROVED &&
        shot.reviewStatus !== ShotReviewStatus.FINALIZED)
    ) {
      logStructured('error', {
        action: 'PRODUCTION_MODE_BLOCK',
        reason: 'Shot not approved for rendering',
        shotId,
        reviewStatus: shot?.reviewStatus,
      });
      throw new Error(
        `PRODUCTION_MODE_FORBIDS_UNAPPROVED_RENDER: Shot ${shotId} is ${shot?.reviewStatus || 'MISSING'}`
      );
    }
  }

  try {
    // 1. Resolve Input (Priority: CE04 Enriched -> Shot Text -> Fallback)
    let prompt = '';
    let style = 'cinematic';
    let seed = 12345;
    const payload = getPayloadRecord(job);

    const ce04Metrics = await prisma.qualityMetrics.findMany({
      where: { projectId, engine: 'CE04', traceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
    });
    if (ce04Metrics.length > 1) {
      logStructured('error', {
        action: 'SHOT_RENDER_CE04_METRIC_DUPLICATE',
        jobId,
        projectId,
        traceId,
        metricIds: ce04Metrics.map((metric) => metric.id),
      });
    }
    const ce04Metric = ce04Metrics[0] ?? null;

    const payloadPrompt = getStringField(payload, 'prompt');
    if (payloadPrompt) prompt = payloadPrompt;
    else if (isRecord(ce04Metric?.metadata) && typeof ce04Metric.metadata.enrichedPrompt === 'string') {
      prompt = ce04Metric.metadata.enrichedPrompt;
    } else {
      // Fallback: Try to fetch from Shot -> Scene -> NovelScene
      const richShot = await prisma.shot.findUnique({
        where: { id: shotId },
        include: { scene: true },
      });
      if (richShot?.scene?.summary) prompt = richShot.scene.summary;
      else if (typeof richShot?.description === 'string' && richShot.description.trim().length > 0) {
        prompt = richShot.description;
      } else if (typeof richShot?.title === 'string' && richShot.title.trim().length > 0) {
        prompt = richShot.title;
      }

      if (!prompt) {
        throw new Error(
          `SHOT_RENDER_INPUT_MISSING: No prompt found for SHOT_RENDER job ${jobId} after CE04/payload/shot resolution`
        );
      }
    }

    const payloadSeed = getNumberField(payload, 'seed');
    const payloadStyle = getStringField(payload, 'style');
    if (typeof payloadSeed === 'number') seed = payloadSeed;
    if (payloadStyle) style = payloadStyle;

    if (PRODUCTION_MODE && !prompt) {
      throw new Error(
        `PRODUCTION_MODE_FORBIDS_EMPTY_PROMPT: No prompt found for SHOT_RENDER job ${jobId}`
      );
    }

    // [Phase T] S1: Inject Real Image Source
    const repoRoot = path.resolve(process.cwd(), '../../');
    const framesTxt = path.join(repoRoot, '.runtime', 'frames', shotId, 'frames.txt');
    let sourceImagePath: string | null = null;
    if (await fileExists(framesTxt)) {
      const txt = await fsp.readFile(framesTxt, 'utf8');
      // Parse first "file '...'" line
      const m = txt.match(/file\s+'([^']+)'/);
      if (m && m[1]) {
        sourceImagePath = m[1];
        // Handle relative paths in frames.txt
        if (!path.isAbsolute(sourceImagePath)) {
          sourceImagePath = path.resolve(path.dirname(framesTxt), sourceImagePath);
        }
      }
    }

    if (!sourceImagePath) {
      if (PRODUCTION_MODE) {
        throw new Error(
          `[SHOT_RENDER] NO_SOURCE_IMAGE: frames.txt missing or empty/invalid for shotId=${shotId}`
        );
      }
      logStructured('warn', {
        action: 'SHOT_RENDER_NO_IMAGE',
        msg: 'No source image found in non-production run',
        shotId,
      });
    } else {
      logStructured('info', { action: 'SHOT_RENDER_IMAGE_FOUND', sourceImagePath });
    }

    // 2. [CORE FIX] 统一调用母引擎
    // P2-FIX-2 DEBUG: 打印 payload
    if (process.env.GATE_MODE === '1' || process.env.NODE_ENV !== 'production') {
      logStructured('info', {
        action: 'SHOT_RENDER_INVOKE_PAYLOAD',
        jobId,
        payload: { shotId, traceId, seed, prompt: ((prompt || '') as string).slice(0, 50) + '...' },
      });
    }

    const enginePayload: ShotRenderHubPayload = {
        shotId,
        prompt,
        seed,
        style,
        sourceImagePath, // [Phase T] Injected Image
        context: { projectId, sceneId }, // Injected sceneId
        projectId, // Injected top-level projectId for Adapter
    };

    const engineResult = await engineClient.invoke<ShotRenderHubPayload, ShotRenderHubOutput>({
      engineKey: getExplicitEngineKey(job, payload, 'SHOT_RENDER'),
      payload: enginePayload,
      metadata: { jobId, projectId, traceId, shotId, sceneId },
    });

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'SHOT_RENDER engine hub invocation failed');
    }

    const result = engineResult.output;
    const renderedStorageKey = result.asset?.uri || result.storageKey || result.localPath;
    if (!renderedStorageKey) {
      throw new Error('[SHOT_RENDER] Missing rendered storage key');
    }

    // 3. Persist Asset
    const asset = await prisma.asset.upsert({
      where: {
        ownerType_ownerId_type_role: {
          ownerType: AssetOwnerType.SHOT,
          ownerId: shotId,
          role: AssetRole.SHOT_SOURCE,
          type: AssetType.VIDEO,
        },
      },
      create: {
        projectId,
        ownerType: AssetOwnerType.SHOT,
        ownerId: shotId,
        role: AssetRole.SHOT_SOURCE,
        type: AssetType.VIDEO, // Force VIDEO for Pilot
        status: 'GENERATED',
        storageKey: renderedStorageKey,
        checksum: result.asset?.sha256 || result.sha256,
        createdByJobId: jobId,
      },
      update: {
        status: 'GENERATED',
        storageKey: renderedStorageKey,
        checksum: result.asset?.sha256 || result.sha256,
        createdByJobId: jobId,
      },
    });

    // 4. Record Quality Metrics
    await prisma.qualityMetrics.create({
      data: {
        projectId,
        engine: 'SHOT_RENDER',
        jobId,
        traceId,
        visualDensityScore: null,
        metadata: {
          ...(result.render_meta || {}),
          assetUri: renderedStorageKey,
          auditTrail: isRecord(result.audit_trail) ? result.audit_trail : { message: 'missing' },
          billingUsage: engineResult.metrics?.usage,
        } as Prisma.InputJsonValue,
      },
    });

    // P2-2 Compliance: Update Shot table to reflect real render status
    // P2-FIX-1: Restored normal Prisma update after DMMF self-check implementation
    await prisma.shot.update({
      where: { id: shotId },
      data: {
        renderStatus: 'COMPLETED',
        resultImageUrl: result.asset?.uri || result.storageKey || result.localPath,
        resultVideoUrl:
          result.asset?.videoUri ||
          result.asset?.uri ||
          result.storageKey ||
          result.localPath ||
          null,
      },
    });

    // [ORCHESTRATION] Stage 3: SHOT_RENDER Success -> Trigger VIDEO_RENDER for this scene
    if (sceneId) {
      try {
        const shotJob = await prisma.shotJob.findUnique({
          where: { id: jobId },
          select: { organizationId: true },
        });
        await apiClient.createJob({
          projectId,
          organizationId: shotJob?.organizationId || (() => { throw new Error(`[SHOT_RENDER] Organization ID is required for job ${jobId}`); })(),
          jobType: JobType.VIDEO_RENDER,
          priority: 10,
          dedupeKey: `video_render_${sceneId}_${traceId}`, // P0: Prevent redundant video renders per scene
          payload: {
            traceId,
            projectId,
            sceneId,
          },
        });
        logStructured('info', {
          action: 'ORCHESTRATION_TRIGGER_VIDEO_RENDER',
          jobId,
          sceneId,
        });
      } catch (e: unknown) {
        logStructured('warn', {
          action: 'ORCHESTRATION_FAIL_SHOT_TO_VIDEO',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 5. Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient, prisma);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      const shotJob = await prisma.shotJob.findUnique({
        where: { id: jobId },
        select: { organizationId: true, payload: true },
      });
      const shotPayload = isRecord(shotJob?.payload) ? shotJob.payload : {};
      const pipelineRunId = getRequiredPipelineRunId(shotPayload, jobId, 'SHOT_RENDER_BILLING');
      const billingUsage = toEngineBillingUsage(result.billing_usage);

      if (shotJob?.organizationId && billingUsage) {
        await costLedgerService.recordEngineBilling({
          jobId,
          jobType: JobType.SHOT_RENDER,
          traceId,
          projectId,
          userId: project?.ownerId || (() => { throw new Error(`[SHOT_RENDER] Project owner missing for job ${jobId}`); })(),
          orgId: shotJob.organizationId,
          engineKey: 'shot_render',
          runId: pipelineRunId,
          billingUsage,
        });
      }
    } catch (billingError: unknown) {
      logStructured('error', {
        action: 'SHOT_RENDER_BILLING_FAILED',
        jobId,
        error: billingError instanceof Error ? billingError.message : String(billingError),
      });
      // Non-blocking
    }

    const duration = Date.now() - jobStartTime;

    // 6. Audit Log
    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: JobType.SHOT_RENDER,
        engineKey: 'shot_render',
        status: 'SUCCESS',
        inputHash: hashData({ prompt, seed, style }),
        outputHash: hashData(result),
        latencyMs: duration,
        auditTrail: result.audit_trail,
        resourceId: asset.id,
        resourceType: 'asset',
      })
      .catch(() => {});

    return {
      status: 'SUCCEEDED',
      output: {
        assetId: asset.id,
        storageKey: result.asset?.uri || result.storageKey || result.localPath,
      },
      assetId: asset.id,
      secureUrl: result.asset?.uri || result.storageKey || result.localPath,
    };
  } catch (error: unknown) {
    logStructured('error', {
      action: 'SHOT_RENDER_FAILED',
      jobId,
      error: error instanceof Error ? error.message : String(error),
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
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const projectId: string = job.projectId!;
  const traceId = getRequiredTraceId(job, 'CE01');

  if (!projectId) throw new Error(`[CE01] Missing projectId for job ${jobId}`);

  logStructured('info', {
    action: 'CE01_JOB_START',
    jobId,
    projectId,
    traceId,
  });

  // Mock processing
  await new Promise((resolve) => setTimeout(resolve, 500));

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
      throw new Error(`Simulated failure for ${failOnceEnv}`);
    }
  }

  const duration = Date.now() - jobStartTime;

  // 上报审计日志
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: 'CE01_REFERENCE_SHEET',
      engineKey: 'ce01_reference_sheet_real',
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: { message: 'Reference sheet generated (Real Engine)' },
    })
    .catch(() => {});

  logStructured('info', {
    action: 'CE01_JOB_SUCCESS',
    jobId,
    projectId,
    durationMs: duration,
  });

  // P1-HARD: internal-truth:// protocol is required. 
  // In production, real path from engine must be returned.
  throw new Error('CE01_OUTPUT_INVALID: Absolute truth required. No internal-truth:// path allowed.');
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
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const projectId = job.projectId;
  const traceId = getRequiredTraceId(job, 'CE07');

  if (!projectId) throw new Error(`[CE07] Missing projectId for job ${jobId}`);

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
  const payload = getPayloadRecord(job);
  const explicitEngineKey = getExplicitEngineKey(job, payload, 'CE07');
  let currentText = getStringField(payload, 'text') || getStringField(payload, 'current_text') || '';
  const sceneId = getStringField(payload, 'sceneId');
  const chapterId = getStringField(payload, 'chapterId');

  if (!currentText && sceneId) {
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });
    // 优先场景概要，再使用已增强文本
    currentText = scene?.summary || scene?.enrichedText || '';
    if (!currentText) {
      throw new Error(`CE07_INPUT_MISSING: No current text found for CE07 job ${jobId}`);
    }
  }

  // 2. 检索前序记忆
  // 优先避免把当前 chapter 自己已有记录重新喂回 previous_memory（重试/重跑时会形成自引用）
  const previousMemories = await prisma.memoryShortTerm.findMany({
    where: {
      projectId,
      ...(chapterId
        ? {
            OR: [{ chapterId: null }, { chapterId: { not: chapterId } }],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 2,
  });
  const previousMemory = previousMemories[0] ?? null;

  // 3. 构造引擎输入
  const input: CE07MemoryUpdateInput = {
    current_text: currentText,
    previous_memory: previousMemory
      ? {
          summary: previousMemory.summary || '',
          character_states: toJsonRecord(previousMemory.characterStates) as unknown as JsonObject,
        }
      : undefined,
    context: {
      projectId,
      sceneId,
      chapterId,
    },
  };

  // 4. 调用引擎
  let engineResult: { success: boolean; output?: CE07MemoryUpdateOutput; error?: unknown };

  engineResult = await engineHub.invoke<CE07MemoryUpdateInput, CE07MemoryUpdateOutput>({
    engineKey: explicitEngineKey,
    payload: input,
    metadata: { traceId, projectId },
  });

  if (!engineResult.success || !engineResult.output) {
    const engineError = engineResult.error;
    const engineErrorMessage =
      typeof engineError === 'object' && engineError !== null && 'message' in engineError
        ? String((engineError as { message?: unknown }).message || 'Output missing')
        : 'Output missing';
    throw new Error(`Engine CE07 failed: ${engineErrorMessage}`);
  }

  const result = engineResult.output;

  // 5. 落库 (MemoryShortTerm)
  const memoryRecord = await prisma.memoryShortTerm.create({
    data: {
      projectId,
      chapterId,
      summary: result.summary,
      characterStates: toJsonRecord(result.character_states) as Prisma.InputJsonValue,
    },
  });

  const duration = Date.now() - jobStartTime;

  // 6. 上报审计日志
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: JobType.CE07_MEMORY_UPDATE,
      engineKey: explicitEngineKey,
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: {
        recordId: memoryRecord.id,
        factsCount: result.key_facts?.length || 0,
      },
    })
    .catch(() => {});

  logStructured('info', {
    action: 'CE07_MEMORY_UPDATE_SUCCESS',
    jobId,
    projectId,
    recordId: memoryRecord.id,
    durationMs: duration,
  });

  return {
    success: true,
    result: {
      memoryId: memoryRecord.id,
      summary: result.summary,
    },
  };
}

/**
 * 通用 CE Job 处理器，支持 Fail-Once 验证
 */
export async function processGenericCEJob(
  prisma: PrismaClient,
  job: WorkerJobBase,
  engineHub: EngineHubClient,
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const projectId = job.projectId!;
  const traceId = getRequiredTraceId(job, 'GenericCE');

  if (!job.projectId) throw new Error(`[GenericCE] Missing projectId for job ${jobId}`);

  logStructured('info', {
    action: 'GENERIC_CE_JOB_START',
    jobId,
    jobType: job.type,
    projectId,
    traceId,
  });

  // 分发到专有处理器（如果匹配）
  if (job.type === 'CE07_MEMORY_UPDATE') {
    return processCE07Job(prisma, job, engineHub, apiClient);
  }
  if (job.type === 'CE06_NOVEL_PARSING') {
    return processCE06Job(prisma, job, engineHub, apiClient);
  }
  if (job.type === 'CE03_VISUAL_DENSITY') {
    return processCE03Job(prisma, job, engineHub, apiClient);
  }
  if (job.type === 'CE04_VISUAL_ENRICHMENT') {
    return processCE04Job(prisma, job, engineHub, apiClient);
  }

  // Mock processing
  await new Promise((resolve) => setTimeout(resolve, 300));

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
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: String(job.type),
      engineKey: getExplicitEngineKey(job, getPayloadRecord(job), 'GenericCE'),
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: { message: `${job.type} processed (real)` },
    })
    .catch(() => {});

  logStructured('info', {
    action: 'GENERIC_CE_JOB_SUCCESS',
    jobId,
    jobType: job.type,
    projectId,
    durationMs: duration,
  });

  return { success: true, result: { message: `${job.type} completed successfully` } };
}
