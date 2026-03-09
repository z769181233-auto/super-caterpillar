"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EngineRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineRegistry = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@scu/config");
const engine_config_store_service_1 = require("./engine-config-store.service");
const engine_routing_service_1 = require("./engine-routing.service");
const engine_strategy_service_1 = require("./engine-strategy.service");
let EngineRegistry = EngineRegistry_1 = class EngineRegistry {
    engineConfigStore;
    engineRoutingService;
    engineStrategyService;
    logger = new common_1.Logger(EngineRegistry_1.name);
    adapters = new Map();
    aliasedKeys = new Map();
    defaultEngineKey;
    jsonConfigMap = new Map();
    ensureAdapters() {
        if (!this.adapters) {
            this.adapters = new Map();
        }
        return this.adapters;
    }
    safeLog(message) {
        try {
            this.logger?.log?.(message);
            return;
        }
        catch {
        }
        try {
            this.logger.log(message);
        }
        catch {
        }
    }
    constructor(engineConfigStore, engineRoutingService, engineStrategyService) {
        this.engineConfigStore = engineConfigStore;
        this.engineRoutingService = engineRoutingService;
        this.engineStrategyService = engineStrategyService;
        this.defaultEngineKey = config_1.env.engineDefault || 'default_novel_analysis';
    }
    getJsonConfig(engineKey) {
        if (this.jsonConfigMap.has(engineKey)) {
            return this.jsonConfigMap.get(engineKey);
        }
        const cfg = this.engineConfigStore.getJsonConfig(engineKey);
        if (cfg) {
            this.jsonConfigMap.set(engineKey, cfg);
        }
        return cfg;
    }
    async resolveEngineConfig(engineKey) {
        if (engineKey === 'default_novel_analysis') {
            return this.getJsonConfig(engineKey) || null;
        }
        const jsonCfg = this.getJsonConfig(engineKey);
        const dbCfg = await this.engineConfigStore.findByEngineKey(engineKey);
        return this.engineConfigStore.mergeConfig(dbCfg, jsonCfg) || jsonCfg || null;
    }
    async resolveEngineConfigWithVersion(engineKey, engineVersion) {
        if (engineKey === 'default_novel_analysis') {
            return this.getJsonConfig(engineKey) || null;
        }
        return this.engineConfigStore.resolveEngineConfig(engineKey, engineVersion);
    }
    register(adapter) {
        if (!adapter.name) {
            throw new Error('EngineAdapter must have a name');
        }
        this.ensureAdapters().set(adapter.name, adapter);
        this.safeLog(`Registered engine adapter: ${adapter.name}`);
    }
    registerAlias(alias, adapter) {
        this.ensureAdapters().set(alias, adapter);
        this.aliasedKeys.set(alias, adapter.name);
        this.safeLog(`Registered engine adapter alias: ${alias} -> ${adapter.name}`);
    }
    getAdapter(engineKey) {
        return this.ensureAdapters().get(engineKey) || null;
    }
    getDefaultAdapter() {
        return this.getAdapter(this.defaultEngineKey);
    }
    findAdapter(engineKey, jobType, payload) {
        if (payload?.useHttpEngine === true) {
            const httpEngineKey = payload?.engineKey || 'http_gemini_v1';
            const adapter = this.getAdapter(httpEngineKey);
            if (adapter && adapter.supports(httpEngineKey)) {
                return adapter;
            }
        }
        this.safeLog(`[DEBUG] findAdapter request: engineKey=${engineKey}, jobType=${jobType}. Available adapters: ${Array.from(this.adapters.keys()).join(', ')}`);
        if (engineKey) {
            const adapter = this.getAdapter(engineKey);
            if (adapter) {
                if (adapter.supports(engineKey)) {
                    return adapter;
                }
            }
        }
        if (jobType) {
            const defaultKeyForJobType = this.getDefaultEngineKeyForJobType(jobType);
            if (defaultKeyForJobType) {
                const adapter = this.getAdapter(defaultKeyForJobType);
                if (adapter && adapter.supports(defaultKeyForJobType)) {
                    return adapter;
                }
            }
        }
        const defaultAdapter = this.getDefaultAdapter();
        if (defaultAdapter) {
            return defaultAdapter;
        }
        throw new Error(`No engine adapter found for engineKey="${engineKey || 'undefined'}" jobType="${jobType || 'undefined'}"`);
    }
    getDefaultEngineKeyForJobType(jobType) {
        const jobTypeToEngineKey = {
            NOVEL_ANALYSIS: 'default_novel_analysis',
            NOVEL_ANALYZE_CHAPTER: 'default_novel_analysis',
            SHOT_RENDER: config_1.PRODUCTION_MODE ? 'real_shot_render' : 'default_shot_render',
            NOVEL_ANALYSIS_HTTP: 'http_real_novel_analysis',
            SHOT_RENDER_HTTP: 'http_real_shot_render',
            VIDEO_RENDER: 'video_merge',
            CE03_VISUAL_DENSITY: 'ce03_visual_density',
            CE04_VISUAL_ENRICHMENT: 'ce04_visual_enrichment',
            CE06_NOVEL_PARSING: 'ce06_novel_parsing',
            CE07_MEMORY_UPDATE: 'ce07_memory_update',
            CE01_REFERENCE_SHEET: 'character_visual',
            TIMELINE_PREVIEW: 'ce11_timeline_preview',
            PIPELINE_STAGE1_NOVEL_TO_VIDEO: 'stage1_orchestrator',
            CE09_MEDIA_SECURITY: 'ce09_security_real',
            CE11_SHOT_GENERATOR: 'ce11_shot_generator_mock',
            CE11_SHOT_GENERATOR_REAL: 'ce11_shot_generator_real',
            CE14_NARRATIVE_CLIMAX: 'ce14_narrative_climax',
            AUDIO: 'audio_engine',
        };
        return jobTypeToEngineKey[jobType] || null;
    }
    async resolveEngineForJobType(jobType) {
        const engineKey = this.getDefaultEngineKeyForJobType(jobType);
        if (!engineKey) {
            return null;
        }
        const engineConfig = await this.engineConfigStore.findByEngineKey(engineKey);
        if (!engineConfig) {
            return null;
        }
        return {
            id: engineConfig.id,
            code: engineConfig.code || engineConfig.engineKey || engineConfig.id,
            name: engineConfig.name || engineConfig.adapterName || engineConfig.engineKey,
            type: engineConfig.type || engineConfig.adapterType || 'local',
            isActive: (engineConfig.isActive !== false && engineConfig.enabled !== false) || true,
        };
    }
    getAllEngineNames() {
        return Array.from(this.adapters.keys());
    }
    async invoke(input) {
        const jobType = input.jobType || '';
        const payload = input.payload || {};
        const baseEngineKey = input.engineKey || this.getDefaultEngineKeyForJobType(jobType) || null;
        let routingResult;
        if (this.engineStrategyService) {
            const strategyDecision = this.engineStrategyService.decideStrategy(jobType, payload, baseEngineKey, {});
            routingResult = {
                engineKey: strategyDecision.engineKey,
                resolvedVersion: strategyDecision.resolvedVersion,
            };
        }
        else {
            routingResult = this.engineRoutingService.resolve({
                jobType,
                baseEngineKey,
                payload,
            });
        }
        const finalEngineKey = routingResult.engineKey || baseEngineKey || this.defaultEngineKey;
        const productionCriticalEngines = [
            'ce10_timeline_preview',
            'ce11_shot_generator_real',
            'shot_render',
            'real_shot_render',
            'video_merge',
        ];
        const isProductionJob = input.context?.stage === 'production' ||
            input.payload?.metadata?.stage === 'production' ||
            input.payload?.stage === 'production' ||
            config_1.PRODUCTION_MODE;
        const originalKey = this.aliasedKeys.get(finalEngineKey);
        if (isProductionJob && originalKey && productionCriticalEngines.includes(finalEngineKey)) {
            if (originalKey !== finalEngineKey) {
                this.logger.error(`[P1_BLOCKER] Production Engine Risk: ${finalEngineKey} is aliased to ${originalKey}. Blocked.`);
                throw new Error(`PRODUCTION_PATH_ASSERT_FAILED: Engine ${finalEngineKey} is an alias and cannot be used in production.`);
            }
        }
        const nextPayload = {
            ...payload,
        };
        if (routingResult.resolvedVersion && !nextPayload.engineVersion) {
            nextPayload.engineVersion = routingResult.resolvedVersion;
        }
        const nextInput = {
            ...input,
            engineKey: finalEngineKey,
            payload: nextPayload,
        };
        const adapter = this.findAdapter(nextInput.engineKey, nextInput.jobType, nextInput.payload);
        return adapter.invoke(nextInput);
    }
};
exports.EngineRegistry = EngineRegistry;
exports.EngineRegistry = EngineRegistry = EngineRegistry_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => engine_strategy_service_1.EngineStrategyService))),
    __metadata("design:paramtypes", [engine_config_store_service_1.EngineConfigStoreService,
        engine_routing_service_1.EngineRoutingService,
        engine_strategy_service_1.EngineStrategyService])
], EngineRegistry);
//# sourceMappingURL=engine-registry.service.js.map