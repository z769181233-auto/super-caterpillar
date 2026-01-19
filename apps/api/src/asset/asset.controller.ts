import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';
import { AssetService } from './asset.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * Asset Controller
 * 提供 CE09 (Media Security) 标准 API
 *
 * 功能：
 * - GET /assets/:assetId/secure-url: 获取安全签名 URL
 * - GET /assets/:assetId/hls: 获取 HLS 播放列表
 * - POST /assets/:assetId/watermark: 添加水印
 */
@Controller('assets')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  /**
   * GET /assets/:assetId/secure-url
   * CE09: 获取安全签名 URL
   */
  /*
  @Get(':assetId/secure-url')
  @RequireSignature()
  @AuditAction(AuditActions.ASSET_ACCESS)
  @HttpCode(HttpStatus.OK)
  async getSecureUrl(@Param('assetId') assetId: string, @CurrentUser() user: any) {
    return this.assetService.getSecureUrl(assetId, user?.id);
  }

  @Get(':assetId/hls')
  @RequireSignature()
  @AuditAction(AuditActions.ASSET_ACCESS)
  @HttpCode(HttpStatus.OK)
  async getHls(@Param('assetId') assetId: string, @CurrentUser() user: any) {
    return this.assetService.getHls(assetId, user?.id);
  }
  */

  /**
   * POST /assets/:assetId/watermark
   * CE09: 添加水印
   */
  @Post(':assetId/watermark')
  @RequireSignature() // CE10: 高成本接口，强制签名验证
  @AuditAction(AuditActions.ASSET_WATERMARK)
  @HttpCode(HttpStatus.ACCEPTED)
  async addWatermark(@Param('assetId') assetId: string, @CurrentUser() user: any) {
    return this.assetService.addWatermark(assetId, user?.id);
  }
}
