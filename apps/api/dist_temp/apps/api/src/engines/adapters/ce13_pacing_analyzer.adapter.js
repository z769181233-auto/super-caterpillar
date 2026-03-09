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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE13PacingAnalyzerAdapter = void 0;
const common_1 = require("@nestjs/common");
const nlp_base_1 = require("../nlp/nlp_base");
const nlp_cache_1 = require("../nlp/nlp_cache");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
let CE13PacingAnalyzerAdapter = class CE13PacingAnalyzerAdapter extends nlp_base_1.NlpBaseEngine {
    constructor(redis, audit, cost) {
        super('ce13_pacing_analyzer', new nlp_cache_1.NlpCache(redis), audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const text = payload.text || '';
        const sentenceCount = text.split(/[.!?]/).filter((s) => s.trim().length > 0).length;
        const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
        const avgWordPerSentence = wordCount / (sentenceCount || 1);
        let pacing = 'MODERATE';
        if (avgWordPerSentence < 8)
            pacing = 'FAST';
        if (avgWordPerSentence > 20)
            pacing = 'SLOW';
        return {
            pacing,
            metrics: {
                avg_word_per_sentence: avgWordPerSentence,
                sentence_count: sentenceCount,
                word_count: wordCount,
            },
            tension_level: pacing === 'FAST' ? 'HIGH' : pacing === 'SLOW' ? 'LOW' : 'MEDIUM',
        };
    }
};
exports.CE13PacingAnalyzerAdapter = CE13PacingAnalyzerAdapter;
exports.CE13PacingAnalyzerAdapter = CE13PacingAnalyzerAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], CE13PacingAnalyzerAdapter);
//# sourceMappingURL=ce13_pacing_analyzer.adapter.js.map