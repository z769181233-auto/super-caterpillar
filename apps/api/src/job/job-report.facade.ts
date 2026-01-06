import { Injectable, Logger } from '@nestjs/common';
import { JobService } from './job.service';
import { QualityMetricsWriter } from '../quality/quality-metrics.writer';
import { PrismaService } from '../prisma/prisma.service';
import { JobType as JobTypeEnum, JobStatus as JobStatusEnum } from 'database';
import { DirectorConstraintSolverService } from '../shot-director/director-solver.service';

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
    private readonly jobService: JobService,
    private readonly qualityMetricsWriter: QualityMetricsWriter,
    private readonly prisma: PrismaService,
    private readonly directorSolver: DirectorConstraintSolverService,
  ) { }

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
              `QualityMetrics written for ${job.type} job ${job.id}, project ${job.projectId}`,
            );
          } else {
            this.logger.warn(
              `QualityMetrics write skipped for ${job.type} job ${job.id} (no metrics found)`,
            );
          }
        }
      } catch (error: any) {
        // 质量指标写入失败不影响主流程
        this.logger.error(
          `Failed to write QualityMetrics for job ${params.jobId}: ${error.message}`,
          error.stack,
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
              type: payload.type ?? 'DEFAULT',  // 添加required字段
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
                data: JSON.parse(JSON.stringify(validation)) as any,  // 序列化
              },
              update: {
                engineKey: 'CE05_DIRECTOR',
                confidence: validation.violations.length === 0 ? 1.0 : 0.5,
                data: JSON.parse(JSON.stringify(validation)) as any,  // 序列化
              },
            });

            this.logger.log(`[CE05] ShotPlanning upserted shotId=${shotId} isValid=${validation.isValid} violations=${validation.violations.length}`);
          }
        } catch (e: any) {
          this.logger.warn(`[CE05] failed (non-blocking) jobId=${updatedJob.id} err=${e?.message ?? e}`);
        }
      }
    }

    // 3. Stage 8: Trigger Video Render & Create Asset (Structure -> Video Loop)
    if (
      updatedJob &&
      updatedJob.status === JobStatusEnum.SUCCEEDED
    ) {
      try {
        // Case A: SHOT_RENDER finished -> Trigger VIDEO_RENDER
        if (updatedJob.type === JobTypeEnum.SHOT_RENDER) {
          const frameKeys = params.result?.frameKeys || params.result?.assets || [];
          if (frameKeys.length > 0) {
            await this.jobService.ensureVideoRenderJob(
              updatedJob.shotId,
              frameKeys,
              updatedJob.traceId || `trace-${updatedJob.id}`,
              params.userId || 'system',
              updatedJob.organizationId
            );
            this.logger.log(`[JobReportFacade] Triggered VIDEO_RENDER for Shot ${updatedJob.shotId}`);
          }
        }

        // Case B: VIDEO_RENDER finished -> Create Asset in DB
        // This ensures the UI (ProjectStructureService) can see the video.
        if (updatedJob.type === JobTypeEnum.VIDEO_RENDER && updatedJob.shotId) {
          const videoUrl = params.result?.videoUrl || params.result?.storageKey;
          if (videoUrl) {
            // Stage 10 Refactor: Business Key Idempotency (One Asset per Type per Owner)
            // Stage 10 Refactor: Business Key Idempotency (One Asset per Type per Owner)
            // Unique Key: @@unique([ownerType, ownerId, type])
            await this.prisma.asset.upsert({
              where: {
                ownerType_ownerId_type: {
                  ownerType: 'SHOT',
                  ownerId: updatedJob.shotId,
                  type: 'VIDEO'
                }
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
                createdByJobId: updatedJob.id // Update latest job ID
              }
            });
            this.logger.log(`[JobReportFacade] Created Video Asset for Shot ${updatedJob.shotId}`);
          } else {
            this.logger.warn(`[JobReportFacade] VIDEO_RENDER succeeded but no videoUrl/storageKey found in result.`);
          }
        }

      } catch (e: any) {
        this.logger.error(`[JobReportFacade] Failed to handle Job Success Side-effects: ${e.message}`, e.stack);
      }
    }

    return updatedJob;
  }
}
