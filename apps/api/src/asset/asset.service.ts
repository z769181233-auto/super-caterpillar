import { Injectable, Logger } from '@nestjs/common';

/**
 * Asset Service
 * CE09: Media Security 服务层
 *
 * 当前实现：
 * - watermark: 仅保留受理入口，返回未实现
 */
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  async addWatermark(assetId: string, userId?: string) {
    this.logger.warn(`Watermarking requested for ${assetId} but not implemented in MVP`);
    return {
      success: false,
      message: 'Watermarking not supported in MVP',
    };
  }
}
