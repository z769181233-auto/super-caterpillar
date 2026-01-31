import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { AudioTTSLocalAdapter } from '../engines/adapters/audio-tts.local.adapter';
import { AudioBGMLocalAdapter } from '../engines/adapters/audio-bgm.local.adapter';
import { CE23IdentityLocalAdapter } from '../engines/adapters/ce23-identity.local.adapter';
import { CE09SecurityLocalAdapter } from '../engines/adapters/ce09-security.local.adapter';
import { CharacterVisualLocalAdapter } from '../engines/adapters/character-visual.local.adapter';

/**
 * Engine Registry Hub Service - Industrial Grade
 * - Absolute Class Token enforcement (No strings)
 * - Unique (engineKey, version) check
 * - Completeness guard for core matrix
 */
@Injectable()
export class EngineRegistryHubService implements OnModuleInit {
  private readonly logger = new Logger(EngineRegistryHubService.name);

  private engines: EngineDescriptor[] = [
    {
      engineKey: 'novel_analysis',
      version: 'default',
      mode: 'local',
      adapterToken: NovelAnalysisLocalAdapter,
    },
    {
      engineKey: 'semantic_enhancement',
      version: 'default',
      mode: 'local',
      adapterToken: SemanticEnhancementLocalAdapter,
    },
    {
      engineKey: 'shot_render',
      version: 'default',
      mode: 'local',
      adapterToken: CE11ComfyUIAdapter,
    },
    {
      engineKey: 'shot_planning',
      version: 'default',
      mode: 'local',
      adapterToken: ShotPlanningLocalAdapter,
    },
    {
      engineKey: 'structure_qa',
      version: 'default',
      mode: 'local',
      adapterToken: StructureQALocalAdapter,
    },
    {
      engineKey: 'ce06_novel_parsing',
      version: 'default',
      mode: 'local',
      adapterToken: CE06LocalAdapter,
    },
    {
      engineKey: 'ce03_visual_density',
      version: 'default',
      mode: 'local',
      adapterToken: CE03LocalAdapter,
    },
    {
      engineKey: 'ce04_visual_enrichment',
      version: 'default',
      mode: 'local',
      adapterToken: CE04LocalAdapter,
    },
    {
      engineKey: 'audio_tts',
      version: 'default',
      mode: 'local',
      adapterToken: AudioTTSLocalAdapter,
    },
    {
      engineKey: 'audio_bgm',
      version: 'default',
      mode: 'local',
      adapterToken: AudioBGMLocalAdapter,
    },
    {
      engineKey: 'video_merge',
      version: 'default',
      mode: 'local',
      adapterToken: VideoMergeLocalAdapter,
    },
    {
      engineKey: 'ce09_security',
      version: 'default',
      mode: 'local',
      adapterToken: CE09SecurityLocalAdapter,
    },
    {
      engineKey: 'ce23_identity_consistency',
      version: 'default',
      mode: 'local',
      adapterToken: CE23IdentityLocalAdapter,
    },
    {
      engineKey: 'character_visual',
      version: 'default',
      mode: 'local',
      adapterToken: CharacterVisualLocalAdapter,
    },
  ];

  onModuleInit() {
    this.assertRegistryUnique();
    this.assertRegistryComplete([
      'novel_analysis',
      'shot_render',
      'audio_tts',
      'audio_bgm',
      'video_merge',
      'ce09_security',
      'ce23_identity_consistency',
    ]);
  }

  /**
   * 断言注册表唯一性 (engineKey, version)
   */
  private assertRegistryUnique() {
    const seen = new Set<string>();
    for (const e of this.engines) {
      const id = `${e.engineKey}@${e.version}`;
      if (seen.has(id)) {
        throw new Error(`REGISTRY_DUPLICATE_KEY: ${id} is defined multiple times.`);
      }
      seen.add(id);

      // Hard Check: No strings allowed in adapterToken
      if (typeof e.adapterToken === 'string') {
        throw new Error(
          `REGISTRY_INVALID_TOKEN: ${id} uses a string placeholder. Class Token required.`
        );
      }
    }
    this.logger.log(`Registry uniqueness check passed (${this.engines.length} entries)`);
  }

  /**
   * 断言核心矩阵完整性
   */
  private assertRegistryComplete(requiredKeys: string[]) {
    const registered = new Set(this.engines.map((e) => e.engineKey));
    const missing = requiredKeys.filter((k) => !registered.has(k));
    if (missing.length > 0) {
      throw new Error(`REGISTRY_INCOMPLETE: Missing core engines: ${missing.join(', ')}`);
    }
    this.logger.log('Registry completeness check passed');
  }

  find(engineKey: string, version?: string): EngineDescriptor | null {
    const targetVersion = version || 'default';
    const exactMatch = this.engines.find(
      (e) => e.engineKey === engineKey && e.version === targetVersion
    );
    if (exactMatch) return exactMatch;

    const defaultMatch = this.engines.find(
      (e) => e.engineKey === engineKey && e.version === 'default'
    );
    if (defaultMatch) {
      this.logger.debug(`Engine ${engineKey}@${targetVersion} not found, using default version`);
      return defaultMatch;
    }
    return null;
  }

  getAllEngines(): EngineDescriptor[] {
    return [...this.engines];
  }
}
