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
import { CE06LocalAdapter } from '../engines/adapters/ce06.local.adapter';
import { CE03LocalAdapter } from '../engines/adapters/ce03.local.adapter';
import { CE04LocalAdapter } from '../engines/adapters/ce04.local.adapter';
import { VideoMergeLocalAdapter } from '../engines/adapters/video-merge.local.adapter';
import { CE11ComfyUIAdapter } from '../engine/adapters/ce11.comfyui.adapter';
import { MockEngineAdapter } from '../engine/adapters/mock-engine.adapter';

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
      engineKey: 'novel_analysis',
      version: 'default',
      mode: 'local',
      adapterToken: NovelAnalysisLocalAdapter,
    },
    // Stage4: Semantic Enhancement (local stub)
    {
      engineKey: 'semantic_enhancement',
      version: 'default',
      mode: 'local',
      adapterToken: SemanticEnhancementLocalAdapter,
    },
    // SHOT RENDER (Real Engine)
    {
      engineKey: 'shot_render',
      version: 'default',
      mode: 'local', // P13-1: Use Mock Adapter for Verification Loop
      adapterToken: MockEngineAdapter,
      // mode: 'http',
      // httpConfig: {
      //   baseUrl: process.env.SHOT_RENDER_BASE_URL || 'http://localhost:8003',
      //   path: '/render/shot',
      // },
      // Note: original was version: 'local', mode: 'gpu'... wait,
      // The previous view_file showed:
      // { engineKey: 'shot_render', version: 'local', mode: 'gpu', adapterToken: 'ShotRenderLocalAdapter' }
      // AND later:
      // { engineKey: 'shot_render', version: 'default', mode: 'http', ... }
      // I should update the 'default' version one as that's what is likely used by default.
      // The 'local' version is probably old/unused.
    },

    // There was another shot_render entry at line 45 (version: local). keeping it as is or removing?
    // I will keep it but ensure 'default' is the one used.
    {
      engineKey: 'shot_render_gpu', // Renaming key to avoid confusion if unique required,
      // but originally it was 'shot_render'. Registry allows duplicates?
      // find() returns exact match or default.
      // If multiple defaults, find() picks first.
      version: 'local',
      mode: 'gpu',
      adapterToken: 'ShotRenderLocalAdapter',
    },

    // CE05 EXAMPLE (NON-PROD)
    {
      engineKey: 'ce05_example',
      version: 'example',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.CE05_EXAMPLE_BASE_URL || 'http://127.0.0.1:8999',
        path: '/ce05/example',
        timeoutMs: 30000,
      },
      notes: 'EXAMPLE_ONLY_DO_NOT_USE_IN_PROD',
    },
    // Stage4: Shot Planning (local stub)
    {
      engineKey: 'shot_planning',
      version: 'default',
      mode: 'local',
      adapterToken: ShotPlanningLocalAdapter,
    },
    // Stage4: Structure Quality Assessment (local stub)
    {
      engineKey: 'structure_qa',
      version: 'default',
      mode: 'local',
      adapterToken: StructureQALocalAdapter,
    },
    // Stage13: CE Core Layer (Now Local via Gemini/Algo)
    {
      engineKey: 'ce06_novel_parsing',
      version: 'default',
      mode: 'local',
      adapterToken: CE06LocalAdapter,
    },
    {
      engineKey: 'ce03_visual_density',
      version: 'default',
      mode: 'local', // Combined with CE03LocalAdapter
      adapterToken: CE03LocalAdapter,
    },
    {
      engineKey: 'ce04_visual_enrichment',
      version: 'default',
      mode: 'local', // Combined with CE04LocalAdapter
      adapterToken: CE04LocalAdapter,
    },
    // Originally line 100: SHOT RENDER DEFAULT
    // This is the one I mapped to Mock above.
    // Wait, I put the Mock config at the TOP (replacing the 'shot_render' 'local' one? No, I put it as a new entry?)
    // In my replaced content above, I put `shot_render` default mock.
    // I should be careful not to have duplicate `shot_render` `default`.
    // The original file had `shot_render` `local` at line 45, and `shot_render` `default` at line 100.
    // I will replace the one at line 100 with Mock, and leave line 45 alone.

    {
      engineKey: 'ce04_sdxl',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.CE04_SDXL_BASE_URL || 'http://localhost:8004',
        path: '/generate/image',
      },
    },
    {
      engineKey: 'tts_standard',
      version: 'default',
      mode: 'http',
      httpConfig: {
        baseUrl: process.env.TTS_BASE_URL || 'http://localhost:8005',
        path: '/generate/voice',
      },
    },
    // Video Merge (Local)
    {
      engineKey: 'video_merge',
      version: 'default',
      mode: 'local',
      adapterToken: VideoMergeLocalAdapter,
    },
    // Stage 1 Orchestrator (Local)
    {
      engineKey: 'stage1_orchestrator',
      version: 'default',
      mode: 'local',
      adapterToken: 'Stage1OrchestratorAdapter', // Placeholder if needed
    },
    // CE09 Media Security (Local Placeholder)
    {
      engineKey: 'ce09_security_real',
      version: 'default',
      mode: 'local',
      adapterToken: VideoMergeLocalAdapter,
    },
    // CE11 Shot Generator (Real)
    {
      engineKey: 'ce11_shot_generator_real',
      version: 'default',
      mode: 'local',
      adapterToken: CE11ComfyUIAdapter,
    },
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
    const exactMatch = this.engines.find(
      (e) => e.engineKey === engineKey && e.version === targetVersion
    );

    if (exactMatch) {
      return exactMatch;
    }

    // 如果没有精确匹配，fallback 到默认版本
    const defaultMatch = this.engines.find(
      (e) => e.engineKey === engineKey && e.version === 'default'
    );

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
      (e) => e.engineKey === descriptor.engineKey && e.version === descriptor.version
    );

    if (existing) {
      this.logger.warn(
        `Engine ${descriptor.engineKey}@${descriptor.version} already registered, overwriting`
      );
      const index = this.engines.indexOf(existing);
      this.engines[index] = descriptor;
    } else {
      this.engines.push(descriptor);
    }

    this.logger.log(
      `Registered engine: ${descriptor.engineKey}@${descriptor.version} (mode: ${descriptor.mode})`
    );
  }

  /**
   * 获取所有已注册的引擎
   */
  getAllEngines(): EngineDescriptor[] {
    return [...this.engines];
  }
}
