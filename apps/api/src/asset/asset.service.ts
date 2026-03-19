import { Injectable, Logger } from '@nestjs/common';
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

  async addWatermark(assetId: string, userId?: string) {
    this.logger.warn(`Watermarking requested for ${assetId} but not implemented in MVP`);
    return {
      success: false,
      message: 'Watermarking not supported in MVP',
    };
  }
}
