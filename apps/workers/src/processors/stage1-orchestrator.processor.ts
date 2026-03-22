import { Prisma, PrismaClient, JobType, JobStatus } from 'database';
import { ApiClient } from '../api-client';
import { WorkerJobBase } from '@scu/shared-types';
import type { ProcessorContext } from '../types/processor-context';
import { hydrateShotWithDirectorControls } from '../v3/utils/shot_field_extractor';
import { ControlNetMapper } from '../v3/render/controlnet_mapper';

export interface Stage1OrchestratorPayload {
  novelText: string;
  projectId: string;
  episodeId: string;
  pipelineRunId: string;
  traceId?: string;
}

type Stage1OrchestratorPayloadInput = Stage1OrchestratorPayload & {
  sourceText?: string;
  rawText?: string;
};

export async function processStage1OrchestratorJob(ctx: ProcessorContext) {
  const { prisma, job, logger } = ctx;
  try {
    const apiClient = ctx.apiClient;

    if (!apiClient) {
      // Gate/Worker 运行 Stage1 编排必须具备 apiClient
      throw new Error('STAGE1_API_CLIENT_MISSING');
    }
    const payload = job.payload as Stage1OrchestratorPayloadInput;

    // NOTE: novelText might be undefined if payload mismatch. handled below.
    // P1-2 FIX: projectId is in job object, NOT necessarily in payload.
    const { novelText, episodeId, pipelineRunId } = payload;
    const projectId = job.projectId;
    const organizationId = job.organizationId;
    const traceId = job.traceId || payload.traceId;

    if (!projectId) {
      throw new Error(`[Stage1] Missing projectId in job ${job.id}`);
    }
    if (!organizationId) {
      throw new Error(`[Stage1] Missing organizationId in job ${job.id}`);
    }

    logger.log(`[Stage1] Starting orchestrator for run ${pipelineRunId}`);

    // P1-2: Robust Payload Extraction (novelText vs sourceText vs rawText)
    const userText = novelText || payload.sourceText || payload.rawText || '';
    if (!userText || typeof userText !== 'string') {
      throw new Error(
        `[Stage1] Invalid payload: novelText/sourceText is missing or not a string. Keys: ${Object.keys(payload)}`
      );
    }

    // 规则：优先按双换行符切分，兜底按单换行符或直接使用全文
    let paragraphs = userText.split(/\n\n+/).filter((p: string) => p.trim().length > 5);
    if (paragraphs.length === 0) {
      paragraphs = userText.split(/\n+/).filter((p: string) => p.trim().length > 5);
    }
    if (paragraphs.length === 0 && userText.trim().length > 0) {
      paragraphs = [userText.trim()];
    }

    // 获取当前 Episode 下的 Scene 结构（Stage-1 默认将所有 Shot 放入第一个 Scene）
    // Ensure we fetch graph_state_snapshot
    let scene = await prisma.scene.findUnique({
      where: { episodeId_sceneIndex: { episodeId, sceneIndex: 1 } },
    });
    if (!scene) {
      scene = await prisma.scene.create({
        data: {
          episodeId,
          projectId,
          sceneIndex: 1,
          title: 'Main Scene',
          summary: 'Auto-generated for Stage-1',
          // P0-2: Ensure snapshot logic handled elsewhere or default null
        },
      });
    }

    // P1-2: Refactored - Resolve Reference Sheet BEFORE creating shots to enable binding
    let refSheetId: string | undefined;
    const refSheetJob = await prisma.shotJob.findFirst({
      where: { projectId, type: 'CE01_REFERENCE_SHEET', status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
      include: { engineBinding: true },
    });

    if (refSheetJob && refSheetJob.engineBinding) {
      refSheetId = refSheetJob.engineBinding.id;
    } else {
      logger.warn(
        `[Stage1] NO Reference Sheet found for project ${projectId}. Proceeding without established visual binding.`
      );
    }

    const shotIds: string[] = [];
    // MVP: 限制每章最多 10 个镜头
    const maxShots = Math.min(paragraphs.length, 10);

    for (let i = 0; i < maxShots; i++) {
      const paragraph = paragraphs[i].trim();

      // MVP P1-1: Heuristic Extraction for testing explicit columns
      const directorControls: Record<string, string> = {};
      if (paragraph.toUpperCase().includes('WIDE SHOT')) directorControls.shotType = 'WIDE SHOT';
      if (paragraph.toUpperCase().includes('CLOSE UP')) directorControls.shotType = 'CLOSE UP';
      if (paragraph.toUpperCase().includes('PAN')) directorControls.cameraMovement = 'PAN';
      if (paragraph.toUpperCase().includes('LOW ANGLE')) directorControls.cameraAngle = 'LOW ANGLE';
      if (paragraph.toUpperCase().includes('NIGHT')) directorControls.lightingPreset = 'NIGHT';

      // P1-2: Standardized ControlNet & Asset Bindings
      // Note: scene.graphStateSnapshot is typed as Json? (any)
      const { settings: controlNetSettings, bindings: assetBindings } =
        ControlNetMapper.mapFromGraphState(
          scene.graphStateSnapshot,
          refSheetId // Now resolved!
        );
      const controlNetJson = controlNetSettings as unknown as Prisma.InputJsonValue;
      const assetBindingsJson = assetBindings as unknown as Prisma.InputJsonValue;

      const shotParams = {
        prompt: paragraph.substring(0, 800),
        aspect_ratio: '16:9',
        seed: Math.floor(Math.random() * 1000000),
        engine_params: {
          steps: 20,
          guidance_scale: 7.0,
        },
        controlnet_settings: controlNetJson, // P1-2
        asset_bindings: assetBindingsJson, // P1-2
        ...directorControls,
      } as Prisma.InputJsonValue;

      const shotData = hydrateShotWithDirectorControls(
        {
          sceneId: scene.id,
          organizationId,
          index: i + 1,
          title: `Shot ${i + 1}`,
          description: paragraph.substring(0, 200),
          reviewStatus: 'APPROVED', // Stage 1 自动化流水线直接标记为已审核
          params: shotParams,
          type: 'shot',
          enrichedPrompt: paragraph, // ✅ SSOT alignment: SHOT_RENDER requires this
        },
        shotParams
      ) satisfies Prisma.ShotUncheckedCreateInput;

      const shot = await prisma.shot.upsert({
        where: {
          sceneId_index: {
            sceneId: scene.id,
            index: i + 1,
          },
        },
        update: shotData,
        create: shotData,
      });
      shotIds.push(shot.id);
    }
    logger.log(`[Stage1] Planned ${shotIds.length} shots. Ensuring Reference Sheet exists...`);
    logger.log('[Stage1] Spawning renders via API...');

    // 2. Spawn Concurrent Shot Renders
    // 核心：调用 API Client 以确保计费 (Billing) 和引擎绑定 (Engine Binding) 逻辑正确触发
    // ✅ 商业级加固：失败即FAIL，不允许吞错SUCCEEDED
    const renderJobs: string[] = [];
    for (const shotId of shotIds) {
      try {
        const renderDedupeKey = `stage1_shot_render_${shotId}_${pipelineRunId}`;
        const response = await apiClient.createJob(
          {
            jobType: JobType.SHOT_RENDER,
            traceId,
            projectId,
            organizationId,
            dedupeKey: renderDedupeKey,
            payload: {
              pipelineRunId,
              shotId,
              traceId,
              referenceSheetId: refSheetId, // E4 Compliance
              parentJobId: job.id,
            },
          },
          undefined,
          { 'x-organization-id': organizationId }
        );

        const createdJobId = response?.id ?? response?.jobId;
        if (!createdJobId) {
          logger.error(
            JSON.stringify({
            tag: 'STAGE1_CREATE_RENDER_JOB_FAILED',
            reason: 'missing_job_id_in_response',
            shotId,
            pipelineRunId,
            parentJobId: job.id,
            response,
          })
          );
          throw new Error('STAGE1_CREATE_RENDER_JOB_FAILED: missing_job_id_in_response');
        }

        renderJobs.push(createdJobId);
      } catch (error: any) {
        // ✅ 统一日志tag，并抛错中止（不允许继续）
          logger.error(
            JSON.stringify({
            tag: 'STAGE1_CREATE_RENDER_JOB_FAILED',
            shotId,
            pipelineRunId,
            parentJobId: job.id,
            error: error?.message ?? String(error),
            stack: error?.stack,
          })
          );

        // ✅ 落库FAILED状态，保证审计可查
        try {
          await prisma.shotJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              result: {
                error: {
                  code: 'STAGE1_CREATE_RENDER_JOB_FAILED',
                  message: error?.message ?? String(error),
                  shotId,
                  pipelineRunId,
                },
              },
            },
          });
        } catch (_) {
          // 即便update失败，也不能吞原始错误
        }

        throw new Error(`STAGE1_CREATE_RENDER_JOB_FAILED: ${error?.message ?? String(error)}`);
      }
    }

    // ✅ 双保险：renderJobIds为空直接FAIL（不允许空跑SUCCEEDED）
    if (!renderJobs.length) {
      logger.error(
        JSON.stringify({
        tag: 'STAGE1_RENDER_JOB_IDS_EMPTY',
        pipelineRunId,
        parentJobId: job.id,
        shotIds,
      })
      );

      try {
        await prisma.shotJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            result: {
              error: {
                code: 'STAGE1_RENDER_JOB_IDS_EMPTY',
                message: 'renderJobIds is empty; pipeline must not SUCCEED',
                pipelineRunId,
              },
            },
          },
        });
      } catch (updateError: any) {
        logger.warn(
          `[Stage1] Failed to persist STAGE1_RENDER_JOB_IDS_EMPTY status: ${updateError?.message || String(updateError)}`
        );
      }

      throw new Error('STAGE1_RENDER_JOB_IDS_EMPTY');
    }

    // 2.5 Blocking Aggregation Removed (Stage 3)
    // Orchestrator no longer waits. It exits after dispatching shots.
    // Video Render triggering is now Event-Driven (handled by API).
    logger.log(
      `[Stage1] Dispatch complete. ${renderJobs.length} shots spawned. Exiting. (Event Driven DAG enabled)`
    );

    // 3. Evidence Archiving
    logger.log(
      `[Stage-1 Evidence] Orchestration complete. pipelineRunId: ${pipelineRunId}, shots spawned: ${renderJobs.length}`
    );

    return {
      status: 'SUCCEEDED',
      output: {
        shotIds,
        renderJobIds: renderJobs,
        pipelineRunId,
      },
    };
  } catch (err: any) {
    logger.error(`[Stage1] Job FAILED: ${err.message}`);
    // Ensure we update result with error info
    try {
      await prisma.shotJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          result: {
            error: {
              message: err.message,
              stack: err.stack,
              code: 'STAGE1_FATAL_ERROR',
            },
          },
        },
      });
    } catch (updateErr) {
      logger.error('[Stage1] Failed to persist error to DB');
    }
    throw err;
  }
}
