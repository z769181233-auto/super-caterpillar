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
exports.AssetReceiptResolverService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AssetReceiptResolverService = class AssetReceiptResolverService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveAsset(params) {
        const { projectId, traceId, jobId, jobCreatedAt } = params;
        const fiveMins = 5 * 60 * 1000;
        const level1 = await this.prisma.asset.findMany({
            where: { createdByJobId: jobId },
            include: { publishedVideo: true },
            orderBy: { createdAt: 'desc' },
        });
        if (level1.length > 0) {
            const asset = level1[0];
            return this.mapAssetToReceipt(asset, level1.length > 1 ? 'MULTI_MATCH_CREATED_BY_JOBID' : null);
        }
        const level2 = await this.prisma.asset.findFirst({
            where: {
                job: { traceId },
                projectId,
                status: 'PUBLISHED',
                type: 'VIDEO',
            },
            include: { publishedVideo: true },
            orderBy: { createdAt: 'desc' },
        });
        if (level2) {
            return this.mapAssetToReceipt(level2, null);
        }
        const level3 = await this.prisma.asset.findFirst({
            where: {
                projectId,
                job: { traceId },
                createdAt: {
                    gte: new Date(jobCreatedAt.getTime() - fiveMins),
                    lte: new Date(jobCreatedAt.getTime() + fiveMins),
                },
                status: 'PUBLISHED',
                type: 'VIDEO',
            },
            include: { publishedVideo: true },
            orderBy: { createdAt: 'desc' },
        });
        if (level3) {
            return this.mapAssetToReceipt(level3, null);
        }
        const level4 = await this.prisma.asset.findFirst({
            where: {
                projectId,
                status: 'PUBLISHED',
                type: 'VIDEO',
            },
            include: { publishedVideo: true },
            orderBy: { createdAt: 'desc' },
        });
        if (level4) {
            return this.mapAssetToReceipt(level4, 'HEURISTIC_LATEST_PUBLISHED_ASSET');
        }
        return {
            asset_id: null,
            hls_url: null,
            mp4_url: null,
            checksum: null,
            storage_key: null,
            duration_sec: null,
            fallback_reason: null,
            error_code: 'ERR_ASSET_NOT_FOUND',
        };
    }
    mapAssetToReceipt(asset, fallbackReason) {
        const metadata = asset.publishedVideo?.metadata || {};
        return {
            asset_id: asset.id,
            hls_url: asset.hlsPlaylistUrl,
            mp4_url: asset.signedUrl,
            checksum: asset.checksum,
            storage_key: asset.storageKey,
            duration_sec: metadata.duration_sec || 0,
            fallback_reason: fallbackReason,
        };
    }
};
exports.AssetReceiptResolverService = AssetReceiptResolverService;
exports.AssetReceiptResolverService = AssetReceiptResolverService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssetReceiptResolverService);
//# sourceMappingURL=asset-receipt-resolver.service.js.map