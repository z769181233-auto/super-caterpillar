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
exports.PublishedVideoController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let PublishedVideoController = class PublishedVideoController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPublishedVideos(projectId, assetId, pipelineRunId) {
        const where = {};
        if (projectId)
            where.projectId = projectId;
        if (assetId)
            where.assetId = assetId;
        if (pipelineRunId) {
            where.metadata = {
                path: ['pipelineRunId'],
                equals: pipelineRunId,
            };
        }
        const records = await this.prisma.publishedVideo.findMany({
            where,
            include: {
                asset: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            success: true,
            data: records,
            record: records[0] || null,
            status: records[0]?.status || 'NOT_FOUND',
        };
    }
};
exports.PublishedVideoController = PublishedVideoController;
__decorate([
    (0, common_1.Get)('videos'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('assetId')),
    __param(2, (0, common_1.Query)('pipelineRunId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PublishedVideoController.prototype, "getPublishedVideos", null);
exports.PublishedVideoController = PublishedVideoController = __decorate([
    (0, common_1.Controller)('publish'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublishedVideoController);
//# sourceMappingURL=published-video.controller.js.map