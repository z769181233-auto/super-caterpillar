import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JobService } from '../../job/job.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Stage 1 验证钩子（仅 GATE_MODE=1 && VERIFICATION_MODE=1 生效）
 *
 * 职责：监听 PIPELINE_STAGE1_NOVEL_TO_VIDEO 作业完成，自动注入 Mock SHOT_RENDER 用于完整 DAG 验证
 *
 * 设计原则：
 * - 严格隔离：仅在 Gate 环境生效，生产环境零影响
 * - 完整上下文：补齐 pipelineRunId、episodeId、projectId 确保 DAG 可触发
 * - 强幂等：使用 dedupeKey 防止重复注入
 * - 零计费：所有 Mock 作业及其衍生作业标记 isVerification=true
 */
@Injectable()
export class Stage1VerificationHook {
  private readonly logger = new Logger(Stage1VerificationHook.name);

  constructor(
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * 监听作业成功事件
   * 触发条件：PIPELINE_STAGE1_NOVEL_TO_VIDEO 完成 && GATE_MODE=1 && VERIFICATION_MODE=1
   */
  @OnEvent('job.succeeded')
  async handleJobSucceeded(evt: any) {
    // 1. 严格环境隔离检查
    if (process.env.GATE_MODE !== '1' || process.env.VERIFICATION_MODE !== '1') {
      return;
    }

    // 2. 目标作业类型过滤
    if (evt.type !== 'PIPELINE_STAGE1_NOVEL_TO_VIDEO') {
      return;
    }

    // 3. 查询父作业完整信息（必须：获取 payload 中的 pipelineRunId）
    const parentJob = await this.prisma.shotJob.findUnique({
      where: { id: evt.id },
      select: {
        id: true,
        projectId: true,
        organizationId: true,
        traceId: true,
        shotId: true,
        episodeId: true,
        sceneId: true,
        payload: true,
      },
    });

    if (!parentJob) {
      this.logger.error(`[VerificationHook] Parent job ${evt.id} not found in database.`);
      return;
    }

    // 4. 提取必要上下文
    const parentPayload = (parentJob.payload as any) || {};
    const pipelineRunId = parentPayload.pipelineRunId || parentJob.traceId;
    const episodeId = parentPayload.episodeId || parentJob.episodeId;
    const projectId = parentPayload.projectId || parentJob.projectId;

    // 必须：pipelineRunId（DAG 聚合依赖此字段）
    if (!pipelineRunId) {
      this.logger.error(
        `[VerificationHook] Missing pipelineRunId for parentJobId=${parentJob.id}. Cannot inject Mock SHOT_RENDER.`
      );
      return;
    }

    this.logger.log(
      `[VerificationHook] PIPELINE_STAGE1 succeeded (jobId=${parentJob.id}, pipelineRunId=${pipelineRunId}). Injecting Mock SHOT_RENDER jobs.`
    );

    // 5. 注入 Mock SHOT_RENDER 作业（3 个并发验证）
    for (let i = 0; i < 3; i++) {
      const dedupeKey = `gate_shot:${parentJob.id}:${i}`;

      try {
        // 幂等检查：如果已存在则跳过
        const existing = await this.prisma.shotJob.findUnique({
          where: { dedupeKey },
        });

        if (existing) {
          this.logger.log(
            `[VerificationHook] Mock job already exists for dedupeKey=${dedupeKey}, skipping.`
          );
          continue;
        }

        // 创建 Mock SHOT_RENDER 作业（包含完整 DAG 上下文）
        await this.jobService.createCECoreJob({
          projectId: parentJob.projectId,
          organizationId: parentJob.organizationId,
          jobType: 'SHOT_RENDER' as any,
          traceId: parentJob.traceId ?? undefined,
          isVerification: true,
          dedupeKey,
          payload: {
            // 关键：pipelineRunId 用于 DAG 聚合识别
            pipelineRunId,
            projectId,
            episodeId,
            // 必需：用于后续 VIDEO_RENDER 创建时的 Shot 关联
            shotId: parentJob.shotId,
            referenceSheetId: 'gate-mock-ref-id',
            index: i,
            // 标记验证模式（便于日志追踪）
            isVerification: true,
          },
        });

        this.logger.log(
          `[VerificationHook] Injected Mock SHOT_RENDER ${i + 1}/3 with dedupeKey=${dedupeKey}, pipelineRunId=${pipelineRunId}`
        );
      } catch (err: any) {
        this.logger.error(
          `[VerificationHook] Failed to inject Mock SHOT_RENDER ${i}: ${err.message}`
        );
      }
    }

    // 6. 注入并发 AUDIO 作业（P5 Parallel Track 验证）
    const audioDedupeKey = `gate_audio:${parentJob.id}`;
    try {
      await this.jobService.createCECoreJob({
        projectId: parentJob.projectId,
        organizationId: parentJob.organizationId,
        jobType: 'AUDIO' as any,
        traceId: parentJob.traceId ?? undefined,
        isVerification: true,
        dedupeKey: audioDedupeKey,
        payload: {
          pipelineRunId,
          projectId,
          episodeId,
          audioText: 'Mock Audio Content for L2 Verification',
          isVerification: true,
        },
      });
      this.logger.log(`[VerificationHook] Injected Mock AUDIO for pipelineRunId=${pipelineRunId}`);
    } catch (err: any) {
      this.logger.error(`[VerificationHook] Failed to inject Mock AUDIO: ${err.message}`);
    }
  }
}
