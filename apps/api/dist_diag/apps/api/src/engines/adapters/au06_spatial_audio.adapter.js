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
exports.AU06SpatialAudioAdapter = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const redis_service_1 = require("../../redis/redis.service");
let AU06SpatialAudioAdapter = class AU06SpatialAudioAdapter {
    redis;
    audit;
    cost;
    name = 'au06_spatial_audio';
    constructor(redis, audit, cost) {
        this.redis = redis;
        this.audit = audit;
        this.cost = cost;
    }
    supports(engineKey) {
        return engineKey === this.name;
    }
    async invoke(input) {
        const { payload, context } = input;
        await this.audit.log({
            userId: context.userId,
            traceId: context.traceId,
            resourceType: 'project',
            resourceId: context.projectId,
            action: 'AU06_INVOKE',
            details: payload,
        });
        const output = {
            format: 'Ambisonics',
            sourcePositions: payload.sources || [{ name: 'char1', x: 2.0, y: 1.0, z: -3.0 }],
            spatialAudioUrl: 'file:///storage/audio/spatial/out_001.wav',
            meta: { engine: 'au06-spatial-mapping-stub' },
        };
        await this.cost.recordFromEvent({
            userId: context.userId || 'system',
            projectId: context.projectId || 'unknown',
            jobId: context.jobId || 'unknown',
            jobType: 'AU_RENDER',
            engineKey: this.name,
            costAmount: 0.15,
            billingUnit: 'seconds',
            quantity: 30,
        });
        return {
            status: 'SUCCESS',
            output,
        };
    }
};
exports.AU06SpatialAudioAdapter = AU06SpatialAudioAdapter;
exports.AU06SpatialAudioAdapter = AU06SpatialAudioAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(cost_ledger_service_1.CostLedgerService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], AU06SpatialAudioAdapter);
//# sourceMappingURL=au06_spatial_audio.adapter.js.map