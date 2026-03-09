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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineStrategyService = void 0;
const common_1 = require("@nestjs/common");
const engine_routing_service_1 = require("./engine-routing.service");
let EngineStrategyService = class EngineStrategyService {
    engineRoutingService;
    constructor(engineRoutingService) {
        this.engineRoutingService = engineRoutingService;
    }
    decideStrategy(jobType, payload, baseEngineKey, context) {
        if (jobType === 'CE11_SHOT_GENERATOR') {
            const isVerification = payload?.isVerification === true || payload?.gateMode === true;
            const explicitEngineKey = baseEngineKey || payload?.engineKey || payload?.engine;
            if (!isVerification && !explicitEngineKey) {
                throw new common_1.BadRequestException('CE11_SHOT_GENERATOR requires explicit engineKey in production (e.g. ce11_shot_generator_real)');
            }
            if (isVerification && !explicitEngineKey) {
                return {
                    engineKey: 'ce11_shot_generator_mock',
                    resolvedVersion: null,
                    strategyLabel: 'p5_verification_fallback',
                };
            }
        }
        const routingResult = this.engineRoutingService.resolve({
            jobType,
            baseEngineKey,
            payload,
        });
        return {
            engineKey: routingResult.engineKey,
            resolvedVersion: routingResult.resolvedVersion,
            strategyLabel: 'default',
        };
    }
};
exports.EngineStrategyService = EngineStrategyService;
exports.EngineStrategyService = EngineStrategyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_routing_service_1.EngineRoutingService])
], EngineStrategyService);
//# sourceMappingURL=engine-strategy.service.js.map