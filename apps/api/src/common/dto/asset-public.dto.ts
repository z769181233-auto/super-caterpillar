import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { FeatureFlagService } from '../../feature-flag/feature-flag.service';

/**
 * AssetPublicDto - Stage 11 Signed URL 兼容策略
 *
 * 永远返回 storageKey（兼容期）
 * 仅在 FEATURE_SIGNED_URL_ENFORCED=true 时返回 signedUrl/signedUrlExpiresAt
 * 批量策略：只对 VIDEO + GENERATED 签名
 */

export interface SignedUrlService {
  generate(
    storageKey: string,
    tenantId: string,
    userId: string,
    ttlMinutes?: number
  ): Promise<{ url: string; expiresAt: Date }>;
}

export class AssetPublicDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: 'IMAGE' | 'VIDEO' | 'MODEL';

  @ApiProperty()
  status: 'GENERATED' | 'LOCKED' | 'PUBLISHED';

  @ApiProperty({ description: '向后兼容字段（至少保留到 Stage 12）' })
  storageKey: string;

  @ApiPropertyOptional({ description: '签名 URL（需 Feature Flag）' })
  signedUrl?: string;

  @ApiPropertyOptional({ description: '签名 URL 过期时间（ISO 8601）' })
  signedUrlExpiresAt?: string;

  /**
   * 从 Asset 实体转换为 AssetPublicDto
   *
   * @param asset - Asset 实体
   * @param featureFlagService - Feature Flag 服务
   * @param signedUrlService - Signed URL 服务
   * @param context - 上下文（租户ID、用户ID）
   * @returns AssetPublicDto 实例
   */
  static async fromAsset(
    asset: {
      id: string;
      type: 'IMAGE' | 'VIDEO' | 'MODEL';
      status: 'GENERATED' | 'LOCKED' | 'PUBLISHED';
      storageKey: string;
    },
    featureFlagService: FeatureFlagService,
    signedUrlService: SignedUrlService,
    context: { tenantId: string; userId: string }
  ): Promise<AssetPublicDto> {
    const dto = new AssetPublicDto();
    dto.id = asset.id;
    dto.type = asset.type;
    dto.status = asset.status;
    dto.storageKey = asset.storageKey; // 永远返回

    // 仅在 flag ON 且符合条件时生成签名 URL
    if (featureFlagService.isEnabled('FEATURE_SIGNED_URL_ENFORCED')) {
      if (asset.type === 'VIDEO' && asset.status === 'GENERATED') {
        try {
          const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '10', 10);
          const { url, expiresAt } = await signedUrlService.generate(
            asset.storageKey,
            context.tenantId,
            context.userId,
            ttlMinutes
          );
          dto.signedUrl = url;
          dto.signedUrlExpiresAt = expiresAt.toISOString();
        } catch (error) {
          // 签名失败不阻断主流程，仅记录日志
          new Logger('AssetPublicDto').error(
            `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return dto;
  }
}
