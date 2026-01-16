import { PrismaClient, JobType } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}

/**
 * CE06 Novel Parsing Processor (V1.3.1: 母引擎收口 + 管线串联)
 * 严格通过 EngineHubClient 调用引擎，确保审计链路完整
 */
export async function processCE06NovelParsingJob(context: ProcessorContext): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const engineHub = new EngineHubClient(apiClient);

  try {
    const payload = job.payload || {};
    const phase = payload.phase || 'SCAN';

    if (phase === 'SCAN') {
      return executeScanJob(context, job, engineHub);
    } else {
      return executeChunkParseJob(context, job, engineHub);
    }
  } catch (error: any) {
    logger.error(`[CE06] ${error.message}`);
    return { status: 'FAILED', error: error.message };
  }
}

/**
 * SCAN 阶段 (通过母引擎)
 */
/**
 * SCAN 阶段 (通过母引擎)
 */
async function executeScanJob(context: ProcessorContext, job: ProcessorContext['job'], engineHub: EngineHubClient): Promise<ProcessorResult> {
  const { prisma, apiClient } = context;
  const logger = context.logger || console;
  const payload = job.payload || {};
  const rawText = payload.raw_text || payload.sourceText;
  const traceId = payload.traceId || job.id;

  if (!rawText) throw new Error('SCAN phase requires raw_text');

  const projectId = job.projectId;
  const organizationId = job.organizationId;

  if (!projectId || !organizationId) {
    throw new Error(`[CE06-SCAN] Missing projectId (${projectId}) or organizationId (${organizationId}) in job ${job.id}`);
  }

  logger.log(`[CE06-SCAN] Scanning via EngineHub for project ${projectId}...`);

  // 通过母引擎调用
  const engineResult = await engineHub.invoke({
    engineKey: 'ce06_novel_parsing',
    engineVersion: 'v1.3.1',
    payload: {
      structured_text: rawText,
      phase: 'SCAN',
      traceId,
    },
    metadata: {
      traceId,
      projectId,
      organizationId,
    },
  });

  if (!engineResult.success) {
    throw new Error(`SCAN failed: ${engineResult.error?.message}`);
  }

  const novelSource = await prisma.novelSource.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  if (!novelSource) throw new Error('NovelSource not found');

  const chunks = (engineResult.output as any).volumes || [];

  await prisma.$transaction(async (tx) => {
    for (const chunk of chunks) {
      const vol = await tx.novelVolume.upsert({
        where: { projectId_index: { projectId, index: chunk.volume_index } },
        create: { projectId, novelSourceId: novelSource.id, index: chunk.volume_index, title: chunk.volume_title },
        update: { title: chunk.volume_title },
      });

      const chapter = await tx.novelChapter.upsert({
        where: { volumeId_index: { volumeId: vol.id, index: chunk.chapter_index } },
        create: {
          volumeId: vol.id,
          novelSourceId: novelSource.id,
          index: chunk.chapter_index,
          title: chunk.chapter_title,
          summary: '',
          isSystemControlled: true,
        },
        update: { title: chunk.chapter_title },
      });

      // 扇出 CHUNK_PARSE 子任务
      await apiClient.createJob({
        jobType: JobType.CE06_NOVEL_PARSING,
        projectId,
        organizationId,
        payload: {
          phase: 'CHUNK_PARSE',
          chapterId: chapter.id,
          raw_text: rawText.substring(chunk.start_offset, chunk.end_offset),
          traceId,
        },
        parentJobId: job.id,
      });
    }
  });

  logger.log(`[CE06-SCAN] Fan-out complete. Created ${chunks.length} child jobs.`);
  return { status: 'SUCCEEDED', output: { chapters_count: chunks.length } };
}

/**
 * CHUNK_PARSE 阶段 (通过母引擎 + 自动串联 CE03/CE04)
 */
/**
 * CHUNK_PARSE 阶段 (通过母引擎 + 自动串联 CE03/CE04)
 */
async function executeChunkParseJob(context: ProcessorContext, job: ProcessorContext['job'], engineHub: EngineHubClient): Promise<ProcessorResult> {
  const { prisma, apiClient } = context;
  const logger = context.logger || console;
  const payload = job.payload || {};
  const chapterId = payload.chapterId;
  const chapterText = payload.raw_text;
  const traceId = payload.traceId || job.id;

  const projectId = job.projectId;
  const organizationId = job.organizationId;

  if (!projectId || !organizationId) {
    throw new Error(`[CE06-PARSE] Missing projectId (${projectId}) or organizationId (${organizationId}) in job ${job.id}`);
  }

  if (!chapterId || !chapterText) throw new Error('CHUNK_PARSE phase missing chapterId or raw_text');

  logger.log(`[CE06-PARSE] Analyzing chapter ${chapterId} via EngineHub...`);

  // Step 1: CE06 解析 (raw_text)
  const ce06Result = await engineHub.invoke({
    engineKey: 'ce06_novel_parsing',
    engineVersion: 'v1.3.1',
    payload: {
      structured_text: chapterText,
      phase: 'CHUNK_PARSE',
      traceId,
    },
    metadata: {
      traceId,
      projectId,
      organizationId,
    },
  });

  if (!ce06Result.success) {
    throw new Error(`CE06 CHUNK_PARSE failed: ${ce06Result.error?.message}`);
  }

  const scenes = (ce06Result.output as any).scenes || [];

  // Step 2: 写入 raw_text 并串联 CE03/CE04
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const sceneIndex = i + 1;

      // 先写入基础数据
      const scene = await tx.novelScene.upsert({
        where: { chapterId_index: { chapterId, index: sceneIndex } },
        create: {
          chapterId,
          index: sceneIndex,
          title: sc.title || `Scene ${sceneIndex}`,
          rawText: sc.raw_text || '',
        },
        update: {
          title: sc.title || `Scene ${sceneIndex}`,
          rawText: sc.raw_text || '',
        },
      });

      // Step 3: 调用 CE03 计算密度
      logger.log(`[CE03] Computing density for scene ${scene.id}...`);
      const ce03Result = await engineHub.invoke({
        engineKey: 'ce03_visual_density',
        engineVersion: 'v1.0',
        payload: {
          sceneText: sc.raw_text || '',
          traceId,
        },
        metadata: { traceId, sceneId: scene.id },
      });

      let densityScore = 0.5; // 默认值
      if (ce03Result.success) {
        densityScore = (ce03Result.output as any)?.density_score || 0.5;
      }

      // Step 4: 调用 CE04 生成增强文本
      logger.log(`[CE04] Enriching scene ${scene.id}...`);
      const ce04Result = await engineHub.invoke({
        engineKey: 'ce04_visual_enrichment',
        engineVersion: 'v1.0',
        payload: {
          sceneText: sc.raw_text || '',
          traceId,
        },
        metadata: { traceId, sceneId: scene.id },
      });

      let enrichedText = sc.raw_text || '';
      if (ce04Result.success) {
        enrichedText = (ce04Result.output as any)?.enriched_text || sc.raw_text || '';
      }

      // Step 5: 更新完整数据
      await tx.novelScene.update({
        where: { id: scene.id },
        data: {
          enrichedText,
          visualDensityScore: densityScore,
        },
      });
    }
  });

  // 计费 (只记录 CE06，CE03/CE04 由 EngineHub 自动记录)
  const costService = new CostLedgerService(apiClient);
  if (ce06Result.output && (ce06Result.output as any).billing_usage) {
    await costService.recordEngineBilling({
      jobId: job.id,
      jobType: JobType.CE06_NOVEL_PARSING,
      traceId,
      projectId,
      userId: job.userId || 'system',
      orgId: organizationId,
      attempt: job.attempts || 1,
      billingUsage: (ce06Result.output as any).billing_usage,
      engineKey: 'ce06_novel_parsing',
    });
  }

  return { status: 'SUCCEEDED' };
}
