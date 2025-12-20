import { Controller, Get } from '@nestjs/common';
import { EngineConfigStoreService } from './engine-config-store.service';
import { EngineAdminService } from '../engine-admin/engine-admin.service';

/**
 * S3-C.1: 公开的引擎 API（只读）
 * 用于前端筛选器和展示，不需要权限验证
 */
@Controller('engines')
export class EngineController {
  constructor(
    private readonly engineConfigStore: EngineConfigStoreService,
    private readonly engineAdminService: EngineAdminService,
  ) {}

  @Get()
  async list() {
    // 使用 EngineAdminService.list() 获取完整数据
    const engines = await this.engineAdminService.list();
    
    // 只返回公开字段，不包含敏感配置
    const publicData = engines.map((engine: any) => ({
      engineKey: engine.engineKey,
      adapterName: engine.adapterName,
      adapterType: engine.adapterType,
      defaultVersion: engine.defaultVersion,
      versions: engine.versions?.map((v: any) => ({
        versionName: v.versionName,
        enabled: v.enabled,
      })) || [],
      enabled: engine.enabled ?? true,
    }));
    
    return { success: true, data: publicData };
  }
}

