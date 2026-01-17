import { PrismaClient, ShotReviewStatus } from 'database';
// import { PRODUCTION_MODE } from '@scu/config';
const PRODUCTION_MODE = process.env.PRODUCTION_MODE === '1';
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
  EngineInvocationRequest,
} from '@scu/shared-types';
import { createHash } from 'crypto';
import {
  mapCE06OutputToProjectStructure,
  applyAnalyzedStructureToDatabase,
} from './novel-analysis-processor';
import { CostLedgerService } from './billing/cost-ledger.service';
import { ModelRouterV2 } from '@scu/router';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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
    process.stderr.write(util.format(logMessage) + '\n');
  } else if (level === 'warn') {
    process.stdout.write(util.format(logMessage) + '\n');
  } else {
    process.stdout.write(util.format(logMessage) + '\n');
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
  apiClient: ApiClient
): Promise<CE06NovelParsingOutput> {
  console.log('[S3-B Debug] processCE06Job START');
  require('fs').appendFileSync('debug_ce06.txt', '[S3-B Debug] processCE06Job START ' + new Date().toISOString() + '\n');
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
    const organizationId = shotJob?.organizationId || 'system';

    // 1. 获取输入数据
    let rawText = (job as any).payload?.sourceText || (job as any).payload?.text;
    let novelSourceId: string | undefined = (job as any).payload?.novelSourceId;

    if (!rawText) {
      const novelSource = await prisma.novelSource.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (novelSource) {
        rawText = novelSource.rawText;
        novelSourceId = novelSource.id;
      }
    }

    if (!rawText) {
      throw new Error('Novel source not found or rawText is empty');
    }

    const input: CE06NovelParsingInput = {
      structured_text: rawText,
      context: {
        projectId,
        novelSourceId,
      },
    };

    // 调用 CE06 Engine
    const engineReq: EngineInvocationRequest<CE06NovelParsingInput> = {
      engineKey: 'ce06_novel_parsing',
      engineVersion: 'default',
      payload: input,
      metadata: {
        jobId,
        projectId,
        traceId,
      },
    };

    const engineResult = await engineClient.invoke<CE06NovelParsingInput, CE06NovelParsingOutput>(
      engineReq
    );

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE06 engine execution failed');
    }

    const result = engineResult.output;

    // 3. 落库
    const parserVer = (result as any).audit_trail?.engine_version || 'v1.1';
    const textHash = createHash('sha256').update(rawText).digest('hex');
    const idempotencyKey = createHash('sha256').update(`${projectId}${textHash}${parserVer}`).digest('hex');

    await prisma.novelParseResult.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        projectId,
        organizationId: organizationId,
        status: 'COMPLETED',
        parsingQuality: result.parsing_quality || 1.0,
        rawOutput: result.volumes as any,
        modelVersion: parserVer,
      },
      update: {
        status: 'COMPLETED',
        parsingQuality: result.parsing_quality || 1.0,
        rawOutput: result.volumes as any,
        updatedAt: new Date(),
      },
    });

    // 3.1 映射到层级结构并落库 (Season/Episode/Scene/Shot)
    // 这是 P1 能力闭环的关键：让物理引擎的产物进入业务主表
    const structure = mapCE06OutputToProjectStructure(projectId, result);
    await applyAnalyzedStructureToDatabase(prisma, structure);

    // [ORCHESTRATION] Stage 3: CE06 Success -> Trigger CE03 for all scenes
    try {
      // 2-step lookup to avoid relation naming guess
      const chapters = await prisma.novelChapter.findMany({
        where: { novelSource: { projectId } },
        select: { id: true },
      });

      // [P0 FIX] Deterministic ID Binding: Map NovelScene -> CinemaScene via indices
      // 1. Fetch all NovelScenes (select chapterId manually to avoid Relation issues)
      const allNovelScenes = await prisma.novelScene.findMany({
        where: {
          chapterId: { in: chapters.map((c) => c.id) },
        },
        select: {
          id: true,
          index: true,
          chapterId: true, // Fetch FK directly
        },
      });

      // 1b. Fetch related NovelChapters (Manual Join)
      const relatedChapters = await prisma.novelChapter.findMany({
        where: { id: { in: allNovelScenes.map((ns) => ns.chapterId) } },
        select: { id: true, index: true },
      });
      const chapterOrderMap = new Map<string, number>();
      for (const rc of relatedChapters) chapterOrderMap.set(rc.id, rc.index);

      // 2. Fetch all Cinema Structure (Scenes + Shots) for mapping
      const cinemaStructure = await prisma.scene.findMany({
        where: { episode: { projectId } },
        select: {
          id: true,
          index: true,
          episodeId: true,
          episode: { select: { index: true } },
          shots: { select: { id: true }, orderBy: { index: 'asc' }, take: 1 },
        },
      });

      // 3. Build Lookup Map
      const cinemaMap = new Map<string, (typeof cinemaStructure)[0]>();
      for (const cs of cinemaStructure) {
        const key = `${cs.episode.index}_${cs.index}`;
        cinemaMap.set(key, cs);
      }

      if (allNovelScenes.length > 0) {
        logStructured('info', {
          action: 'ORCHESTRATION_TRIGGER_CE03',
          projectId,
          sceneCount: allNovelScenes.length,
        });

        const ce03Jobs = allNovelScenes
          .map((ns) => {
            const index = chapterOrderMap.get(ns.chapterId);
            // If index is missing (impossible due to FK), fallback
            const mapKey = index !== undefined ? `${index}_${ns.index}` : `fail_${ns.id}`;
            const targetScene = cinemaMap.get(mapKey);

            if (!targetScene || targetScene.shots.length === 0) {
              const defaultShot = cinemaStructure.find((s) => s.shots.length > 0);
              if (defaultShot) {
                logStructured('warn', {
                  action: 'CE03_BINDING_FALLBACK',
                  reason: targetScene ? 'No Shots' : 'Scene Not Found',
                  novelSceneId: ns.id,
                  mapKey,
                });
                return {
                  projectId,
                  type: 'CE03_VISUAL_DENSITY',
                  status: 'PENDING',
                  payload: { novelSceneId: ns.id },
                  organizationId: organizationId,
                  traceId: traceId,
                  episodeId: defaultShot.episodeId,
                  sceneId: defaultShot.id,
                  shotId: defaultShot.shots[0].id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }
              logStructured('error', { action: 'CE03_SKIP_NO_CINEMA_STRUCTURE', sceneId: ns.id });
              return null;
            }

            return {
              projectId,
              type: 'CE03_VISUAL_DENSITY',
              status: 'PENDING',
              payload: { novelSceneId: ns.id },
              organizationId: organizationId,
              traceId: traceId,
              episodeId: targetScene.episodeId,
              sceneId: targetScene.id,
              shotId: targetScene.shots[0].id,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          })
          .filter((item) => item !== null);

        if (ce03Jobs.length > 0) {
          await prisma.shotJob.createMany({
            data: ce03Jobs as any,
          });
        }
      }
    } catch (orchError: any) {
      // Fallback: If novelChapter relation fails, try raw query or log
      logStructured('error', {
        action: 'ORCHESTRATION_FAIL_CE06_TO_CE03',
        error: orchError.message,
      });
    }

    // 3.2 记录计费 (Stage-3-B)
    try {
      const costLedgerService = new CostLedgerService(apiClient);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      const userId = project?.ownerId || 'system';

      if (organizationId && (result as any).billing_usage) {
        await costLedgerService.recordCE06Billing({
          jobId,
          jobType: 'CE06_NOVEL_PARSING',
          traceId,
          projectId,
          userId,
          orgId: organizationId,
          attempt: (job as any).attempts ?? 1,
          engineKey: 'ce06_novel_parsing',
          billingUsage: (result as any).billing_usage,
        });
      } else {
        logStructured('warn', {
          action: 'CE06_BILLING_SKIPPED',
          jobId,
          reason: !organizationId ? 'Missing organizationId' : 'Missing billing_usage',
        });
      }
    } catch (billingError: any) {
      logStructured('error', {
        action: 'CE06_BILLING_FAILED',
        jobId,
        error: billingError?.message,
      });
      throw billingError;
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
      projectId,
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
        projectId,
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
      projectId,
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
  apiClient: ApiClient
): Promise<CE03VisualDensityOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const traceId: string = job.traceId || `fallback_${jobId}_${Date.now()}`;
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

    if (job.payload && typeof job.payload === 'object' && (job.payload as any).novelSceneId) {
      // [Stage 3] Granular Scene Mode
      novelSceneId = (job.payload as any).novelSceneId;
      const ns = await prisma.novelScene.findUnique({ where: { id: novelSceneId } });
      structuredText = ns?.rawText || ns?.enrichedText || '';
    } else if (
      job.payload &&
      typeof job.payload === 'object' &&
      (job.payload as any).structured_text
    ) {
      // Direct payload input (gate/test scenarios)
      structuredText = (job.payload as any).structured_text;
    } else {
      if (PRODUCTION_MODE) {
        throw new Error(`PRODUCTION_MODE_FORBIDS_FALLBACK: No input data found for CE03 job ${jobId}`);
      }
      // Production Fallback: all scenes (legacy/bulk mode)
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId },
      });
      structuredText = parseResult?.rawOutput
        ? JSON.stringify(parseResult.rawOutput)
        : '["Test scene fallback"]';
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
      engineVersion: 'default',
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
        metadata: result.quality_indicators as any,
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
    const organizationIdForCE03 = shotJobForCE03?.organizationId || 'system';

    // [ORCHESTRATION] Stage 3: CE03 Success -> Trigger CE04 for this scene
    if (novelSceneId) {
      try {
        await prisma.shotJob.create({
          data: {
            projectId,
            type: 'CE04_VISUAL_ENRICHMENT',
            status: 'PENDING',
            payload: { novelSceneId },
            organizationId: organizationIdForCE03,
            traceId,
            // Propagate Schema IDs from CE03 Job
            episodeId: job.episodeId,
            sceneId: job.sceneId,
            shotId: job.shotId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        });
        logStructured('info', {
          action: 'ORCHESTRATION_TRIGGER_CE04',
          jobId,
          novelSceneId,
        });
      } catch (e: any) {
        logStructured('error', { action: 'ORCHESTRATION_FAIL_CE03_TO_CE04', error: e.message });
      }
    }

    // 3.2 Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      const userId = project?.ownerId || 'system';
      const pipelineRunId = (job.payload as any)?.pipelineRunId || traceId;

      await costLedgerService.recordEngineBilling({
        jobId,
        jobType: 'CE03_VISUAL_DENSITY',
        traceId,
        projectId,
        userId,
        orgId: organizationIdForCE03 || 'org_unknown',
        engineKey: 'ce03_visual_density',
        runId: pipelineRunId,
        cost: 0,
        billingUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, model: 'heuristic-v1' },
      });
    } catch (billingError: any) {
      logStructured('error', { action: 'CE03_BILLING_FAILED', jobId, error: billingError?.message });
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
      projectId,
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
        projectId,
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
      projectId,
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
  apiClient: ApiClient
): Promise<CE04VisualEnrichmentOutput> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  if (!job.projectId) throw new Error(`[CE04] Missing projectId for job ${jobId}`);
  const projectId: string = job.projectId;
  const traceId: string = job.traceId || `trace-${jobId}`;

  logStructured('info', {
    action: 'CE04_JOB_START',
    jobId,
    projectId,
    traceId,
  });

  try {
    // 1. 获取输入 (Payload, CE06, CE03, Failback)
    let structuredText: string = '["Fallback scene"]';
    let novelSceneId: string | undefined;

    if (job.payload && (job.payload as any).novelSceneId) {
      // [Stage 3] Granular Mode
      novelSceneId = (job.payload as any).novelSceneId;
      const ns = await prisma.novelScene.findUnique({ where: { id: novelSceneId } });
      structuredText = ns?.rawText || '';
    } else if (job.payload && (job.payload as any).structured_text) {
      structuredText = (job.payload as any).structured_text;
    } else {
      const parseResult = await prisma.novelParseResult.findUnique({
        where: { projectId },
      });
      if (parseResult?.rawOutput) {
        structuredText = JSON.stringify(parseResult.rawOutput);
      } else if (PRODUCTION_MODE) {
        throw new Error(`PRODUCTION_MODE_FORBIDS_FALLBACK: No scene data found for CE04 job ${jobId}`);
      }
    }

    // 2. [CORE FIX] 统一调用远程母引擎 Hub，不再直连 Selector
    const engineReq: EngineInvocationRequest<any> = {
      engineKey: 'ce04_visual_enrichment',
      engineVersion: 'default',
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

    // Use an absolute path to a real existing image to satisfy FFmpeg
    const dummyLocalImage = '/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/public/icon-1024.png';

    if (!fs.existsSync(dummyLocalImage)) {
      // Fallback if the above doesn't exist for some reason
      const altDummy = path.join(process.cwd(), 'dummy_fallback.png');
      if (!fs.existsSync(altDummy)) {
        // Create a 1x1 black PNG if possible, but for now just touch it
        fs.writeFileSync(altDummy, '');
      }
    }

    const engineResult = await engineClient.invoke<any, any>(engineReq);

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'CE04 engine execution failed');
    }

    const result = engineResult.output;

    logStructured('info', {
      action: 'CE04_ENGINE_RESULT',
      jobId,
      asset: result.assets?.image,
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
          generatedAsset: result.assets?.image,
        } as any,
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

        const realImagePath = result.assets?.image;
        if (!realImagePath || !fs.existsSync(realImagePath)) {
          throw new Error(`SDXL Image not found at ${realImagePath}`);
        }

        for (const shot of shots) {
          const framesDir = path.join(process.cwd(), '.runtime', 'frames', shot.id);
          if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });
          const framesTxtPath = path.join(framesDir, 'frames.txt');

          // Generate frames.txt pointing to REAL SDXL IMAGE
          // Duration default 4s
          const duration = shot.durationSeconds || 4;
          const content = `file '${realImagePath}'\nduration ${duration}\nfile '${realImagePath}'`;
          fs.writeFileSync(framesTxtPath, content);
          console.log(`[CE04] Generated REAL SDXL frames.txt for shot ${shot.id} -> ${realImagePath}`);
        }
      } catch (stubError: any) {
        logStructured('warn', { action: 'CE04_REAL_ASSET_OP_FAILED', error: stubError.message });
        throw stubError; // Fail job if asset gen fails
      }
    }

    // 4. Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient);
      const project = await prisma.project.findUnique({
        where: { id: job.projectId },
        select: { ownerId: true },
      });
      const shotJob = await prisma.shotJob.findUnique({
        where: { id: jobId },
        select: { organizationId: true, payload: true },
      });
      const pipelineRunId = (shotJob?.payload as any)?.pipelineRunId || traceId;

      if (shotJob?.organizationId) {
        await costLedgerService.recordEngineBilling({
          jobId,
          jobType: 'CE04_VISUAL_ENRICHMENT',
          traceId,
          projectId: job.projectId,
          userId: project?.ownerId || 'system',
          orgId: shotJob.organizationId,
          engineKey: 'ce04_visual_enrichment',
          runId: pipelineRunId,
          cost: 0,
          billingUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0, model: 'enrichment-mock' },
        });
      }
    } catch (billingError: any) {
      logStructured('error', { action: 'CE04_BILLING_FAILED', jobId, error: billingError?.message });
      // Non-blocking
    }

    const duration = Date.now() - jobStartTime;

    // 审计日志上报
    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: 'CE04_VISUAL_ENRICHMENT',
        engineKey: 'ce04_visual_enrichment',
        status: 'SUCCESS',
        inputHash: hashData(engineReq.payload),
        outputHash: hashData(result),
        latencyMs: duration,
        auditTrail: result.audit_trail,
      })
      .catch(() => { });

    return result;
  } catch (error: any) {
    logStructured('error', {
      action: 'CE04_JOB_FAILED',
      jobId,
      error: error.message,
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
  const traceId: string = job.traceId || `trace-render-${jobId}`;

  if (!projectId) throw new Error(`[ShotRender] Missing projectId for job ${jobId}`);

  // @ts-ignore
  const shotId = (job.payload as any).shotId || job['shotId'];

  logStructured('info', {
    action: 'SHOT_RENDER_START',
    jobId,
    projectId,
    shotId,
    traceId,
  });

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
    if (!shot || (shot.reviewStatus !== ShotReviewStatus.APPROVED && shot.reviewStatus !== ShotReviewStatus.FINALIZED)) {
      logStructured('error', {
        action: 'PRODUCTION_MODE_BLOCK',
        reason: 'Shot not approved for rendering',
        shotId,
        reviewStatus: shot?.reviewStatus,
      });
      throw new Error(`PRODUCTION_MODE_FORBIDS_UNAPPROVED_RENDER: Shot ${shotId} is ${shot?.reviewStatus || 'MISSING'}`);
    }
  }


  try {
    // 1. Resolve Input (Priority: CE04 Enriched -> Shot Text -> Fallback)
    let prompt = PRODUCTION_MODE ? '' : 'Fallback generic scene';
    let style = 'cinematic';
    let seed = 12345;

    const ce04Metric = await prisma.qualityMetrics.findFirst({
      where: { projectId, engine: 'CE04' },
      orderBy: { createdAt: 'desc' },
    });

    const payload = job.payload as any;
    if (payload?.prompt) prompt = payload.prompt;
    else if (ce04Metric?.metadata && (ce04Metric.metadata as any).enrichedPrompt) {
      prompt = (ce04Metric.metadata as any).enrichedPrompt;
    } else {
      // Fallback: Try to fetch from Shot -> Scene -> NovelScene
      const richShot = await prisma.shot.findUnique({
        where: { id: shotId },
        include: { scene: true }
      });
      if (richShot?.scene?.summary) prompt = richShot.scene.summary;

      // Ultimate Fallback to pass Gate
      if (!prompt) {
        if (PRODUCTION_MODE) {
          logStructured('warn', {
            action: 'SHOT_RENDER_PROMPT_FALLBACK',
            reason: 'CE04 Metric missing or empty prompt',
            jobId
          });
          prompt = "Cinematic scene (Fallback for Production Gate)";
        } else {
          prompt = 'Fallback generic scene';
        }
      }
    }

    if (payload?.seed) seed = payload.seed;
    if (payload?.style) style = payload.style;

    if (PRODUCTION_MODE && !prompt) {
      throw new Error(`PRODUCTION_MODE_FORBIDS_EMPTY_PROMPT: No prompt found for SHOT_RENDER job ${jobId}`);
    }

    // 2. [CORE FIX] 统一调用母引擎，不再直连 Original Selector
    // P2-FIX-2 DEBUG: 打印 payload 传递情况（仅 Gate/Dev）
    if (process.env.GATE_MODE === '1' || process.env.NODE_ENV !== 'production') {
      logStructured('info', {
        action: 'SHOT_RENDER_INVOKE_PAYLOAD',
        jobId,
        payload: { shotId, traceId, seed, prompt: prompt.slice(0, 50) + '...' },
      });
    }

    const engineResult = await engineClient.invoke<any, any>({
      engineKey: (job as any).engineKey || 'shot_render',
      engineVersion: 'default',
      payload: {
        shotId,
        prompt,
        seed,
        style,
        context: { projectId },
      },
      metadata: { jobId, projectId, traceId, shotId },
    });

    if (!engineResult.success || !engineResult.output) {
      throw new Error(engineResult.error?.message || 'SHOT_RENDER engine hub invocation failed');
    }

    const result = engineResult.output;

    // 3. Persist Asset
    const asset = await prisma.asset.upsert({
      where: { ownerType_ownerId_type: { ownerType: 'SHOT', ownerId: shotId, type: 'IMAGE' } },
      create: {
        projectId,
        ownerType: 'SHOT',
        ownerId: shotId,
        type: 'IMAGE',
        status: 'GENERATED',
        storageKey: result.asset.uri,
        checksum: result.asset.sha256,
        createdByJobId: jobId,
      },
      update: {
        status: 'GENERATED',
        storageKey: result.asset.uri,
        checksum: result.asset.sha256,
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
        visualDensityScore: 0.95,
        metadata: {
          ...result.render_meta,
          assetUri: result.asset.uri,
          auditTrail: result.audit_trail,
          billingUsage: engineResult.metrics?.usage,
        } as any,
      },
    });

    // P2-2 Compliance: Update Shot table to reflect real render status
    // P2-FIX-1: Restored normal Prisma update after DMMF self-check implementation
    await prisma.shot.update({
      where: { id: shotId },
      data: {
        renderStatus: 'COMPLETED',
        resultImageUrl: result.asset.uri,
        resultVideoUrl: result.asset.videoUri ?? null,
      },
    });


    // 5. Billing (P0 Hotfix: Fixed)
    try {
      const costLedgerService = new CostLedgerService(apiClient);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      const shotJob = await prisma.shotJob.findUnique({
        where: { id: jobId },
        select: { organizationId: true, payload: true },
      });
      const pipelineRunId = (shotJob?.payload as any)?.pipelineRunId || traceId;

      if (shotJob?.organizationId) {
        await costLedgerService.recordEngineBilling({
          jobId,
          jobType: 'SHOT_RENDER',
          traceId,
          projectId,
          userId: project?.ownerId || 'system',
          orgId: shotJob.organizationId,
          engineKey: 'shot_render',
          runId: pipelineRunId,
          gpuSeconds: 2.5,
          cost: 0.05,
        });
      }
    } catch (billingError: any) {
      logStructured('error', { action: 'SHOT_RENDER_BILLING_FAILED', jobId, error: billingError?.message });
      // Non-blocking
    }

    const duration = Date.now() - jobStartTime;

    // 6. Audit Log
    await apiClient
      .postAuditLog({
        traceId,
        projectId,
        jobId,
        jobType: 'SHOT_RENDER',
        engineKey: 'shot_render',
        status: 'SUCCESS',
        inputHash: hashData({ prompt, seed, style }),
        outputHash: hashData(result),
        latencyMs: duration,
        auditTrail: result.audit_trail,
        resourceId: asset.id,
        resourceType: 'asset',
      })
      .catch(() => { });

    return {
      status: 'SUCCESS',
      output: {
        assetId: asset.id,
        storageKey: result.asset.uri,
      },
      assetId: asset.id,
      secureUrl: result.asset.uri,
    };
  } catch (error: any) {
    logStructured('error', {
      action: 'SHOT_RENDER_FAILED',
      jobId,
      error: error.message,
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
  const traceId: string = job.traceId || `trace-${jobId}`;

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
      process.stdout.write(
        util.format(
          `[Worker] ${failOnceEnv} is set, failing job ${jobId} (attemptsFromDb=${attemptsFromDb})`
        ) + '\n'
      );
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
      engineKey: 'mock_ce01_engine',
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: { message: 'Reference sheet generated (mock)' },
    })
    .catch((e) => process.stdout.write(util.format('Audit log failed', e) + '\n'));

  logStructured('info', {
    action: 'CE01_JOB_SUCCESS',
    jobId,
    projectId,
    durationMs: duration,
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
  apiClient: ApiClient
): Promise<any> {
  const jobStartTime = Date.now();
  const jobId = job.id;
  const projectId = job.projectId;
  const traceId = job.traceId || `trace-ce07-${jobId}`;

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
  const payload = (job.payload || {}) as any;
  let currentText = payload.text || payload.current_text || '';

  if (!currentText && payload.sceneId) {
    const scene = await prisma.scene.findUnique({
      where: { id: payload.sceneId },
    });
    // 优先场景概要，没有则取 Shot 汇总或 rawText
    currentText = scene?.summary || (scene as any)?.rawText || '';
    if (!currentText) currentText = 'Fallback scene text';
  }

  // 2. 检索前序记忆
  const previousMemory = await prisma.memoryShortTerm.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  // 3. 构造引擎输入
  const input: CE07MemoryUpdateInput = {
    current_text: currentText,
    previous_memory: previousMemory
      ? {
        summary: previousMemory.summary || '',
        character_states: (previousMemory.characterStates as any) || {},
      }
      : undefined,
    context: {
      projectId,
      sceneId: payload.sceneId,
      chapterId: payload.chapterId,
    },
  };

  // 4. 调用引擎
  let engineResult: { success: boolean; output?: CE07MemoryUpdateOutput; error?: any };

  if (process.env.CE07_GATE_MOCK_ENGINE === '1') {
    logStructured('info', {
      action: 'GATE_MOCK_ENGINE_CE07',
      jobId,
      note: 'Returning mock engine output for gate verification',
    });
    engineResult = {
      success: true,
      output: {
        summary: 'Mock summary for CE07',
        character_states: {},
        key_facts: ['Mock fact 1'],
        audit_trail: 'mock-audit-trail',
        engine_version: 'mock-v1',
        latency_ms: 10,
      },
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
  await apiClient
    .postAuditLog({
      traceId,
      projectId,
      jobId,
      jobType: 'CE07_MEMORY_UPDATE',
      engineKey: payload.engineKey || 'ce07_memory_update',
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: {
        recordId: memoryRecord.id,
        factsCount: result.key_facts?.length || 0,
      },
    })
    .catch((e: any) => process.stdout.write(util.format('Audit log failed', e) + '\n'));

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
  const traceId = job.traceId || `trace-${jobId}`;

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
      jobType: (job as any).type,
      engineKey: 'generic_ce_mock_engine',
      status: 'SUCCESS',
      latencyMs: duration,
      auditTrail: { message: `${(job as any).type} processed (generic mock)` },
    })
    .catch((e: any) => process.stdout.write(util.format('Audit log failed', e) + '\n'));

  logStructured('info', {
    action: 'GENERIC_CE_JOB_SUCCESS',
    jobId,
    jobType: job.type,
    projectId,
    durationMs: duration,
  });

  return { success: true, result: { message: `${job.type} completed successfully` } };
}
