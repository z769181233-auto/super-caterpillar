import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  EngineAdminService,
  UpsertEngineInput,
  UpdateEngineInput,
  UpsertEngineVersionInput,
  UpdateEngineVersionInput,
} from './engine-admin.service';
import { Permissions } from '../auth/permissions.decorator';
import { SystemPermissions } from '../permission/permission.constants';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

@Controller('admin/engines')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class EngineAdminController {
  constructor(private readonly service: EngineAdminService) { }

  @Get()
  @Permissions(SystemPermissions.AUTH)
  async list() {
    const data = await this.service.list();
    return { success: true, data };
  }

  // S3-C.1: 公开的引擎列表端点（用于前端筛选器，只读）
  @Get('public')
  async listPublic() {
    const data = await this.service.list();
    // 只返回公开字段，不包含敏感配置
    const publicData = data.map((engine: any) => ({
      engineKey: engine.engineKey,
      adapterName: engine.adapterName,
      adapterType: engine.adapterType,
      defaultVersion: engine.defaultVersion,
      versions: engine.versions?.map((v: any) => ({
        versionName: v.versionName,
        enabled: v.enabled,
      })) || [],
      enabled: engine.enabled,
    }));
    return { success: true, data: publicData };
  }

  @Post()
  @Permissions(SystemPermissions.AUTH)
  async createOrReplace(@Body() body: UpsertEngineInput) {
    const engine = await this.service.createOrReplace(body);
    return { success: true, data: engine };
  }

  @Patch(':key')
  @Permissions(SystemPermissions.AUTH)
  async update(@Param('key') key: string, @Body() body: UpdateEngineInput) {
    const engine = await this.service.update(key, body);
    return { success: true, data: engine };
  }

  @Delete(':key')
  @Permissions(SystemPermissions.AUTH)
  async remove(@Param('key') key: string) {
    await this.service.delete(key);
    return { success: true };
  }

  // 版本管理
  @Get(':key/versions')
  @Permissions(SystemPermissions.AUTH)
  async listVersions(@Param('key') key: string) {
    const data = await this.service.listVersions(key);
    return { success: true, data };
  }

  @Post(':key/versions')
  @Permissions(SystemPermissions.AUTH)
  async createOrUpdateVersion(@Param('key') key: string, @Body() body: UpsertEngineVersionInput) {
    const data = await this.service.createOrUpdateVersion(key, body);
    return { success: true, data };
  }

  @Patch(':key/versions/:versionName')
  @Permissions(SystemPermissions.AUTH)
  async updateVersion(
    @Param('key') key: string,
    @Param('versionName') versionName: string,
    @Body() body: UpdateEngineVersionInput,
  ) {
    const data = await this.service.updateVersion(key, versionName, body);
    return { success: true, data };
  }

  @Delete(':key/versions/:versionName')
  @Permissions(SystemPermissions.AUTH)
  async deleteVersion(@Param('key') key: string, @Param('versionName') versionName: string) {
    await this.service.deleteVersion(key, versionName);
    return { success: true };
  }

  @Patch(':key/default-version')
  @Permissions(SystemPermissions.AUTH)
  async updateDefaultVersion(@Param('key') key: string, @Body() body: { defaultVersion: string | null }) {
    const data = await this.service.updateDefaultVersion(key, body.defaultVersion ?? null);
    return { success: true, data };
  }
}

