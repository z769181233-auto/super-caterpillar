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
exports.OrchestratorMonitorController = void 0;
const common_1 = require("@nestjs/common");
const orchestrator_service_1 = require("./orchestrator.service");
const crypto_1 = require("crypto");
let OrchestratorMonitorController = class OrchestratorMonitorController {
    orchestratorService;
    constructor(orchestratorService) {
        this.orchestratorService = orchestratorService;
    }
    async getStats() {
        const stats = await this.orchestratorService.getStats();
        return {
            success: true,
            data: stats,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.OrchestratorMonitorController = OrchestratorMonitorController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrchestratorMonitorController.prototype, "getStats", null);
exports.OrchestratorMonitorController = OrchestratorMonitorController = __decorate([
    (0, common_1.Controller)('orchestrator/monitor'),
    __metadata("design:paramtypes", [orchestrator_service_1.OrchestratorService])
], OrchestratorMonitorController);
//# sourceMappingURL=orchestrator-monitor.controller.js.map