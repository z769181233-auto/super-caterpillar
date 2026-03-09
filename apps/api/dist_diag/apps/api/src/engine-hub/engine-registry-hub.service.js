"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EngineRegistryHubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineRegistryHubService = void 0;
const common_1 = require("@nestjs/common");
const semantic_enhancement_local_adapter_1 = require("./adapters/semantic-enhancement.local-adapter");
const shot_planning_local_adapter_1 = require("./adapters/shot-planning.local-adapter");
const structure_qa_local_adapter_1 = require("./adapters/structure-qa.local-adapter");
const novel_analysis_local_adapter_NEW_1 = require("../engines/adapters/novel-analysis.local.adapter.NEW");
const ce06_novel_parsing_adapter_1 = require("../engines/adapters/ce06_novel_parsing.adapter");
const ce03_visual_density_adapter_1 = require("../engines/adapters/ce03_visual_density.adapter");
const ce04_visual_enrichment_adapter_1 = require("../engines/adapters/ce04_visual_enrichment.adapter");
const video_merge_adapter_1 = require("../engines/adapters/video_merge.adapter");
const ce11_comfyui_adapter_1 = require("../engine/adapters/ce11.comfyui.adapter");
const audio_tts_local_adapter_1 = require("../engines/adapters/audio-tts.local.adapter");
const audio_bgm_local_adapter_1 = require("../engines/adapters/audio-bgm.local.adapter");
const ce23_identity_lock_adapter_1 = require("../engines/adapters/ce23_identity_lock.adapter");
const ce09_security_adapter_1 = require("../engines/adapters/ce09_security.adapter");
const character_visual_local_adapter_1 = require("../engines/adapters/character-visual.local.adapter");
let EngineRegistryHubService = EngineRegistryHubService_1 = class EngineRegistryHubService {
    logger = new common_1.Logger(EngineRegistryHubService_1.name);
    engines = [
        {
            engineKey: 'novel_analysis',
            version: 'default',
            mode: 'local',
            adapterToken: novel_analysis_local_adapter_NEW_1.NovelAnalysisLocalAdapter,
        },
        {
            engineKey: 'semantic_enhancement',
            version: 'default',
            mode: 'local',
            adapterToken: semantic_enhancement_local_adapter_1.SemanticEnhancementLocalAdapter,
        },
        {
            engineKey: 'shot_render',
            version: 'default',
            mode: 'local',
            adapterToken: ce11_comfyui_adapter_1.CE11ComfyUIAdapter,
        },
        {
            engineKey: 'shot_planning',
            version: 'default',
            mode: 'local',
            adapterToken: shot_planning_local_adapter_1.ShotPlanningLocalAdapter,
        },
        {
            engineKey: 'structure_qa',
            version: 'default',
            mode: 'local',
            adapterToken: structure_qa_local_adapter_1.StructureQALocalAdapter,
        },
        {
            engineKey: 'ce06_novel_parsing',
            version: 'default',
            mode: 'local',
            adapterToken: ce06_novel_parsing_adapter_1.CE06LocalAdapter,
        },
        {
            engineKey: 'ce03_visual_density',
            version: 'default',
            mode: 'local',
            adapterToken: ce03_visual_density_adapter_1.CE03LocalAdapter,
        },
        {
            engineKey: 'ce04_visual_enrichment',
            version: 'default',
            mode: 'local',
            adapterToken: ce04_visual_enrichment_adapter_1.CE04LocalAdapter,
        },
        {
            engineKey: 'audio_tts',
            version: 'default',
            mode: 'local',
            adapterToken: audio_tts_local_adapter_1.AudioTTSLocalAdapter,
        },
        {
            engineKey: 'audio_bgm',
            version: 'default',
            mode: 'local',
            adapterToken: audio_bgm_local_adapter_1.AudioBGMLocalAdapter,
        },
        {
            engineKey: 'video_merge',
            version: 'default',
            mode: 'local',
            adapterToken: video_merge_adapter_1.VideoMergeLocalAdapter,
        },
        {
            engineKey: 'ce09_security',
            version: 'default',
            mode: 'local',
            adapterToken: ce09_security_adapter_1.CE09SecurityLocalAdapter,
        },
        {
            engineKey: 'ce23_identity_consistency',
            version: 'default',
            mode: 'local',
            adapterToken: ce23_identity_lock_adapter_1.CE23IdentityLocalAdapter,
        },
        {
            engineKey: 'character_visual',
            version: 'default',
            mode: 'local',
            adapterToken: character_visual_local_adapter_1.CharacterVisualLocalAdapter,
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
    assertRegistryUnique() {
        const seen = new Set();
        for (const e of this.engines) {
            const id = `${e.engineKey}@${e.version}`;
            if (seen.has(id)) {
                throw new Error(`REGISTRY_DUPLICATE_KEY: ${id} is defined multiple times.`);
            }
            seen.add(id);
            if (typeof e.adapterToken === 'string') {
                throw new Error(`REGISTRY_INVALID_TOKEN: ${id} uses a string placeholder. Class Token required.`);
            }
        }
        this.logger.log(`Registry uniqueness check passed (${this.engines.length} entries)`);
    }
    assertRegistryComplete(requiredKeys) {
        const registered = new Set(this.engines.map((e) => e.engineKey));
        const missing = requiredKeys.filter((k) => !registered.has(k));
        if (missing.length > 0) {
            throw new Error(`REGISTRY_INCOMPLETE: Missing core engines: ${missing.join(', ')}`);
        }
        this.logger.log('Registry completeness check passed');
    }
    find(engineKey, version) {
        const targetVersion = version || 'default';
        const exactMatch = this.engines.find((e) => e.engineKey === engineKey && e.version === targetVersion);
        if (exactMatch)
            return exactMatch;
        const defaultMatch = this.engines.find((e) => e.engineKey === engineKey && e.version === 'default');
        if (defaultMatch) {
            this.logger.debug(`Engine ${engineKey}@${targetVersion} not found, using default version`);
            return defaultMatch;
        }
        return null;
    }
    getAllEngines() {
        return [...this.engines];
    }
};
exports.EngineRegistryHubService = EngineRegistryHubService;
exports.EngineRegistryHubService = EngineRegistryHubService = EngineRegistryHubService_1 = __decorate([
    (0, common_1.Injectable)()
], EngineRegistryHubService);
//# sourceMappingURL=engine-registry-hub.service.js.map