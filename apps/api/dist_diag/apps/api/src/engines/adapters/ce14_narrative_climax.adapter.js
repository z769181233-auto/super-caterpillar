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
exports.Ce14NarrativeClimaxAdapter = void 0;
const common_1 = require("@nestjs/common");
const nlp_base_1 = require("../nlp/nlp_base");
const nlp_cache_1 = require("../nlp/nlp_cache");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
let Ce14NarrativeClimaxAdapter = class Ce14NarrativeClimaxAdapter extends nlp_base_1.NlpBaseEngine {
    constructor(redis, audit, cost) {
        super('ce14_narrative_climax', new nlp_cache_1.NlpCache(redis), audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload, input) {
        this.logger.log(`Processing CE14 Climax for project: ${input.context.projectId}`);
        const text = payload.text || '';
        const mockClimax = {
            climax_detected: text.length > 500,
            peak_intensity: 0.88,
            indices: [100, 250, 480],
            meta: { v: '1.0.0-nlp-base' },
        };
        return mockClimax;
    }
};
exports.Ce14NarrativeClimaxAdapter = Ce14NarrativeClimaxAdapter;
exports.Ce14NarrativeClimaxAdapter = Ce14NarrativeClimaxAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], Ce14NarrativeClimaxAdapter);
//# sourceMappingURL=ce14_narrative_climax.adapter.js.map