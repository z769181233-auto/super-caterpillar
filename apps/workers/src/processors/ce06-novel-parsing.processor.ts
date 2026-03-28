import { PrismaClient, JobType } from 'database';
import { ApiClient } from '../api-client';
import { EngineHubClient } from '../engine-hub-client';
import { ProcessorContext } from '../types/processor-context';
import { buildContext } from '../v3/context/context_injector';
import { updateCharacterStates, snapshotScene, type CharacterState } from '../v3/graph/graph_state';

export interface ProcessorResult {
  status: 'SUCCEEDED' | 'FAILED' | 'RETRYING';
  output?: any;
  error?: string;
}
import { CE01ProtocolAdapter } from '../adapters/ce01-protocol.adapter';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requireNonEmptyString(value: unknown, contextTag: string, field: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(`[${contextTag}] Missing ${field}`);
}

/**
 * CE06 Novel Parsing Processor (V1.3.1: 母引擎收口 + 管线串联)
 * 严格通过 EngineHubClient 调用引擎，确保审计链路完整
 */
export async function processCE06NovelParsingJob(
  context: ProcessorContext
): Promise<ProcessorResult> {
  const { prisma, job, apiClient } = context;
  const logger = context.logger || console;

  logger.log(`[CE06-ENTRY] JobId=${job.id}`);
  if (job.payload) {
    logger.log(`[CE06-ENTRY] Payload keys=${Object.keys(job.payload).join(',')}`);
  }

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
  const { prisma, apiClient, localStorage } = context;
  const logger = context.logger || console;
  const payload = job.payload || {};
  let rawText = payload.raw_text || payload.sourceText || payload.rawText;
  const traceId = requireNonEmptyString(payload.traceId ?? job.traceId, 'CE06_SCAN', 'traceId');

  // [P6-0 Fix] Support novelRef (Storage Reference)
  if (payload.novelRef && payload.novelRef.storageKey) {
    if (!localStorage) {
      throw new Error('[CE06-SCAN] LocalStorageAdapter not injected into context');
    }
    const absPath = localStorage.getAbsolutePath(payload.novelRef.storageKey);
    const fs = await import('fs');
    if (fs.existsSync(absPath)) {
      logger.log(`[CE06-SCAN] Loading rawText from Reference: ${payload.novelRef.storageKey}`);
      rawText = fs.readFileSync(absPath, 'utf8');
    } else {
      throw new Error(`[CE06-SCAN] Referenced file not found: ${absPath}`);
    }
  }

  logger.log(`[CE06-DEBUG] JobId=${job.id} PayloadKeys=${Object.keys(payload).join(',')}`);
  if (rawText) {
    logger.log(`[CE06-DEBUG] rawText length=${rawText.length}`);
  } else {
    logger.warn('[CE06-DEBUG] rawText missing or empty');
  }

  if (!rawText) throw new Error('SCAN phase requires raw_text');

  const projectId = job.projectId;
  const organizationId = job.organizationId;

  if (!projectId || !organizationId) {
    throw new Error(
      `[CE06-SCAN] Missing projectId (${projectId}) or organizationId (${organizationId}) in job ${job.id}`
    );
  }

  logger.log(`[CE06-SCAN] Scanning via EngineHub for project ${projectId}...`);

  // [P6-0 Fix] Use novelRef if available to avoid sending massive JSON to API
  const invokePayload: any = {
    phase: 'SCAN',
    traceId,
  };
  if (payload.novelRef) {
    invokePayload.novelRef = payload.novelRef;
  } else {
    invokePayload.structured_text = rawText;
  }

  // 通过母引擎调用
  const engineResult = await engineHub.invoke({
    engineKey: 'ce06_novel_parsing',
    engineVersion: 'v1.3.1',
    payload: invokePayload,
    metadata: {
      traceId,
      projectId,
      organizationId,
    },
  });

  logger.log(`[CE06-SCAN] engineHub.invoke success=${engineResult.success}`);
  if (!engineResult.success) {
    logger.warn('[CE06-SCAN] engineHub.invoke returned error');
  }

  if (!engineResult.success) {
    throw new Error(`SCAN failed: ${engineResult.error?.message}`);
  }

  const novelSource = await prisma.novel.findUnique({
    where: { projectId },
  });
  if (!novelSource) throw new Error('NovelSource not found');

  const chunks = (engineResult.output as any).volumes || [];

  // P6-1-5: 计算 totalCharCount（用于计费）
  const totalCharCount = rawText.length;
  logger.log(`[CE06-SCAN] Total char count: ${totalCharCount}`);

  // 写入 Novel 表（用于审计）
  await prisma.novel.update({
    where: { id: novelSource.id },
    data: { characterCount: totalCharCount },
  });

  // [P6-0 Fix] Race Condition: Collect jobs inside TX, dispatch AFTER TX commit.
  const jobsToDispatch: any[] = [];

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

      // Collect for dispatch
      jobsToDispatch.push({
        jobType: JobType.CE06_NOVEL_PARSING,
        projectId,
        organizationId,
        payload: {
          phase: 'CHUNK_PARSE',
          chapterId: chapter.id,
          raw_text: rawText.substring(chunk.start_offset, chunk.end_offset), // extract from loaded rawText
          rawText: rawText.substring(chunk.start_offset, chunk.end_offset), // 兼容仍读取 rawText 的旧下游
          traceId,
          projectId,
          pipelineRunId: job.payload?.pipelineRunId,
          rootJobId: job.payload?.rootJobId || job.id, // Propagate rootJobId for Orchestrator chain
          charCount: totalCharCount, // P6-1-5: 传递 charCount 用于计费
          model: 'gemini-2.0-flash', // Bypass gemini-1.5-flash quota using stable 2.0
        },
        parentJobId: job.id,
      });
    }
  });

  // [P6-0 Fix] Dispatch jobs *outside* transaction to ensure chapters are visible
  logger.log(`[CE06-SCAN] Dispatching ${jobsToDispatch.length} CHUNK jobs...`);
  for (const jobParams of jobsToDispatch) {
    await apiClient.createJob(jobParams);
  }

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
  const chapterText = payload.raw_text || payload.rawText;
  const traceId = requireNonEmptyString(payload.traceId ?? job.traceId, 'CE06_CHUNK', 'traceId');
  const pipelineRunId = requireNonEmptyString(payload.pipelineRunId, 'CE06_CHUNK', 'pipelineRunId');
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

  // B2: 提取 Project 级别的全局 Style Prompt
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { stylePrompt: true, styleGuide: true },
  });

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
      model: payload.model, // Passthrough model
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

  const scenes = asRecordArray((ce06Result.output as JsonRecord | undefined)?.scenes).filter(
    (scene) => asNonEmptyString(scene.raw_text) !== undefined
  );
  logger.log(`[CE06-PARSE] Received ${scenes.length} scenes from engine output`);

  // Step 2: 写入 raw_text 并串联 CE03/CE04
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const sceneIndex = i + 1;
      const rawText = asNonEmptyString(sc.raw_text);
      const title = asNonEmptyString(sc.title) ?? `Scene ${sceneIndex}`;

      if (!rawText) {
        throw new Error(`[CE06-PARSE] Scene ${sceneIndex} missing raw_text`);
      }

      // 先写入基础数据
      const scene = await tx.scene.upsert({
        where: { chapterId_sceneIndex: { chapterId, sceneIndex } },
        create: {
          chapterId,
          projectId,
          episodeId: chapter.episode?.id,
          sceneIndex,
          title: `${title} [${traceId}]`,
          enrichedText: rawText,
        },
        update: {
          projectId,
          episodeId: chapter.episode?.id,
          title: `${title} [${traceId}]`,
          enrichedText: rawText,
        },
      });

      // V3.0 P0-2: projectId is not a column in novel_scenes table
      // Removed projectId update logic

      // Step 3: 调用 CE03 计算密度
      logger.log(`[CE03] Computing density for scene ${scene.id}...`);
      const ce03Result = await engineHub.invoke({
        engineKey: 'ce03_visual_density',
        engineVersion: 'v1.0',
        payload: {
          structured_text: rawText,
          traceId,
          pipelineRunId,
          model: payload.model, // Passthrough model
        },
        metadata: { traceId, sceneId: scene.id },
      });

      let densityScore: number | null = null;
      if (ce03Result.success) {
        const parsedDensity = (ce03Result.output as any)?.density_score;
        if (typeof parsedDensity === 'number') {
          densityScore = parsedDensity;
        }
      }

      // Step 4: 调用 CE04 生成增强文本
      logger.log(`[CE04] Enriching scene ${scene.id}...`);
      const ce04Result = await engineHub.invoke({
        engineKey: 'ce04_visual_enrichment',
        engineVersion: 'v1.0',
        payload: {
          structured_text: rawText,
          style_prompt: project?.stylePrompt,
          style_guide: project?.styleGuide,
          traceId,
          pipelineRunId,
          model: payload.model, // Passthrough model
        },
        metadata: { traceId, sceneId: scene.id },
      });

      let enrichedText = rawText;
      if (ce04Result.success) {
        const ce04Output = ce04Result.output as any;
        enrichedText =
          asNonEmptyString(ce04Output?.enriched_text) ??
          asNonEmptyString(ce04Output?.enriched_prompt) ??
          rawText;
      }

      // Step 5: 更新完整数据
      await tx.scene.update({
        where: { id: scene.id },
        data: {
          enrichedText,
          ...(typeof densityScore === 'number' ? { visualDensityScore: densityScore } : {}),
        },
      });

      // V3.0 P0-2: 写入场景的 graph_state_snapshot
      const sceneCharacters: CharacterState[] = asRecordArray(sc.characters)
        .map((char) => {
          const name = asNonEmptyString(char.name);
          if (!name) {
            return null;
          }
          const appearance = isRecord(char.appearance) ? char.appearance : {};
          return {
            id: asNonEmptyString(char.id) ?? `char_${name}`,
            name,
            status: asNonEmptyString(char.status) ?? 'normal',
            appearance: {
              clothing: asNonEmptyString(appearance.clothing) ?? '',
              hair: asNonEmptyString(appearance.hair) ?? '',
            },
            items: asStringArray(char.items),
            injuries: asStringArray(char.injuries),
            location: asNonEmptyString(char.location) ?? '',
          };
        })
        .filter((char): char is CharacterState => char !== null);

      await snapshotScene({
        prisma: tx,
        sceneId: scene.id,
        snapshot: {
          characters: sceneCharacters,
          sceneIndex: sceneIndex,
          chapterId: chapterId,
        },
      });
    }

    // V3.0 P0-2: 提取并更新章节级角色状态到 memory_short_term
    const allCharacters: CharacterState[] = [];
    for (const sc of scenes) {
      for (const char of asRecordArray(sc.characters)) {
          const name = asNonEmptyString(char.name);
          if (!name) {
            continue;
          }
          const charId = asNonEmptyString(char.id) ?? `char_${name}`;
          const existingChar = allCharacters.find((c) => c.id === charId);
          if (!existingChar) {
            const appearance = isRecord(char.appearance) ? char.appearance : {};
            allCharacters.push({
              id: charId,
              name,
              status: asNonEmptyString(char.status) ?? 'normal',
              appearance: {
                clothing: asNonEmptyString(appearance.clothing) ?? '',
                hair: asNonEmptyString(appearance.hair) ?? '',
              },
              items: asStringArray(char.items),
              injuries: asStringArray(char.injuries),
              location: asNonEmptyString(char.location) ?? '',
            });
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

  // P6-1-5: 业务计费 - Job SUCCEEDED 时自动扣费
  const charCount = payload.charCount || 0;
  // 核心纠正：10000 字符 = 1 Credit (ceil)
  const amount = Math.ceil(charCount / 10000);

  if (amount > 0) {
    logger.log(
      `[BILLING] Job ${job.id} SUCCEEDED, charCount: ${charCount}, estimated charge for ${amount} credits (Deferred to API layer)`
    );
  }

  return { status: 'SUCCEEDED' };
}
