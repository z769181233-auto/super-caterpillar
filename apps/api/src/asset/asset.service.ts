import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/**
 * Asset Service
 * CE09: Media Security 服务层
 *
 * TODO: 实现真实逻辑
 * - secure-url: 生成带签名的临时访问 URL
 * - hls: 生成 HLS 播放列表（如果未生成则触发生成）
 * - watermark: 添加可见/不可见水印
 */
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

  /**
   * MVP Implementation of Secure URL
   * In MVP, we use local file serving or direct S3 URL signing.
   * For this stage, we assume local file path stored in storageKey and return a served URL.
   */
  async getSecureUrl(assetId: string, userId?: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    if (userId) {
      // Permission check MVP: Ensure user belongs to the project of the asset
      await this.assertAssetAccessible(userId, assetId);
    }

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      action: 'ASSET_ACCESS',
      resourceType: 'asset',
      resourceId: assetId,
      details: { operation: 'getSecureUrl' },
    });

    // MVP: If storageKey starts with http, return it directly.
    // If it's a local path, assume a static serve prefix (e.g. /uploads)
    let secureUrl = asset.storageKey;
    if (!secureUrl.startsWith('http')) {
      // Assume local dev environment
      secureUrl = `http://localhost:3000/uploads/${asset.storageKey}`;
    }

    return {
      success: true,
      data: {
        assetId,
        secureUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry (P1-HARD)
      },
    };
  }

  async getHls(assetId: string, userId?: string) {
    // MVP: Delegate to getSecureUrl logic for now, assuming storageKey points to m3u8 if it's HLS
    return this.getSecureUrl(assetId, userId);
  }

  async assertAssetAccessible(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { projectId: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // Simple Project Membership check
    // This assumes ProjectService or similar logic exists, or we query DB directly
    const member = await this.prisma.projectMember.findFirst({
      where: {
        userId,
        projectId: asset.projectId,
      },
    });

    // Also check ownership if not a member (e.g. project owner)
    const project = await this.prisma.project.findUnique({
      where: { id: asset.projectId },
    });

    if (!member && project?.ownerId !== userId) {
      throw new ForbiddenException('Access denied to this asset');
    }
    return true;
  }

  async addWatermark(assetId: string, userId?: string) {
    // Stage 4 MVP: Not implementing actual watermarking yet, but logging the request
    this.logger.warn(`Watermarking requested for ${assetId} but not implemented in MVP`);
    return {
      success: false,
      message: 'Watermarking not supported in MVP',
    };
  }
}
