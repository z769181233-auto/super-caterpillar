import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RequireSignature } from '../security/api-security/api-security.decorator';

/**
 * 资产交付控制器
 * 提供 HLS 播放列表和带签名的下载链接
 */
@Controller('assets')
@UseGuards(JwtOrHmacGuard)
export class AssetDeliveryController {
  private readonly logger = new Logger(AssetDeliveryController.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  /**
   * V1.1 Allied Endpoint: 获取带安全签名的资产载链接
   * GET /api/assets/:id/secure-url
   */
  /**
   * V1.1 Allied Endpoint: 获取带安全签名的资产载链接
   * GET /api/assets/:id/secure-url
   */
  @Get(':id/secure-url')
  @Get(':id/signed-url') // Alias for compatibility
  @RequireSignature()
  async getSecureUrl(
    @Param('id') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        // 这里的权限逻辑可以根据业务需求扩展，目前暂定只要是该组织的资产即可
        project: {
          organizationId,
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!asset.signedUrl) {
      throw new NotFoundException('Signed URL not generated for this asset yet');
    }

    await this.auditLogService.record({
      userId: user.userId,
      orgId: organizationId,
      action: 'ASSET_SIGNED_URL_ACCESS',
      resourceType: 'asset',
      resourceId: assetId,
      details: {
        type: asset.type,
      },
    });

    // V1.1 Spec Response Format
    return {
      success: true,
      data: {
        signed_url: asset.signedUrl, // V1.1: snake_case
        signedUrl: asset.signedUrl, // Compatibility: Deprecated
        url: asset.signedUrl, // Compatibility: Deprecated
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        expire: 3600, // V1.1: Seconds (Strict)
      },
    };
  }

  /**
   * 获取 HLS 播放地址
   * GET /api/assets/:id/hls
   */
  @Get(':id/hls')
  @RequireSignature()
  async getHls(
    @Param('id') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        project: {
          organizationId,
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!asset.hlsPlaylistUrl) {
      throw new NotFoundException('HLS playlist not generated for this asset yet');
    }

    await this.auditLogService.record({
      userId: user.userId,
      orgId: organizationId,
      action: 'ASSET_HLS_ACCESS',
      resourceType: 'asset',
      resourceId: assetId,
    });

    return {
      success: true,
      data: {
        playlistUrl: asset.hlsPlaylistUrl,
        watermarkMode: asset.watermarkMode,
        fingerprintId: asset.fingerprintId,
      },
    };
  }
}
