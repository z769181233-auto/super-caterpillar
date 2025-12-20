import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertEngineInput {
  engineKey: string;
  adapterName: string;
  adapterType: string;
  config: any;
  enabled?: boolean;
  version?: string | null;
}

export interface UpdateEngineInput {
  config?: any;
  enabled?: boolean;
  version?: string | null;
  adapterName?: string;
  adapterType?: string;
}

export interface UpsertEngineVersionInput {
  versionName: string;
  config: any;
  enabled?: boolean;
  rolloutWeight?: number | null;
}

export interface UpdateEngineVersionInput {
  config?: any;
  enabled?: boolean;
  rolloutWeight?: number | null;
}

@Injectable()
export class EngineAdminService {
  constructor(private readonly prisma: PrismaService) { }

  async list(): Promise<any[]> {
    // S3-C.1: 返回包含 versions 和 defaultVersion 的完整信息
    const engines = await (this.prisma as any).engine.findMany({
      orderBy: { engineKey: 'asc' },
      include: {
        versions: {
          orderBy: { versionName: 'asc' },
        },
      },
    });

    // 格式化返回数据，确保包含所需字段
    return engines.map((engine: any) => ({
      engineKey: engine.engineKey,
      adapterName: engine.adapterName,
      adapterType: engine.adapterType,
      defaultVersion: engine.defaultVersion,
      versions: engine.versions || [],
      enabled: engine.enabled ?? true,
      config: engine.config,
      createdAt: engine.createdAt,
      updatedAt: engine.updatedAt,
    }));
  }

  async createOrReplace(input: UpsertEngineInput): Promise<any> {
    return (this.prisma as any).engine.upsert({
      where: { engineKey: input.engineKey },
      create: {
        engineKey: input.engineKey,
        adapterName: input.adapterName,
        adapterType: input.adapterType,
        config: input.config ?? {},
        enabled: input.enabled ?? true,
        version: input.version ?? null,
        // Stage3-A: 填充新字段
        code: input.engineKey,
        name: input.adapterName,
        type: input.adapterType,
        isActive: input.enabled ?? true,
      },
      update: {
        adapterName: input.adapterName,
        adapterType: input.adapterType,
        config: input.config ?? {},
        enabled: input.enabled ?? true,
        version: input.version ?? null,
        // Stage3-A: 更新新字段
        name: input.adapterName,
        type: input.adapterType,
        isActive: input.enabled ?? true,
      },
    });
  }

  async update(engineKey: string, input: UpdateEngineInput): Promise<any> {
    const existing = await (this.prisma as any).engine.findUnique({ where: { engineKey } });
    if (!existing) {
      throw new NotFoundException(`Engine not found: ${engineKey}`);
    }
    return (this.prisma as any).engine.update({
      where: { engineKey },
      data: {
        adapterName: input.adapterName ?? existing.adapterName,
        adapterType: input.adapterType ?? existing.adapterType,
        config: input.config ?? existing.config,
        enabled: input.enabled ?? existing.enabled,
        version: input.version ?? existing.version,
      },
    });
  }

  async delete(engineKey: string): Promise<void> {
    await (this.prisma as any).engine.delete({ where: { engineKey } });
  }

  async listVersions(engineKey: string): Promise<any[]> {
    const engine = await (this.prisma as any).engine.findUnique({
      where: { engineKey },
      include: { versions: true },
    });
    return engine?.versions ?? [];
  }

  async createOrUpdateVersion(engineKey: string, input: UpsertEngineVersionInput): Promise<any> {
    const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });
    if (!engine) {
      throw new NotFoundException(`Engine not found: ${engineKey}`);
    }
    return (this.prisma as any).engineVersion.upsert({
      where: { engineId_versionName: { engineId: engine.id, versionName: input.versionName } },
      create: {
        engineId: engine.id,
        versionName: input.versionName,
        config: input.config ?? {},
        enabled: input.enabled ?? true,
        rolloutWeight: input.rolloutWeight ?? null,
      },
      update: {
        config: input.config ?? {},
        enabled: input.enabled ?? true,
        rolloutWeight: input.rolloutWeight ?? null,
      },
    });
  }

  async updateVersion(engineKey: string, versionName: string, input: UpdateEngineVersionInput): Promise<any> {
    const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });
    if (!engine) throw new NotFoundException(`Engine not found: ${engineKey}`);

    const existing = await (this.prisma as any).engineVersion.findUnique({
      where: { engineId_versionName: { engineId: engine.id, versionName } },
    });
    if (!existing) throw new NotFoundException(`Engine version not found: ${engineKey}/${versionName}`);

    return (this.prisma as any).engineVersion.update({
      where: { engineId_versionName: { engineId: engine.id, versionName } },
      data: {
        config: input.config ?? existing.config,
        enabled: input.enabled ?? existing.enabled,
        rolloutWeight: input.rolloutWeight ?? existing.rolloutWeight,
      },
    });
  }

  async deleteVersion(engineKey: string, versionName: string): Promise<void> {
    const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });
    if (!engine) throw new NotFoundException(`Engine not found: ${engineKey}`);

    const isDefault = engine.defaultVersion === versionName;
    if (isDefault) {
      await (this.prisma as any).engine.update({
        where: { engineKey },
        data: { defaultVersion: null },
      });
    }

    await (this.prisma as any).engineVersion.delete({
      where: { engineId_versionName: { engineId: engine.id, versionName } },
    });
  }

  async updateDefaultVersion(engineKey: string, defaultVersion: string | null): Promise<any> {
    const engine = await (this.prisma as any).engine.findUnique({ where: { engineKey } });
    if (!engine) throw new NotFoundException(`Engine not found: ${engineKey}`);

    if (defaultVersion) {
      const ver = await (this.prisma as any).engineVersion.findUnique({
        where: { engineId_versionName: { engineId: engine.id, versionName: defaultVersion } },
      });
      if (!ver) throw new NotFoundException(`Engine version not found: ${engineKey}/${defaultVersion}`);
    }

    return (this.prisma as any).engine.update({
      where: { engineKey },
      data: { defaultVersion },
    });
  }
}

