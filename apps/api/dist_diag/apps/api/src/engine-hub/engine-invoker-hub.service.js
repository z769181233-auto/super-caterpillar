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
var EngineInvokerHubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineInvokerHubService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const engine_registry_hub_service_1 = require("./engine-registry-hub.service");
const http_engine_adapter_1 = require("../engine/adapters/http-engine.adapter");
const engine_registry_service_1 = require("../engine/engine-registry.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const cost_limit_service_1 = require("../cost/cost-limit.service");
const pricing_1 = require("../cost/pricing");
let EngineInvokerHubService = EngineInvokerHubService_1 = class EngineInvokerHubService {
    engineRegistry;
    memoryRegistry;
    moduleRef;
    httpEngineAdapter;
    auditLogService;
    costLimit;
    logger = new common_1.Logger(EngineInvokerHubService_1.name);
    constructor(engineRegistry, memoryRegistry, moduleRef, httpEngineAdapter, auditLogService, costLimit) {
        this.engineRegistry = engineRegistry;
        this.memoryRegistry = memoryRegistry;
        this.moduleRef = moduleRef;
        this.httpEngineAdapter = httpEngineAdapter;
        this.auditLogService = auditLogService;
        this.costLimit = costLimit;
        console.log(`[EngineInvokerHubService] Constructor - costLimit defined: ${!!this.costLimit}`);
    }
    async onModuleInit() {
        this.ensureDependencies();
    }
    ensureDependencies() {
        if (!this.engineRegistry) {
            try {
                this.engineRegistry = this.moduleRef.get(engine_registry_hub_service_1.EngineRegistryHubService, { strict: false });
            }
            catch (e) {
            }
        }
        if (!this.memoryRegistry) {
            try {
                this.memoryRegistry = this.moduleRef.get(engine_registry_service_1.EngineRegistry, { strict: false });
            }
            catch (e) {
            }
        }
        if (!this.httpEngineAdapter) {
            try {
                this.httpEngineAdapter = this.moduleRef.get(http_engine_adapter_1.HttpEngineAdapter, { strict: false });
            }
            catch (e) {
            }
        }
        if (!this.auditLogService) {
            try {
                this.auditLogService = this.moduleRef.get(audit_log_service_1.AuditLogService, { strict: false });
            }
            catch (e) {
            }
        }
        if (!this.costLimit) {
            try {
                this.costLimit = this.moduleRef.get(cost_limit_service_1.CostLimitService, { strict: false });
            }
            catch (e) {
            }
        }
    }
    async invoke(req) {
        this.ensureDependencies();
        const started = Date.now();
        let fallbackReason;
        const isGateMode = process.env.GATE_MODE === '1';
        const forceFailKeys = (process.env.ENGINE_FORCE_FAIL_KEYS || '').split(',').filter(Boolean);
        const disableKeys = (process.env.ENGINE_DISABLE_KEYS || '').split(',').filter(Boolean);
        if (isGateMode && forceFailKeys.includes(req.engineKey)) {
            const result = {
                success: false,
                selectedEngineKey: req.engineKey,
                error: {
                    code: 'FAULT_INJECTED',
                    message: `Engine ${req.engineKey} matched ENGINE_FORCE_FAIL_KEYS`,
                },
                metrics: { latencyMs: Date.now() - started },
            };
            await this.logInvocation(req, result);
            return result;
        }
        const jobId = req.metadata?.jobId || `manual_${started}`;
        const projectId = req.metadata?.projectId || 'default_project';
        const attempt = req.metadata?.attempt || 0;
        if (!req.engineKey && req.jobType) {
            const defaultKey = this.memoryRegistry.getDefaultEngineKeyForJobType(req.jobType);
            if (req.jobType === 'CE11_SHOT_GENERATOR') {
                const payload = req.payload;
                const isVerif = !!req.metadata?.isVerification ||
                    !!req.metadata?.gateMode ||
                    !!payload?.isVerification ||
                    !!payload?.gateMode;
                if (!isVerif) {
                    throw new common_1.BadRequestException('CE11_SHOT_GENERATOR requires explicit engineKey in production (e.g. ce11_shot_generator_real)');
                }
                if (defaultKey)
                    req.engineKey = defaultKey;
            }
            else if (defaultKey) {
                req.engineKey = defaultKey;
            }
        }
        if (!req.engineKey) {
            throw new common_1.BadRequestException(`Engine Key missing (and could not be resolved from jobType: ${req.jobType})`);
        }
        if (attempt > 3) {
            const error = `RETRY_LIMIT_EXCEEDED: Job ${jobId} attempt ${attempt} exceeds max allowed (3)`;
            this.logger.error(error);
            throw new Error(error);
        }
        const isVerification = !!req.metadata?.isVerification;
        if (isVerification && process.env.GATE_MODE !== '1') {
            const error = 'SECURITY_VIOLATION: isVerification=true is only allowed when GATE_MODE=1';
            this.logger.error(error);
            throw new common_1.BadRequestException(error);
        }
        if (req.engineKey.includes('shot_render')) {
            if (!isVerification) {
                await this.costLimit.preCheckOrThrow({
                    jobId,
                    engineKey: req.engineKey,
                    plannedOutputs: 1,
                    estimatedCostUsd: 0.02,
                });
            }
            else {
                const verificationCostCapUsd = Number(process.env.VERIFICATION_COST_CAP_USD ?? '1');
                await this.costLimit.preCheckVerificationOrThrow({
                    jobId,
                    engineKey: req.engineKey,
                    capUsd: verificationCostCapUsd,
                });
            }
        }
        try {
            let output;
            let engineResult;
            const memoryAdapter = this.memoryRegistry.getAdapter(req.engineKey);
            if (memoryAdapter) {
                const engineInput = {
                    engineKey: req.engineKey,
                    jobType: this.inferJobTypeFromEngineKey(req.engineKey),
                    payload: { ...req.payload, engineVersion: req.engineVersion },
                    context: { ...req.metadata },
                };
                engineResult = await memoryAdapter.invoke(engineInput);
                if (engineResult.status === 'SUCCESS') {
                    output = engineResult.output;
                }
                else {
                    throw new Error(engineResult.error?.message || 'Memory Adapter execution failed');
                }
            }
            else {
                let descriptor = this.engineRegistry.find(req.engineKey, req.engineVersion);
                if (isGateMode && descriptor && disableKeys.includes(descriptor.engineKey)) {
                    this.logger.warn(`Engine ${descriptor.engineKey} disabled by Gate`);
                    fallbackReason = `Engine ${descriptor.engineKey} disabled by Gate`;
                    descriptor = null;
                }
                if (!descriptor) {
                    throw new Error(`Engine ${req.engineKey}@${req.engineVersion ?? 'default'} not registered or disabled`);
                }
                if (descriptor.mode === 'local') {
                    const adapter = this.moduleRef.get(descriptor.adapterToken, {
                        strict: false,
                    });
                    if (!adapter)
                        throw new Error(`Adapter ${descriptor.adapterToken} not found`);
                    const engineInput = {
                        engineKey: req.engineKey,
                        jobType: this.inferJobTypeFromEngineKey(req.engineKey),
                        payload: { ...req.payload, engineVersion: req.engineVersion },
                        context: { ...req.metadata },
                    };
                    engineResult = await adapter.invoke(engineInput);
                    if (engineResult.status === 'SUCCESS') {
                        output = engineResult.output;
                    }
                    else {
                        throw new Error(engineResult.error?.message || 'Engine execution failed');
                    }
                }
                else {
                    const engineInput = {
                        engineKey: req.engineKey,
                        jobType: this.inferJobTypeFromEngineKey(req.engineKey),
                        payload: { ...req.payload, engineVersion: req.engineVersion },
                        context: { ...req.metadata },
                    };
                    engineResult = await this.httpEngineAdapter.invoke(engineInput);
                    if (engineResult.status === 'SUCCESS') {
                        output = engineResult.output;
                    }
                    else {
                        throw new Error(engineResult.error?.message || 'Engine execution failed');
                    }
                }
            }
            if (req.engineKey.includes('shot_render') && engineResult?.status === 'SUCCESS') {
                const audit = engineResult.output?.audit_trail;
                const provider = audit?.providerSelected || 'unknown';
                const costUsd = (0, pricing_1.getEngineCost)(req.engineKey, provider, { imageCount: 1 });
                const attempt = req.metadata?.attempt || 0;
                const idempotencyKey = `${jobId}:${req.engineKey}:${attempt}`;
                if (!isVerification) {
                    await this.costLimit.postApplyUsage({
                        jobId,
                        projectId,
                        engineKey: req.engineKey,
                        pricingKey: audit?.pricing_key || 'UNKNOWN',
                        actualOutputs: 1,
                        gpuSeconds: engineResult.metrics?.gpuSeconds || 0,
                        costUsd,
                        attempt,
                        metadata: { traceId: req.metadata?.traceId, provider },
                    });
                }
                else {
                    await this.costLimit.postApplyVerificationUsageNoLedger({
                        jobId,
                        engineKey: req.engineKey,
                        costUsd,
                        metadata: { traceId: req.metadata?.traceId, provider, isVerification: true },
                    });
                }
            }
            if (req.engineKey === 'ce11_shot_generator_real' && engineResult?.status === 'SUCCESS') {
                const costUsd = 0;
                const attempt = req.metadata?.attempt || 0;
                if (!isVerification) {
                    await this.costLimit.postApplyUsage({
                        jobId,
                        projectId,
                        jobType: req.jobType || 'CE11_SHOT_GENERATOR',
                        engineKey: req.engineKey,
                        pricingKey: 'CE11_REAL_OT_0',
                        actualOutputs: 1,
                        gpuSeconds: engineResult.metrics?.gpuSeconds || 0,
                        costUsd,
                        attempt,
                        metadata: { traceId: req.metadata?.traceId },
                    });
                }
            }
            const finalResult = {
                success: true,
                selectedEngineKey: req.engineKey,
                fallbackReason,
                output,
                metrics: {
                    latencyMs: Date.now() - started,
                    usage: {
                        inputTokens: engineResult?.metrics?.tokensIn || 0,
                        outputTokens: engineResult?.metrics?.tokensOut || 0,
                        totalTokens: engineResult?.metrics?.tokensUsed || 0,
                        costUsd: engineResult?.metrics?.costUsd || 0,
                    },
                    ...(engineResult?.metrics || {}),
                },
            };
            await this.logInvocation(req, finalResult);
            return finalResult;
        }
        catch (e) {
            const errorObj = e;
            this.logger.error(`[EngineInvokerHubService] Failed invoking ${req.engineKey}: ${errorObj?.message}`, errorObj?.stack);
            const result = {
                success: false,
                selectedEngineKey: req.engineKey,
                fallbackReason,
                error: {
                    code: errorObj?.code ?? 'ENGINE_CALL_FAILED',
                    message: errorObj?.message ?? 'Engine invocation failed',
                    details: { ...req.metadata, ...(errorObj?.details || {}) },
                },
                metrics: { latencyMs: Date.now() - started },
            };
            await this.logInvocation(req, result);
            return result;
        }
    }
    async logInvocation(req, res) {
        await this.auditLogService.record({
            action: 'ENGINE_HUB_INVOKE',
            resourceType: 'engine',
            resourceId: res.selectedEngineKey || req.engineKey,
            traceId: req.metadata?.traceId,
            details: {
                request: {
                    engineKey: req.engineKey,
                    engineVersion: req.engineVersion,
                },
                response: {
                    success: res.success,
                    selectedEngineKey: res.selectedEngineKey,
                    selectedEngineVersion: res.selectedEngineVersion,
                    fallbackReason: res.fallbackReason,
                    error: res.error,
                    metrics: res.metrics,
                },
            },
        });
    }
    inferJobTypeFromEngineKey(engineKey) {
        if (engineKey === 'novel_analysis' || engineKey === 'default_novel_analysis') {
            return 'NOVEL_ANALYSIS';
        }
        if (engineKey === 'ce06_novel_parsing') {
            return 'CE06_NOVEL_PARSING';
        }
        if (engineKey === 'ce03_visual_density') {
            return 'CE03_VISUAL_DENSITY';
        }
        if (engineKey === 'ce04_visual_enrichment') {
            return 'CE04_VISUAL_ENRICHMENT';
        }
        if (engineKey === 'ce11_shot_generator_real' || engineKey === 'ce11_shot_generator_mock') {
            return 'CE11_SHOT_GENERATOR';
        }
        if (engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render') {
            return 'SHOT_RENDER';
        }
        return 'UNKNOWN';
    }
};
exports.EngineInvokerHubService = EngineInvokerHubService;
exports.EngineInvokerHubService = EngineInvokerHubService = EngineInvokerHubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(engine_registry_hub_service_1.EngineRegistryHubService)),
    __param(1, (0, common_1.Inject)(engine_registry_service_1.EngineRegistry)),
    __param(3, (0, common_1.Inject)(http_engine_adapter_1.HttpEngineAdapter)),
    __param(4, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(5, (0, common_1.Inject)(cost_limit_service_1.CostLimitService)),
    __metadata("design:paramtypes", [engine_registry_hub_service_1.EngineRegistryHubService,
        engine_registry_service_1.EngineRegistry,
        core_1.ModuleRef,
        http_engine_adapter_1.HttpEngineAdapter,
        audit_log_service_1.AuditLogService,
        cost_limit_service_1.CostLimitService])
], EngineInvokerHubService);
//# sourceMappingURL=engine-invoker-hub.service.js.map