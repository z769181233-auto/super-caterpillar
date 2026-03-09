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
var EmotionAnalysisAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmotionAnalysisAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
let EmotionAnalysisAdapter = EmotionAnalysisAdapter_1 = class EmotionAnalysisAdapter {
    redisService;
    auditService;
    costLedgerService;
    name = 'emotion_analysis';
    logger = new common_1.Logger(EmotionAnalysisAdapter_1.name);
    constructor(redisService, auditService, costLedgerService) {
        this.redisService = redisService;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'emotion_analysis';
    }
    async invoke(input) {
        const payload = input.payload || {};
        const text = payload.text || '';
        if (!text) {
            return {
                status: 'FAILED',
                error: { code: 'EMO_NO_TEXT', message: 'Missing text input' },
            };
        }
        const inputHash = (0, crypto_1.createHash)('sha256').update(text).digest('hex');
        const cacheKey = `emotion:v1:${inputHash}`;
        try {
            const cached = await this.redisService.getJson(cacheKey);
            if (cached) {
                await this.auditHelper(input, 'HIT', cacheKey);
                await this.recordCost(input, 0, { status: 'CACHE_HIT' });
                return {
                    status: 'SUCCESS',
                    output: { ...cached, source: 'cache', meta: { cached: true } },
                };
            }
        }
        catch (e) {
            this.logger.warn(`Cache read error: ${e}`);
        }
        const lower = text.toLowerCase();
        let primary = 'neutral';
        const labels = ['neutral'];
        let intensity = 0.5;
        let reasons = ['default fallback'];
        if (lower.match(/(happy|joy|glad|smile)/)) {
            primary = 'joy';
            labels.push('joy');
            intensity = 0.8;
            reasons = ['keyword_match: positive'];
        }
        else if (lower.match(/(sad|cry|grief|tear)/)) {
            primary = 'sadness';
            labels.push('sadness');
            intensity = 0.7;
            reasons = ['keyword_match: negative'];
        }
        else if (lower.match(/(angry|mad|furious|rage)/)) {
            primary = 'anger';
            labels.push('anger');
            intensity = 0.9;
            reasons = ['keyword_match: high_intensity'];
        }
        const output = {
            primary,
            labels: [...new Set(labels)],
            intensity,
            reasons,
            meta: { implementation: 'stub_regex' },
        };
        await this.redisService.setJson(cacheKey, output, 60 * 60 * 24 * 7);
        await this.auditHelper(input, 'MISS', 'generated');
        await this.recordCost(input, 1);
        return {
            status: 'SUCCESS',
            output: { ...output, source: 'generated' },
        };
    }
    async auditHelper(input, type, resourceId) {
        await this.auditService.log({
            action: 'EMOTION_ANALYSIS',
            resourceId: resourceId,
            resourceType: 'emotion_result',
            details: {
                projectId: input.context.projectId,
                userId: input.context.userId || 'system',
                cache: type,
                traceId: input.context.traceId,
            },
        });
    }
    async recordCost(input, amount, extra = {}) {
        await this.costLedgerService.recordFromEvent({
            userId: input.context.userId || 'system',
            projectId: input.context.projectId || '',
            jobId: input.context.jobId,
            jobType: input.jobType || 'EMOTION_ANALYSIS',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: { type: 'emotion_analysis', traceId: input.context.traceId || 'unknown', ...extra },
        });
    }
};
exports.EmotionAnalysisAdapter = EmotionAnalysisAdapter;
exports.EmotionAnalysisAdapter = EmotionAnalysisAdapter = EmotionAnalysisAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], EmotionAnalysisAdapter);
//# sourceMappingURL=emotion_analysis.adapter.js.map