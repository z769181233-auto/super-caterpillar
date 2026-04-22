import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JobService } from '../job/job.service';

/**
 * Shot Director Service
 * CE05: Director Control 服务层
 *
 * 当前实现：
 * - inpaint / pose: 接受请求、记录审计并返回 PENDING job 占位
 * - composeVideo: 真实创建 VIDEO_RENDER job
 */
@Injectable()
export class ShotDirectorService {
  private readonly logger = new Logger(ShotDirectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService
  ) {}

  async inpaint(shotId: string, userId?: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
    });

    if (!shot) {
      throw new NotFoundException(`Shot ${shotId} not found`);
    }

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      action: 'SHOT_INPAINT',
      resourceType: 'shot',
      resourceId: shotId,
      details: { operation: 'inpaint' },
    });

    return {
      success: true,
      data: {
        shotId,
        jobId: `inpaint-job-${shotId}`,
        status: 'PENDING',
      },
    };
  }

  async pose(shotId: string, userId?: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
    });

    if (!shot) {
      throw new NotFoundException(`Shot ${shotId} not found`);
    }

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      action: 'SHOT_POSE',
      resourceType: 'shot',
      resourceId: shotId,
      details: { operation: 'pose' },
    });

    return {
      success: true,
      data: {
        shotId,
        jobId: `pose-job-${shotId}`,
        status: 'PENDING',
      },
    };
  }

  /**
   * Stage 8: Compose Video from Scene Shots
   * 将 Scene 下的所有 Shot 对应的 Asset 拼接成视频
   */
  async composeVideo(sceneId: string, userId?: string, organizationId?: string) {
    try {
      // 1. 获取 Scene 及其所有 Shots
      const scene = await this.prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          shots: {
            orderBy: { index: 'asc' },
            include: {
              assets: {
                where: { type: 'IMAGE', status: 'GENERATED' }, // Only take generated images
                orderBy: { createdAt: 'desc' },
                take: 1, // Take the latest one
              },
            },
          },
          episode: {
            include: {
              season: {
                include: {
                  project: true,
                },
              },
            },
          },
        },
      });

      if (!scene) {
        throw new NotFoundException(`Scene ${sceneId} not found`);
      }

      // 2. 收集 Assets
      const assets: string[] = [];
      for (const shot of scene.shots) {
        if (shot.assets && shot.assets.length > 0) {
          assets.push(shot.assets[0].storageKey);
        }
      }

      if (assets.length === 0) {
        // Fail Fast logic provided in user requirement is for Novel, but applies here too
        throw new Error(`Scene ${sceneId} has no generated assets to compose`);
      }

      // 3. Create VIDEO_RENDER Job through the shared job service.
      // And payload contains `sceneId`.
      const anchorShotId = scene.shots[0].id;
      const finalProject = scene.episode?.season?.project;
      const finalOrganizationId = organizationId || finalProject?.organizationId;
      const finalProjectId = finalProject?.id;

      if (!finalOrganizationId || !finalProjectId) {
        throw new Error(`Cannot determine project/org for scene ${sceneId}`);
      }

      const effectiveUserId = userId || finalProject?.ownerId;
      if (!effectiveUserId) {
        throw new Error(`Cannot determine user for scene ${sceneId}`);
      }

      const traceId = `video_compose_${randomUUID()}`;
      const job = await this.jobService.ensureVideoRenderJob(
        anchorShotId,
        assets,
        traceId,
        effectiveUserId,
        finalOrganizationId
      );

      await this.auditLogService.record({
        userId,
        action: 'VIDEO_RENDER_TRIGGERED',
        resourceType: 'job',
        resourceId: job.id,
        details: { sceneId, assetsCount: assets.length },
      });

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          assetsCount: assets.length,
        },
      };
    } catch (e) {
      this.logger.error('Failed to compose video', e);
      throw e;
    }
  }
}
