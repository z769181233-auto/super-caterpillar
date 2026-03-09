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
var G5SubengineHubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.G5SubengineHubService = void 0;
const common_1 = require("@nestjs/common");
const engine_invoker_hub_service_1 = require("../engine-hub/engine-invoker-hub.service");
let G5SubengineHubService = G5SubengineHubService_1 = class G5SubengineHubService {
    invokerHub;
    logger = new common_1.Logger(G5SubengineHubService_1.name);
    constructor(invokerHub) {
        this.invokerHub = invokerHub;
    }
    async generateG5Manifest(payload) {
        this.logger.log(`[G5-HUB] Starting content sealing for project: ${payload.projectId}`);
        const dialogueResult = await this.invokerHub.invoke({
            engineKey: 'g5_dialogue_binding',
            payload: {
                story: payload.story,
                renderPlan: payload.renderPlan,
                outputDir: payload.outputDir,
            },
            metadata: { traceId: payload.traceId, projectId: payload.projectId },
        });
        if (!dialogueResult.success)
            throw new Error(`G5_DIALOGUE failed: ${dialogueResult.error?.message}`);
        const motionResult = await this.invokerHub.invoke({
            engineKey: 'g5_semantic_motion',
            payload: {
                renderPlan: payload.renderPlan,
                outputDir: payload.outputDir,
            },
            metadata: { traceId: payload.traceId, projectId: payload.projectId },
        });
        if (!motionResult.success)
            throw new Error(`G5_MOTION failed: ${motionResult.error?.message}`);
        const layeringResult = await this.invokerHub.invoke({
            engineKey: 'g5_asset_layering',
            payload: {
                renderPlan: payload.renderPlan,
                outputDir: payload.outputDir,
            },
            metadata: { traceId: payload.traceId, projectId: payload.projectId },
        });
        if (!layeringResult.success)
            throw new Error(`G5_LAYERING failed: ${layeringResult.error?.message}`);
        this.logger.log(`[G5-HUB] Successfully sealed manifest at: ${payload.outputDir}`);
        return {
            dialogue_plan: dialogueResult.output,
            motion_plan: motionResult.output,
            layering_plan: layeringResult.output,
            staged_dir: payload.outputDir,
        };
    }
};
exports.G5SubengineHubService = G5SubengineHubService;
exports.G5SubengineHubService = G5SubengineHubService = G5SubengineHubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_invoker_hub_service_1.EngineInvokerHubService])
], G5SubengineHubService);
//# sourceMappingURL=g5-subengine-hub.service.js.map