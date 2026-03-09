"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PpBaseEngine = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const perf_hooks_1 = require("perf_hooks");
class PpBaseEngine {
    name;
    redis;
    audit;
    cost;
    logger;
    constructor(name, redis, audit, cost) {
        this.name = name;
        this.redis = redis;
        this.audit = audit;
        this.cost = cost;
        this.logger = new common_1.Logger(`${PpBaseEngine.name}[${name}]`);
    }
    supports(engineKey) {
        return engineKey === this.name;
    }
    generateCacheKey(payload) {
        const str = JSON.stringify(payload);
        const hash = (0, crypto_1.createHash)('sha256').update(str).digest('hex');
        return `pp_cache:${this.name}:v1:${hash}`;
    }
    async execute(input, payload) {
        const t0 = perf_hooks_1.performance.now();
        const cacheKey = this.generateCacheKey(payload);
        try {
            const cached = await this.redis.getJson(cacheKey);
            if (cached) {
                await this.auditHelper(input, 'HIT', cacheKey);
                await this.recordCost(input, 0, { status: 'CACHE_HIT' });
                return {
                    status: 'SUCCESS',
                    output: { ...cached, meta: { ...cached.meta, source: 'cache', cached: true } },
                };
            }
        }
        catch (e) {
            this.logger.warn(`Cache lookup failed: ${e.message}`);
        }
        try {
            const result = await this.processLogic(payload, input);
            const durationMs = Math.round(perf_hooks_1.performance.now() - t0);
            const finalOutput = {
                status: 'PASS',
                assetUrl: result.assetUrl,
                meta: {
                    source: 'generated',
                    implementation: 'pp_base_v1',
                    engine: this.name,
                    cached: false,
                    ...result.meta,
                },
                metrics: {
                    durationMs,
                    ...result.metrics,
                },
            };
            await this.redis.setJson(cacheKey, finalOutput, 60 * 60 * 24 * 7);
            await this.auditHelper(input, 'MISS', 'generated');
            await this.recordCost(input, 1);
            return {
                status: 'SUCCESS',
                output: finalOutput,
                metrics: { durationMs },
            };
        }
        catch (e) {
            this.logger.error(`Execution failed: ${e.message}`, e.stack);
            return {
                status: 'FAILED',
                error: { code: 'PP_BASE_ERROR', message: e.message },
            };
        }
    }
    async auditHelper(input, type, resourceId) {
        await this.audit.log({
            action: `PP_${this.name.toUpperCase()}`,
            resourceId: resourceId,
            resourceType: 'pp_result',
            traceId: input.context.traceId || 'unknown',
            details: {
                projectId: input.context.projectId,
                userId: input.context.userId,
                cache: type,
                engine: this.name,
            },
            userId: input.context.userId || 'system',
            organizationId: input.context.organizationId,
        });
    }
    async recordCost(input, amount, extra = {}) {
        await this.cost.recordFromEvent({
            userId: input.context.userId || 'system',
            projectId: input.context.projectId || '',
            jobId: input.context.jobId,
            jobType: input.jobType || 'PP_RENDER',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: { type: 'pp_base', traceId: input.context.traceId || 'unknown', ...extra },
        });
    }
}
exports.PpBaseEngine = PpBaseEngine;
//# sourceMappingURL=pp_base.engine.js.map