import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// 从项目根目录解析路径（兼容源码和编译后运行）
// process.cwd() 在 dev 模式下是 apps/api，需要向上查找项目根
const findProjectRoot = (): string => {
  let current = __dirname;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  // fallback: 假设从 apps/api 运行，向上两级到项目根
  return path.resolve(__dirname, '../../../..');
};

const projectRoot = findProjectRoot();
const enginesJsonPath = path.join(projectRoot, 'apps/api/config/engines.json');
const enginesJson = JSON.parse(fs.readFileSync(enginesJsonPath, 'utf-8'));
type EngineJsonConfig = (typeof enginesJson)['engines'][number];

/**
 * EngineConfigStoreService
 * - 从数据库读取 Engine 记录
 * - 提供 DB > JSON > Version 合并能力（默认行为保持不变）
 */
@Injectable()
export class EngineConfigStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEngineKey(engineKey: string): Promise<any | null> {
    return (this.prisma as any).engine?.findUnique({ where: { engineKey } }) ?? null;
  }

  async findVersion(engineKey: string, versionName: string): Promise<any | null> {
    const engine = await (this.prisma as any).engine?.findUnique({
      where: { engineKey },
      include: { versions: true },
    });
    if (!engine) return null;
    return engine.versions?.find((v: any) => v.versionName === versionName) ?? null;
  }

  async listVersions(engineKey: string): Promise<any[]> {
    const engine = await (this.prisma as any).engine?.findUnique({
      where: { engineKey },
      include: { versions: true },
    });
    return engine?.versions ?? [];
  }

  /**
   * 列出全部引擎（用于后台管理或 UI 展示）
   */
  async listAllEngines(): Promise<any[]> {
    if (!(this.prisma as any).engine) return [];
    return (this.prisma as any).engine.findMany({ orderBy: { engineKey: 'asc' } });
  }

  /**
   * 合并 DB 与 JSON 配置
   * 优先级：DB > JSON
   * 约束：default_novel_analysis 默认行为保持 JSON 不变（调用方可在外部控制）
   */
  mergeConfig(dbEngine: any | null, jsonConfig?: EngineJsonConfig) {
    const merged: any = {
      engineKey: jsonConfig?.engineKey ?? dbEngine?.engineKey,
      adapterName: jsonConfig?.adapterName ?? dbEngine?.adapterName,
      adapterType: jsonConfig?.adapterType ?? dbEngine?.adapterType,
      enabled: dbEngine?.enabled ?? jsonConfig?.enabled ?? true,
      modelInfo: jsonConfig?.modelInfo ?? undefined,
      httpConfig: jsonConfig?.httpConfig ?? undefined,
      isDefaultForJobTypes: (jsonConfig as any)?.isDefaultForJobTypes ?? undefined,
    };

    if (dbEngine?.adapterName) merged.adapterName = dbEngine.adapterName;
    if (dbEngine?.adapterType) merged.adapterType = dbEngine.adapterType;
    if (dbEngine?.config) {
      const cfg = dbEngine.config as any;
      // 如果 DB 存储的是 httpConfig，进行浅合并
      if (cfg.httpConfig || cfg.adapterType === 'http') {
        merged.httpConfig = {
          ...(merged.httpConfig || {}),
          ...(cfg.httpConfig ?? cfg),
        };
      } else {
        // 其他配置类型直接合入
        merged.config = { ...(merged.config || {}), ...cfg };
      }
      if (cfg.modelInfo) {
        merged.modelInfo = { ...(merged.modelInfo || {}), ...cfg.modelInfo };
      }
      if (typeof cfg.enabled === 'boolean') {
        merged.enabled = cfg.enabled;
      }
    }

    return merged;
  }

  /**
   * 深度合并工具：后者覆盖前者
   */
  private deepMerge<T extends Record<string, any>>(...sources: (T | null | undefined)[]): T {
    const result: any = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const key of Object.keys(src)) {
        const prev = result[key];
        const next = (src as any)[key];
        if (Array.isArray(prev) && Array.isArray(next)) {
          result[key] = next; // 简化：数组直接覆盖
        } else if (
          prev &&
          typeof prev === 'object' &&
          next &&
          typeof next === 'object' &&
          !Array.isArray(prev) &&
          !Array.isArray(next)
        ) {
          result[key] = this.deepMerge(prev as any, next as any);
        } else {
          result[key] = next;
        }
      }
    }
    return result as T;
  }

  /**
   * 统一解析配置（DB + JSON + Version）
   * 默认 NOVEL_ANALYSIS 可在调用层决定是否允许 DB 覆盖
   */
  async resolveEngineConfig(engineKey: string, requestedVersion?: string): Promise<any> {
    const jsonConfig = this.getJsonConfig(engineKey);
    const engine = await this.findByEngineKey(engineKey);

    // 决定版本
    let versionConfig: any = null;
    if (requestedVersion) {
      const ver = await this.findVersion(engineKey, requestedVersion);
      versionConfig = ver?.config ?? null;
    } else if (engine?.defaultVersion) {
      const ver = await this.findVersion(engineKey, engine.defaultVersion);
      versionConfig = ver?.config ?? null;
    }

    // 合并：JSON < Engine.config(DB) < EngineVersion.config(DB)
    const merged = this.deepMerge<any>(
      (jsonConfig as any) ?? {},
      (engine?.config as any) ?? {},
      (versionConfig as any) ?? {}
    );

    return merged;
  }

  /**
   * 从 engines.json 查找配置
   */
  getJsonConfig(engineKey: string): EngineJsonConfig | undefined {
    return enginesJson.engines.find((e: EngineJsonConfig) => e.engineKey === engineKey);
  }
}
