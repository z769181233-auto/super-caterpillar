import { Injectable, Logger, Inject } from '@nestjs/common';
import { JobService } from './job.service';
import { QualityMetricsWriter } from '../quality/quality-metrics.writer';
import { PrismaService } from '../prisma/prisma.service';
import { JobType as JobTypeEnum, JobStatus as JobStatusEnum } from 'database';
import { DirectorConstraintSolverService } from '../shot-director/director-solver.service';
import { CostLedgerService } from '../cost/cost-ledger.service';

/**
 * Job Report Facade
 * Worker 回报入口的 Facade 层
 *
 * 规则：
 * - 封装 reportJobResult 调用
 * - CE03/CE04 完成后自动触发 QualityMetrics 写入
 * - 不改冻结区（job.service.ts）
 */
@Injectable()
export class JobReportFacade {
  private readonly logger = new Logger(JobReportFacade.name);

  constructor(
    @Inject(JobService)
    private readonly jobService: JobService,
    @Inject(QualityMetricsWriter)
    private readonly qualityMetricsWriter: QualityMetricsWriter,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(DirectorConstraintSolverService)
    private readonly directorSolver: DirectorConstraintSolverService,
    @Inject(CostLedgerService)
    private readonly costLedger: CostLedgerService
  ) {}

  /**
   * PLAN-1 SSOT: Normalize storage key (remove path pollution)
   *
   * Rules:
   * - Remove absolute paths (starts with /)
   * - Remove .runtime/ prefix
   * - Remove apps/workers/.runtime/ prefix
   * - Extract from last occurrence of assets/ or videos/
   * - FAIL if no assets/ or videos/ found (prevent silent corruption)
   */
  private normalizeStorageKey(key: string): string {
    if (!key) return key;

    // If contains apps/workers/.runtime/: extract from assets/ or videos/
    if (key.includes('apps/workers/.runtime/') || key.includes('.runtime/')) {
      const assetsIdx = key.lastIndexOf('assets/');
      const videosIdx = key.lastIndexOf('videos/');
      const startIdx = Math.max(assetsIdx, videosIdx);

      if (startIdx !== -1) {
        const normalized = key.substring(startIdx);
        this.logger.log(`[NormalizeKey] Stripped pollution: "${key}" -> "${normalized}"`);
        return normalized;
      } else {
        throw new Error(`[NormalizeKey] REJECT: No assets/ or videos/ found in key: ${key}`);
      }
    }

    // If absolute path: same extraction logic
    if (key.startsWith('/')) {
      const assetsIdx = key.lastIndexOf('assets/');
      const videosIdx = key.lastIndexOf('videos/');
      const startIdx = Math.max(assetsIdx, videosIdx);

      if (startIdx !== -1) {
        const normalized = key.substring(startIdx);
        this.logger.log(`[NormalizeKey] Stripped absolute path: "${key}" -> "${normalized}"`);
        return normalized;
      } else {
        throw new Error(`[NormalizeKey] REJECT: Absolute path without assets/ or videos/: ${key}`);
      }
    }

    // Already clean (assets/... or videos/...)
    return key;
  }

  /**
   * 处理 Job 回报（Facade 层）
   *
   * @param params 回报参数
   * @returns Job 更新结果
   */
  async handleReport(params: {
    jobId: string;
    status: string;
    result?: any;
    errorMessage?: string;
    userId?: string;
    apiKeyId?: string;
    ip?: string;
    userAgent?: string;
    hmacMeta?: { nonce?: string; signature?: string; hmacTimestamp?: string };
    attempts?: number;
  }) {
    // 1. 先调用原逻辑（不改冻结区）
    const updatedJob = await this.jobService.reportJobResult(
      params.jobId,
      params.status as any,
      params.result,
      params.errorMessage,
      params.userId,
      params.apiKeyId,
      params.ip,
      params.userAgent,
      params.hmacMeta,
      params.attempts
    );

    // 2. 如果是 CE03/CE04 且成功，触发质量闭环写入
    if (
      updatedJob &&
      (updatedJob.type === JobTypeEnum.CE03_VISUAL_DENSITY ||
        updatedJob.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT) &&
      updatedJob.status === JobStatusEnum.SUCCEEDED
    ) {
      try {
        const job = await this.prisma.shotJob.findUnique({
          where: { id: params.jobId },
          select: {
            id: true,
            type: true,
            projectId: true,
            traceId: true,
            payload: true,
          },
        });

        if (job) {
          const success = await this.qualityMetricsWriter.writeQualityMetrics({
            jobId: job.id,
            jobType: job.type,
            projectId: job.projectId,
            traceId: job.traceId || undefined,
            result: params.result || (job.payload as any)?.result,
          });

          if (success) {
            this.logger.log(
              `QualityMetrics written for ${job.type} job ${job.id}, project ${job.projectId}`
            );
          } else {
            this.logger.warn(
              `QualityMetrics write skipped for ${job.type} job ${job.id} (no metrics found)`
            );
          }
        }
      } catch (error: any) {
        // 质量指标写入失败不影响主流程
        this.logger.error(
          `Failed to write QualityMetrics for job ${params.jobId}: ${error.message}`,
          error.stack
        );
      }

      // P0-3: CE05 Director Control (non-blocking)
      if (updatedJob.type === JobTypeEnum.CE04_VISUAL_ENRICHMENT) {
        try {
          // 1) 取 shotId（防御性）
          const payload: any = updatedJob.payload ?? {};
          const shotId: string | undefined = payload.shotId ?? (updatedJob as any).shotId;

          if (!shotId) {
            this.logger.warn(`[CE05] skip: missing shotId jobId=${updatedJob.id}`);
          } else {
            // 2) 调用约束验证器
            const shotInput = {
              id: shotId,
              type: payload.type ?? 'DEFAULT', // 添加required字段
              params: {
                durationSec: payload.durationSec ?? 5,
                prompt: payload.prompt ?? '',
                motion: payload.motion ?? 'NONE',
              },
            };
            const validation = this.directorSolver.validateShot(shotInput);

            // 3) Upsert 写入 shot_plannings（幂等，序列化JSON）
            await this.prisma.shotPlanning.upsert({
              where: { shotId },
              create: {
                shotId,
                engineKey: 'CE05_DIRECTOR',
                engineVersion: null,
                confidence: validation.violations.length === 0 ? 1.0 : 0.5,
                data: JSON.parse(JSON.stringify(validation)) as any, // 序列化
              },
              update: {
                engineKey: 'CE05_DIRECTOR',
                confidence: validation.violations.length === 0 ? 1.0 : 0.5,
                data: JSON.parse(JSON.stringify(validation)) as any, // 序列化
              },
            });

            this.logger.log(
              `[CE05] ShotPlanning upserted shotId=${shotId} isValid=${validation.isValid} violations=${validation.violations.length}`
            );
          }
        } catch (e: any) {
          this.logger.warn(
            `[CE05] failed (non-blocking) jobId=${updatedJob.id} err=${e?.message ?? e}`
          );
        }
      }
    }

    // 3. CE01: Reference Sheet Asset Binding
    if (
      updatedJob &&
      updatedJob.type === JobTypeEnum.CE01_REFERENCE_SHEET &&
      updatedJob.status === JobStatusEnum.SUCCEEDED
    ) {
      try {
        // 1) 提取生成的资产 keys
        const assetKeys = params.result?.assets || params.result?.assetKeys || [];
        const characterId = (updatedJob.payload as any)?.characterId;
        const fingerprint = (updatedJob.payload as any)?.fingerprint;

        if (assetKeys.length > 0) {
          // 2) SECURITY: 精确定位 binding（禁止 updateMany），并使用 merge 语义更新 metadata
          const binding = await this.prisma.jobEngineBinding.findFirst({
            where: {
              jobId: updatedJob.id,
              engineKey: 'character_visual',
            },
          });

          if (!binding) {
            this.logger.warn(
              `[CE01] No binding found for job ${updatedJob.id}, skipping asset binding`
            );
          } else {
            // 3) Merge metadata（保留已有字段，防止覆盖）
            const oldMetadata = (binding.metadata as any) || {};
            const nextMetadata = {
              ...oldMetadata,
              characterId,
              fingerprint,
              artifacts: assetKeys,
              completedAt: new Date().toISOString(),
            };

            // 4) 精确更新（by binding.id）
            await this.prisma.jobEngineBinding.update({
              where: { id: binding.id },
              data: { metadata: nextMetadata as any },
            });

            this.logger.log(
              `[CE01] Merged metadata for binding ${binding.id}, artifacts: ${assetKeys.length}`
            );
          }
        }
      } catch (e: any) {
        this.logger.error(
          `[CE01] Failed to update JobEngineBinding metadata: ${e.message}`,
          e.stack
        );
      }
    }

    // 4. Stage 8: Trigger Video Render & Create Asset (Structure -> Video Loop)
    if (updatedJob && updatedJob.status === JobStatusEnum.SUCCEEDED) {
      try {
        // Case A: SHOT_RENDER finished -> Trigger VIDEO_RENDER
        if (updatedJob.type === JobTypeEnum.SHOT_RENDER && updatedJob.shotId) {
          const rawFrameKeys = params.result?.frameKeys || params.result?.assets || [];

          // PLAN-1: Normalize frameKeys to pure storageKeys (remove .runtime/apps/workers pollution)
          const frameKeys = rawFrameKeys.map((key: string) => this.normalizeStorageKey(key));

          if (frameKeys.length > 0) {
            await this.jobService.ensureVideoRenderJob(
              updatedJob.shotId,
              frameKeys,
              updatedJob.traceId || `trace-${updatedJob.id}`,
              params.userId || 'system',
              updatedJob.organizationId,
              updatedJob.isVerification || false // 继承 SHOT_RENDER 的验证标记
            );
            this.logger.log(
              `[JobReportFacade] Triggered VIDEO_RENDER for Shot ${updatedJob.shotId}, isVerification=${updatedJob.isVerification}`
            );
          }
        }

        // Case B: VIDEO_RENDER finished -> Create Asset in DB
        // This ensures the UI (ProjectStructureService) can see the video.
        if (updatedJob.type === JobTypeEnum.VIDEO_RENDER && updatedJob.shotId) {
          // P0-2: Accept outputKey (from Worker), storageKey or videoUrl
          const videoUrl =
            params.result?.outputKey || params.result?.storageKey || params.result?.videoUrl;
          if (videoUrl) {
            // Stage 10 Refactor: Business Key Idempotency (One Asset per Type per Owner)
            // Stage 10 Refactor: Business Key Idempotency (One Asset per Type per Owner)
            // Unique Key: @@unique([ownerType, ownerId, type])
            await this.prisma.asset.upsert({
              where: {
                ownerType_ownerId_type: {
                  ownerType: 'SHOT',
                  ownerId: updatedJob.shotId,
                  type: 'VIDEO',
                },
              },
              create: {
                projectId: updatedJob.projectId,
                ownerType: 'SHOT',
                ownerId: updatedJob.shotId,
                type: 'VIDEO',
                status: 'GENERATED',
                storageKey: videoUrl,
                createdByJobId: updatedJob.id,
              },
              update: {
                storageKey: videoUrl, // Explicitly update storageKey
                status: 'GENERATED',
                createdByJobId: updatedJob.id, // Update latest job ID
              },
            });
            this.logger.log(`[JobReportFacade] Created Video Asset for Shot ${updatedJob.shotId}`);
          } else {
            this.logger.warn(
              `[JobReportFacade] VIDEO_RENDER succeeded but no videoUrl/storageKey found in result.`
            );
          }
        }
      } catch (e: any) {
        this.logger.error(
          `[JobReportFacade] Failed to handle Job Success Side-effects: ${e.message}`,
          e.stack
        );
      }
    }

    // 5. Case C: TIMELINE_PREVIEW finished -> Record Billing (Commercial Grade)
    if (
      updatedJob &&
      updatedJob.type === JobTypeEnum.TIMELINE_PREVIEW &&
      updatedJob.status === JobStatusEnum.SUCCEEDED
    ) {
      try {
        const metrics = params.result?.metrics || {};
        const costAmount = metrics.cost || 0.05;
        const project = await this.prisma.project.findUnique({
          where: { id: updatedJob.projectId },
          select: { ownerId: true },
        });

        await this.costLedger.recordFromEvent({
          userId: project?.ownerId || params.userId || 'system',
          projectId: updatedJob.projectId,
          jobId: updatedJob.id,
          jobType: updatedJob.type,
          engineKey: 'ce11',
          costAmount,
          billingUnit: 'job',
          quantity: 1,
          metadata: metrics,
        });
      } catch (e: any) {
        this.logger.error(
          `[Billing] Failed to record CE11 cost for job ${updatedJob.id}: ${e.message}`
        );
      }
    }

    return updatedJob;
  }
}
