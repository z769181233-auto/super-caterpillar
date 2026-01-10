/**
 * Engine Registry Hub Service
 * Stage2: 引擎注册表服务，维护引擎配置清单
 */

import { Injectable, Logger } from '@nestjs/common';
import { EngineDescriptor } from './engine-descriptor.interface';
import { SemanticEnhancementLocalAdapter } from './adapters/semantic-enhancement.local-adapter';
import { ShotPlanningLocalAdapter } from './adapters/shot-planning.local-adapter';
import { StructureQALocalAdapter } from './adapters/structure-qa.local-adapter';
import { NovelAnalysisLocalAdapter } from '../engines/adapters/novel-analysis.local.adapter.NEW';

/**
 * Engine Registry Hub
 * 维护引擎配置表，告诉调用方某个 engineKey/version 应该用哪个 adapter
 */
@Injectable()
export class EngineRegistryHubService {
  private readonly logger = new Logger(EngineRegistryHubService.name);

  /**
   * 引擎配置表（内存中）
   * Stage2 MVP: 先只实现 NOVEL_ANALYSIS
   */
  private engines: EngineDescriptor[] = [
    {
      key: 'novel_analysis',
      version: 'default',
      mode: 'local',
      adapterToken: NovelAnalysisLocalAdapter,
    },
    // Stage4: Semantic Enhancement (local stub)
    {
      key: 'semantic_enhancement',
      version: 'default',
      mode: 'local',
      adapterToken: SemanticEnhancementLocalAdapter,
    },
    // SHOT RENDER (Real Engine)
    {
      key: 'shot_render',
      version: 'default',
      mode: 'gpu',
      adapterToken: 'ShotRenderLocalAdapter',
    },

    // CE05 EXAMPLE (NON-PROD)
    // This is a workflow integration example ONLY.
    // DO NOT use in prod. Keep disabled in real runs via ENGINE_DISABLE_KEYS=ce05_example.
    {
      key: 'ce05_example',
      version: 'example',
      mode: 'http',
      httpConfig: {
        baseUrl: '${CE05_EXAMPLE_BASE_URL}',
        path: '/ce05/example',
        timeoutMs: 30000,
      },
      notes: 'EXAMPLE_ONLY_DO_NOT_USE_IN_PROD',
    },
    // Stage4: Shot Planning (local stub)
    {
      key: 'shot_planning',
      version: 'default',
      mode: 'local',
      adapterToken: ShotPlanningLocalAdapter,
    },
    // Stage4: Structure Quality Assessment (local stub)
    {
      key: 'structure_qa',
      version: 'default',
      mode: 'local',
      adapterToken: StructureQALocalAdapter,
    },
    // Stage13: CE Core Layer (HTTP)
    {
      key: 'ce06_novel_parsing',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.CE06_BASE_URL || 'http://localhost:8000',
        path: '/story/parse',
      },
    },
    {
      key: 'ce03_visual_density',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.CE03_BASE_URL || 'http://localhost:8001',
        path: '/text/visual-density',
      },
    },
    {
      key: 'ce04_visual_enrichment',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.CE04_BASE_URL || 'http://localhost:8002',
        path: '/text/enrich',
      },
    },
    {
      key: 'shot_render',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.SHOT_RENDER_BASE_URL || 'http://localhost:8003',
        path: '/render/shot',
      },
    },
    // 其它引擎占位以后再加
  ];

  /**
   * 查找引擎描述符
   * @param engineKey 引擎标识
   * @param version 引擎版本（可选，默认 "default"）
   * @returns 引擎描述符或 null
   */
  find(engineKey: string, version?: string): EngineDescriptor | null {
    const targetVersion = version || 'default';

    // 优先匹配精确版本
    const exactMatch = this.engines.find((e) => e.key === engineKey && e.version === targetVersion);

    if (exactMatch) {
      return exactMatch;
    }

    // 如果没有精确匹配，fallback 到默认版本
    const defaultMatch = this.engines.find((e) => e.key === engineKey && e.version === 'default');

    if (defaultMatch) {
      this.logger.debug(`Engine ${engineKey}@${targetVersion} not found, using default version`);
      return defaultMatch;
    }

    return null;
  }

  /**
   * 注册引擎（用于动态注册）
   * @param descriptor 引擎描述符
   */
  register(descriptor: EngineDescriptor): void {
    const existing = this.engines.find(
      (e) => e.key === descriptor.key && e.version === descriptor.version
    );

    if (existing) {
      this.logger.warn(
        `Engine ${descriptor.key}@${descriptor.version} already registered, overwriting`
      );
      const index = this.engines.indexOf(existing);
      this.engines[index] = descriptor;
    } else {
      this.engines.push(descriptor);
    }

    this.logger.log(
      `Registered engine: ${descriptor.key}@${descriptor.version} (mode: ${descriptor.mode})`
    );
  }

  /**
   * 获取所有已注册的引擎
   */
  getAllEngines(): EngineDescriptor[] {
    return [...this.engines];
  }
}
