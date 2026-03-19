import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/**
 * Asset Service
 * CE09: Media Security 服务层
 *
 * 当前实现：
 * - secure-url / hls: 基于 storageKey 生成可访问地址
 * - watermark: 仅保留受理入口，返回未实现
 */
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

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

    let secureUrl = asset.storageKey;
    if (!secureUrl.startsWith('http')) {
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
    return this.getSecureUrl(assetId, userId);
  }

  async assertAssetAccessible(userId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { projectId: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');

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
    this.logger.warn(`Watermarking requested for ${assetId} but not implemented in MVP`);
    return {
      success: false,
      message: 'Watermarking not supported in MVP',
    };
  }
}
