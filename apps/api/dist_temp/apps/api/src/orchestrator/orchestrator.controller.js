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
exports.OrchestratorController = void 0;
const common_1 = require("@nestjs/common");
const orchestrator_service_1 = require("./orchestrator.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
let OrchestratorController = class OrchestratorController {
    orchestratorService;
    constructor(orchestratorService) {
        this.orchestratorService = orchestratorService;
    }
    async dispatch() {
        const result = await this.orchestratorService.dispatch();
        return {
            success: true,
            data: result,
        };
    }
    async getStats() {
        const stats = await this.orchestratorService.getStats();
        return {
            success: true,
            data: stats,
            requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            timestamp: new Date().toISOString(),
        };
    }
    async startStage1Pipeline(body) {
        console.log('[DEBUG_A1] Received Stage 1 Pipeline Request:', JSON.stringify({
            hasNovelText: !!body.novelText,
            novelTextLen: body.novelText?.length,
            projectId: body.projectId,
            pipelineRunId: body.pipelineRunId,
        }));
        try {
            const result = await this.orchestratorService.startStage1Pipeline({
                novelText: body.novelText,
                projectId: body.projectId,
                referenceSheetId: undefined,
            });
            console.log('[DEBUG_A1] Service call successful');
            return {
                success: true,
                data: result,
            };
        }
        catch (e) {
            console.error('[DEBUG_A1] Controller caught exception:', e.message, e.stack);
            throw e;
        }
    }
};
exports.OrchestratorController = OrchestratorController;
__decorate([
    (0, common_1.Post)('dispatch'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrchestratorController.prototype, "dispatch", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrchestratorController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)('pipeline/stage1'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrchestratorController.prototype, "startStage1Pipeline", null);
exports.OrchestratorController = OrchestratorController = __decorate([
    (0, common_1.Controller)('orchestrator'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [orchestrator_service_1.OrchestratorService])
], OrchestratorController);
//# sourceMappingURL=orchestrator.controller.js.map