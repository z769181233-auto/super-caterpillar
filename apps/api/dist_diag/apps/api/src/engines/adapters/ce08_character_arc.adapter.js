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
exports.CE08CharacterArcAdapter = void 0;
const common_1 = require("@nestjs/common");
const nlp_base_1 = require("../nlp/nlp_base");
const nlp_cache_1 = require("../nlp/nlp_cache");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const engines_ce08_1 = require("@scu/engines-ce08");
let CE08CharacterArcAdapter = class CE08CharacterArcAdapter extends nlp_base_1.NlpBaseEngine {
    constructor(redis, audit, cost) {
        super('ce08_character_arc', new nlp_cache_1.NlpCache(redis), audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const text = payload.text || payload.structured_text || '';
        const characterName = payload.characterName || 'Unknown';
        const result = await engines_ce08_1.ce08RealEngine.run({
            character_name: characterName,
            scenario_text: text,
            previous_state: payload.previousState,
        });
        return {
            character: result.character_name || 'Mock',
            archetype: result.archetype || 'Mock',
            state: result.current_state || 'Mock',
            markers: result.progression_markers || ['STATIC'],
            arc_status: result.arc_status || 'Mock',
            ai_description: result.description || 'Mock',
            meta: {
                engine: result.audit_trail?.engine_version || 'mock_v1',
            },
        };
    }
};
exports.CE08CharacterArcAdapter = CE08CharacterArcAdapter;
exports.CE08CharacterArcAdapter = CE08CharacterArcAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], CE08CharacterArcAdapter);
//# sourceMappingURL=ce08_character_arc.adapter.js.map