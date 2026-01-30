import { PrismaClient, JobType } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { CostLedgerService } from '../billing/cost-ledger.service';
import { ProcessorContext } from '../types/processor-context';
import { buildContext } from '../v3/context/context_injector';
import { updateCharacterStates, snapshotScene, type CharacterState } from '../v3/graph/graph_state';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}
import { CE01ProtocolAdapter } from '../adapters/ce01-protocol.adapter';

/**
 * CE06 Novel Parsing Processor (V1.3.1: 母引擎收口 + 管线串联)
 * 严格通过 EngineHubClient 调用引擎，确保审计链路完整
 */
export async function processCE06NovelParsingJob(
  context: ProcessorContext
): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;
  const engineHub = new EngineHubClient(apiClient);

  // V3.0 Phase 2: Protocol Adapter (Bible -> Internal)
  // Normalize payload globally so all sub-functions see strict internal types
  if (job.payload) {
    job.payload = CE01ProtocolAdapter.toInternal(job.payload);
  }

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
async function executeScanJob(
  context: ProcessorContext,
  job: ProcessorContext['job'],
  engineHub: EngineHubClient
): Promise<ProcessorResult> {
  const { prisma, apiClient } = context;
  const logger = context.logger || console;
  const payload = job.payload || {};
  const rawText = payload.raw_text || payload.sourceText;
  const traceId = payload.traceId || job.id;

  if (!rawText) throw new Error('SCAN phase requires raw_text');

  const projectId = job.projectId;
  const organizationId = job.organizationId;

  if (!projectId || !organizationId) {
    throw new Error(
      `[CE06-SCAN] Missing projectId (${projectId}) or organizationId (${organizationId}) in job ${job.id}`
    );
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

  const novelSource = await prisma.novel.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  if (!novelSource) throw new Error('NovelSource not found');

  const chunks = (engineResult.output as any).volumes || [];

  await prisma.$transaction(async (tx) => {
    for (const chunk of chunks) {
      const vol = await tx.novelVolume.upsert({
        where: { projectId_index: { projectId, index: chunk.volume_index } },
        create: {
          projectId,
          novelSourceId: novelSource.id,
          index: chunk.volume_index,
          title: chunk.volume_title,
        },
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
          projectId, // Required by JobGenericController
          pipelineRunId: job.payload?.pipelineRunId,
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
async function executeChunkParseJob(
  context: ProcessorContext,
  job: ProcessorContext['job'],
  engineHub: EngineHubClient
): Promise<ProcessorResult> {
  const { prisma, apiClient } = context;
  const logger = context.logger || console;
  const payload = job.payload || {};
  const chapterId = payload.chapterId;
  const chapterText = payload.raw_text;
  const traceId = payload.traceId || job.id;
  const pipelineRunId = job.payload?.pipelineRunId || payload.pipelineRunId;
  logger.log(
    `[CE06_DEBUG_CHUNK] JobID=${job.id} TraceId=${traceId} PLRunId=${pipelineRunId} Payload=${JSON.stringify(payload)}`
  );

  const projectId = job.projectId;
  const organizationId = job.organizationId;

  if (!projectId || !organizationId) {
    throw new Error(
      `[CE06-PARSE] Missing projectId (${projectId}) or organizationId (${organizationId}) in job ${job.id}`
    );
  }

  if (!chapterId || !chapterText)
    throw new Error('CHUNK_PARSE phase missing chapterId or raw_text');

  logger.log(`[CE06-PARSE] Analyzing chapter ${chapterId} via EngineHub...`);

  // V3.0 P0-2: 获取章节信息用于上下文注入 (Include episode for downstream linkage)
  const chapter = await prisma.novelChapter.findUnique({
    where: { id: chapterId },
    include: { episode: true },
  });
  if (!chapter) throw new Error(`Chapter ${chapterId} not found`);

  // V3.0 P0-2: 构建递归注入上下文
  const contextPrompt = await buildContext({
    prisma,
    projectId,
    chapterId,
    chapterIndex: chapter.index,
    currentTextOrSummary: chapter.summary || chapterText.substring(0, 500),
  });

  logger.log(
    `[CE06-PARSE] Context injection built: Long-term=${contextPrompt.longTermMemory.substring(0, 50)}...`
  );

  // V3.0 Phase 2: Protocol Adapter (Bible -> Internal)
  // Already normalized at top-level
  // console.log('[CE06_DEBUG] Chunk Parse Payload:', JSON.stringify(job.payload));

  // Step 1: CE06 解析 (raw_text + context_injection)
  const ce06Result = await engineHub.invoke({
    engineKey: 'ce06_novel_parsing',
    engineVersion: 'v1.3.1',
    payload: {
      structured_text: chapterText,
      phase: 'CHUNK_PARSE',
      traceId,
      // V3.0 P0-2: 注入上下文到 CE06 引擎
      context_injection: {
        long_term_memory: contextPrompt.longTermMemory,
        short_term_memory: contextPrompt.shortTermMemory,
        entity_states: contextPrompt.entityStates,
      },
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
  logger.log(`[CE06-PARSE] Received ${scenes.length} scenes from engine output`);

  // Step 2: 写入 raw_text 并串联 CE03/CE04
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const sceneIndex = i + 1;

      // 先写入基础数据
      const scene = await tx.scene.upsert({
        where: { chapterId_sceneIndex: { chapterId, sceneIndex } },
        create: {
          chapterId,
          projectId,
          episodeId: chapter.episode?.id,
          sceneIndex,
          title: (sc.title || `Scene ${sceneIndex}`) + ` [${traceId}]`,
          enrichedText: sc.raw_text || '',
        },
        update: {
          projectId,
          episodeId: chapter.episode?.id,
          title: (sc.title || `Scene ${sceneIndex}`) + ` [${traceId}]`,
          enrichedText: sc.raw_text || '',
        },
      });

      // Step 2.1: Ensure Default Shot exists (Gap Fix for SHOT_RENDER)
      let defaultShot = await tx.shot.findFirst({
        where: { sceneId: scene.id, index: 1 },
      });

      if (!defaultShot) {
        defaultShot = await tx.shot.create({
          data: {
            sceneId: scene.id,
            organizationId,
            index: 1,
            type: 'DEFAULT',
            durationSeconds: 3,
            renderStatus: 'PENDING',
            title: `Shot 1 [${traceId}]`,
          },
        });
      }

      // V3.0 P0-2: projectId is not a column in novel_scenes table
      // Removed projectId update logic

      // Step 3: 调用 CE03 计算密度
      logger.log(`[CE03] Computing density for scene ${scene.id}...`);
      const ce03Result = await engineHub.invoke({
        engineKey: 'ce03_visual_density',
        engineVersion: 'v1.0',
        payload: {
          structured_text: sc.raw_text || '',
          traceId,
          pipelineRunId,
          shotId: defaultShot.id,
        },
        metadata: { traceId, sceneId: scene.id, shotId: defaultShot.id },
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
          structured_text: sc.raw_text || '',
          traceId,
          pipelineRunId,
          shotId: defaultShot.id,
        },
        metadata: { traceId, sceneId: scene.id, shotId: defaultShot.id },
      });

      let enrichedText = sc.raw_text || '';
      if (ce04Result.success) {
        const ce04Output = ce04Result.output as any;
        enrichedText =
          ce04Output?.enriched_text || ce04Output?.enriched_prompt || sc.raw_text || '';
      }

      // Step 5: 更新完整数据
      await tx.scene.update({
        where: { id: scene.id },
        data: {
          enrichedText,
          visualDensityScore: densityScore,
        },
      });

      // V3.0 P0-2: 写入场景的 graph_state_snapshot
      // 从 CE06 输出提取角色状态（若无则使用默认）
      const sceneCharacters: CharacterState[] = (sc.characters || []).map((char: any) => ({
        id: char.id || `char_${char.name}`,
        name: char.name || '未知角色',
        status: char.status || 'normal',
        appearance: {
          clothing: char.appearance?.clothing || '普通服饰',
          hair: char.appearance?.hair || '普通发型',
        },
        items: char.items || [],
        injuries: char.injuries || [],
        location: char.location || '未知位置',
      }));

      await snapshotScene({
        prisma: tx,
        sceneId: scene.id,
        snapshot: {
          characters: sceneCharacters,
          scene_index: sceneIndex,
          chapter_id: chapterId,
        },
      });
    }

    // V3.0 P0-2: 提取并更新章节级角色状态到 memory_short_term
    const allCharacters: CharacterState[] = [];
    for (const sc of scenes) {
      if (sc.characters) {
        for (const char of sc.characters) {
          const existingChar = allCharacters.find((c) => c.id === (char.id || `char_${char.name}`));
          if (!existingChar) {
            allCharacters.push({
              id: char.id || `char_${char.name}`,
              name: char.name || '未知角色',
              status: char.status || 'normal',
              appearance: {
                clothing: char.appearance?.clothing || '普通服饰',
                hair: char.appearance?.hair || '普通发型',
              },
              items: char.items || [],
              injuries: char.injuries || [],
              location: char.location || '未知位置',
            });
          }
        }
      }
    }

    if (allCharacters.length > 0) {
      await updateCharacterStates({
        prisma: tx,
        projectId,
        chapterId,
        characterStates: allCharacters,
      });
    }
  });

  // 计费 (只记录 CE06，CE03/CE04 由 EngineHub 自动记录)
  const costService = new CostLedgerService(apiClient, prisma);
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
