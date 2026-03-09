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
exports.PublishedVideoService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PublishedVideoService = class PublishedVideoService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recordPublishedVideo(params) {
        const { projectId, episodeId, assetId, storageKey, checksum, pipelineRunId } = params;
        return await this.prisma.$transaction(async (tx) => {
            let pv = await tx.publishedVideo.findFirst({
                where: { assetId },
            });
            if (!pv) {
                pv = await tx.publishedVideo.create({
                    data: {
                        projectId,
                        episodeId,
                        assetId,
                        storageKey,
                        checksum,
                        status: 'INTERNAL_READY',
                        metadata: {
                            pipelineRunId,
                            publishedAt: new Date().toISOString(),
                        },
                    },
                });
            }
            await tx.asset.update({
                where: { id: assetId },
                data: { status: 'PUBLISHED' },
            });
            return pv;
        });
    }
};
exports.PublishedVideoService = PublishedVideoService;
exports.PublishedVideoService = PublishedVideoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublishedVideoService);
//# sourceMappingURL=published-video.service.js.map