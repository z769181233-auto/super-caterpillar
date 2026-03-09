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
exports.PipelineController = void 0;
const common_1 = require("@nestjs/common");
const pipeline_service_1 = require("./pipeline.service");
let PipelineController = class PipelineController {
    pipeline;
    constructor(pipeline) {
        this.pipeline = pipeline;
    }
    async getPipeline(projectId) {
        return { success: true, data: await this.pipeline.getPipeline(projectId) };
    }
    async retryNode(projectId, nodeId, req, body) {
        const actorId = req?.user?.id || 'unknown';
        const reason = body?.reason;
        const r = await this.pipeline.retryNode(projectId, nodeId, actorId, reason);
        return { success: true, data: r };
    }
    async skipNode(projectId, nodeId, req, body) {
        const actorId = req?.user?.id || 'unknown';
        const reason = body?.reason;
        const r = await this.pipeline.skipNode(projectId, nodeId, actorId, reason);
        return { success: true, data: r };
    }
    async forcePassNode(projectId, nodeId, req, body) {
        const actorId = req?.user?.id || 'unknown';
        const reason = body?.reason;
        const r = await this.pipeline.forcePassNode(projectId, nodeId, actorId, reason);
        return { success: true, data: r };
    }
};
exports.PipelineController = PipelineController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "getPipeline", null);
__decorate([
    (0, common_1.Post)('/nodes/:nodeId/retry'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('nodeId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "retryNode", null);
__decorate([
    (0, common_1.Post)('/nodes/:nodeId/skip'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('nodeId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "skipNode", null);
__decorate([
    (0, common_1.Post)('/nodes/:nodeId/force-pass'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('nodeId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "forcePassNode", null);
exports.PipelineController = PipelineController = __decorate([
    (0, common_1.Controller)('/api/projects/:projectId/pipeline'),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService])
], PipelineController);
//# sourceMappingURL=pipeline.controller.js.map