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
exports.AU01VoiceTTSAdapter = void 0;
const common_1 = require("@nestjs/common");
const au_base_engine_1 = require("../base/au_base.engine");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
const audio_service_1 = require("../../audio/audio.service");
let AU01VoiceTTSAdapter = class AU01VoiceTTSAdapter extends au_base_engine_1.AuBaseEngine {
    audioService;
    constructor(redis, audit, cost, audioService) {
        super('au01_voice_tts', redis, audit, cost);
        this.audioService = audioService;
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        const text = payload.text || 'hello';
        const result = await this.audioService.generateAndMix({
            text,
            projectSettings: {
                audioRealEnabled: true,
                audioBgmEnabled: false,
            },
            preview: payload.preview === true,
        });
        return {
            assetUrl: `file://${result.voice.absPath}`,
            meta: {
                ...result.voice.meta,
                text,
                format: 'wav',
            },
        };
    }
};
exports.AU01VoiceTTSAdapter = AU01VoiceTTSAdapter;
exports.AU01VoiceTTSAdapter = AU01VoiceTTSAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService,
        audio_service_1.AudioService])
], AU01VoiceTTSAdapter);
//# sourceMappingURL=au01_voice_tts.adapter.js.map