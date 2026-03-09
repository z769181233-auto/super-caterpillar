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
var DialogueOptimizationAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogueOptimizationAdapter = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../redis/redis.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
let DialogueOptimizationAdapter = DialogueOptimizationAdapter_1 = class DialogueOptimizationAdapter {
    redisService;
    auditService;
    costLedgerService;
    name = 'dialogue_optimization';
    logger = new common_1.Logger(DialogueOptimizationAdapter_1.name);
    constructor(redisService, auditService, costLedgerService) {
        this.redisService = redisService;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'dialogue_optimization';
    }
    async invoke(input) {
        const payload = input.payload || {};
        const dialogue = payload.dialogue || '';
        const persona = payload.persona || 'neutral';
        if (!dialogue) {
            return {
                status: 'FAILED',
                error: { code: 'DIA_NO_TEXT', message: 'Missing dialogue input' },
            };
        }
        const inputHash = (0, crypto_1.createHash)('sha256')
            .update(dialogue + persona)
            .digest('hex');
        const cacheKey = `dialogue:v1:${inputHash}`;
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
        let optimized = dialogue;
        const ooc_flags = [];
        const rules_applied = [];
        if (persona === 'polite' && dialogue.toLowerCase().match(/(shutup|shut up|idiot)/)) {
            ooc_flags.push('RUDE_DETECTED');
        }
        if (dialogue.match(/\bgonna\b/i)) {
            optimized = optimized.replace(/\bgonna\b/gi, 'going to');
            rules_applied.push('expand_contraction');
        }
        if (dialogue.match(/\bwanna\b/i)) {
            optimized = optimized.replace(/\bwanna\b/gi, 'want to');
            rules_applied.push('expand_contraction');
        }
        const diff_count = rules_applied.length;
        const output = {
            optimized,
            ooc_flags,
            rules_applied,
            diff_summary: { count: diff_count },
            meta: { implementation: 'stub_rules', persona },
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
            action: 'DIALOGUE_OPTIMIZATION',
            resourceId: resourceId,
            resourceType: 'dialogue_result',
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
            jobType: input.jobType || 'NOVEL_ANALYSIS',
            engineKey: this.name,
            costAmount: amount,
            billingUnit: 'job',
            quantity: 1,
            attempt: input.context.attempt || 1,
            metadata: {
                type: 'dialogue_optimization',
                traceId: input.context.traceId || 'unknown',
                ...extra,
            },
        });
    }
};
exports.DialogueOptimizationAdapter = DialogueOptimizationAdapter;
exports.DialogueOptimizationAdapter = DialogueOptimizationAdapter = DialogueOptimizationAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], DialogueOptimizationAdapter);
//# sourceMappingURL=dialogue_optimization.adapter.js.map