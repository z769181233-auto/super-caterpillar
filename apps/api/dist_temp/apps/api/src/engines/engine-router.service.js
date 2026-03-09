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
    resolve(params) {
        const { jobType, payload, defaultEngineKey, httpDefaultEngineKey } = params;
        const isHttpJob = jobType.endsWith('_HTTP');
        const resolvedVersion = payload?.engineVersion ?? undefined;
        if (jobType === 'NOVEL_ANALYSIS' && payload?.useHttpEngine !== true && !isHttpJob) {
            return {
                engineKey: 'default_novel_analysis',
                resolvedVersion,
            };
        }
        let engineKey = defaultEngineKey || 'default_novel_analysis';
        if (isHttpJob && defaultEngineKey) {
            engineKey = defaultEngineKey;
        }
        if (!isHttpJob && payload?.useHttpEngine === true && httpDefaultEngineKey) {
            engineKey = httpDefaultEngineKey;
        }
        if (payload?.engineKey) {
            engineKey = payload.engineKey;
        }
        return { engineKey, resolvedVersion };
    }
};
exports.EngineRoutingService = EngineRoutingService;
exports.EngineRoutingService = EngineRoutingService = __decorate([
    (0, common_1.Injectable)()
], EngineRoutingService);
//# sourceMappingURL=engine-router.service.js.map