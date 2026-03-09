"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineRoutingService = void 0;
const common_1 = require("@nestjs/common");
let EngineRoutingService = class EngineRoutingService {
    resolve(input) {
        const jobType = input.jobType || '';
        const payload = input.payload || {};
        let engineKey = input.baseEngineKey || null;
        if (payload.engineKey && typeof payload.engineKey === 'string') {
            engineKey = payload.engineKey;
            return {
                engineKey,
                resolvedVersion: payload.engineVersion ?? null,
            };
        }
        if (jobType === 'NOVEL_ANALYSIS') {
            const useHttpEngine = payload.useHttpEngine === true;
            const isHttpJobType = jobType.endsWith('_HTTP');
            if (!useHttpEngine && !isHttpJobType) {
                return {
                    engineKey: 'default_novel_analysis',
                    resolvedVersion: payload.engineVersion ?? null,
                };
            }
        }
        const isHttpJobType = jobType.endsWith('_HTTP');
        if (isHttpJobType && engineKey) {
            return {
                engineKey,
                resolvedVersion: payload.engineVersion ?? null,
            };
        }
        if (!isHttpJobType && payload.useHttpEngine === true) {
            if (jobType === 'NOVEL_ANALYSIS') {
                engineKey = 'http_real_novel_analysis';
            }
            else if (jobType === 'SHOT_RENDER') {
                engineKey = 'http_real_shot_render';
            }
        }
        return {
            engineKey,
            resolvedVersion: payload.engineVersion ?? null,
        };
    }
};
exports.EngineRoutingService = EngineRoutingService;
exports.EngineRoutingService = EngineRoutingService = __decorate([
    (0, common_1.Injectable)()
], EngineRoutingService);
//# sourceMappingURL=engine-routing.service.js.map