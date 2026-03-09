"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NlpBaseEngine = void 0;
const common_1 = require("@nestjs/common");
const nlp_tokenizer_1 = require("./nlp_tokenizer");
const nlp_output_schema_1 = require("./nlp_output_schema");
const perf_hooks_1 = require("perf_hooks");
class NlpBaseEngine {
    name;
    cache;
    audit;
    cost;
    logger;
    constructor(name, cache, audit, cost) {
        this.name = name;
        this.cache = cache;
        this.audit = audit;
        this.cost = cost;
        this.logger = new common_1.Logger(`${NlpBaseEngine.name}[${name}]`);
    }
    supports(engineKey) {
        return engineKey === this.name;
    }
    async execute(input, payload) {
        const t0 = perf_hooks_1.performance.now();
        const cacheKey = this.cache.generateKey(this.name, payload);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            await this.auditHelper(input, 'HIT', cacheKey);
            await this.recordCost(input, 0, { status: 'CACHE_HIT' });
            return {
                status: 'SUCCESS',
                output: { ...cached, meta: { ...cached.meta, source: 'cache', cached: true } },
            };
        }
        try {
            const analysis = await this.processLogic(payload, input);
            const chars = nlp_tokenizer_1.NlpTokenizer.countChars(JSON.stringify(payload));
            const tokens = nlp_tokenizer_1.NlpTokenizer.estimateTokens(JSON.stringify(payload));
            const durationMs = Math.round(perf_hooks_1.performance.now() - t0);
            const result = {
                status: 'PASS',
                analysis,
                metrics: { chars, estimatedTokens: tokens, durationMs },
                meta: {
                    source: 'generated',
                    implementation: 'nlp_base_v1',
                    cached: false,
                },
            };
            if (!(0, nlp_output_schema_1.validateNlpOutput)(result)) {
                throw new Error('Invalid NLP output structure');
            }
            await this.cache.set(cacheKey, result);
            await this.auditHelper(input, 'MISS', 'generated');
            await this.recordCost(input, 1);
            return {
                status: 'SUCCESS',
                output: result,
                metrics: { durationMs },
            };
        }
        catch (e) {
            this.logger.error(`Execution failed: ${e.message}`, e.stack);
            return {
                status: 'FAILED',
                error: { code: 'NLP_BASE_ERROR', message: e.message },
            };
        }
    }
    async auditHelper(input, type, resourceId) {
        await this.audit.log({
            action: `NLP_${this.name.toUpperCase()}`,
            resourceId: resourceId,
            resourceType: 'nlp_result',
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
            jobType: input.jobType || 'NOVEL_ANALYSIS',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: { type: 'nlp_base', traceId: input.context.traceId || 'unknown', ...extra },
        });
    }
}
exports.NlpBaseEngine = NlpBaseEngine;
//# sourceMappingURL=nlp_base.js.map