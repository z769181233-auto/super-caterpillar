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
var IdentityConsistencyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityConsistencyService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const local_storage_service_1 = require("../storage/local-storage.service");
const ppv64_1 = require("./ppv64");
const image_decoder_1 = require("./image-decoder");
const project_resolver_1 = require("../common/project-resolver");
let IdentityConsistencyService = IdentityConsistencyService_1 = class IdentityConsistencyService {
    prisma;
    storage;
    projectResolver;
    logger = new common_1.Logger(IdentityConsistencyService_1.name);
    constructor(prisma, storage, projectResolver) {
        this.prisma = prisma;
        this.storage = storage;
        this.projectResolver = projectResolver;
    }
    async scoreIdentity(referenceAssetId, targetAssetId, characterId, shotId) {
        if (process.env.CE23_REAL_FORCE_DISABLE === '1') {
            this.logger.warn(`[P16-2] Real Scoring BLOCKED by CE23_REAL_FORCE_DISABLE in IdentityConsistencyService`);
            return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
        }
        let realEnabled = false;
        if (shotId) {
            const shotData = await this.prisma.shot.findUnique({
                where: { id: shotId },
                include: {
                    scene: {
                        include: {
                            episode: true,
                        },
                    },
                },
            });
            const projectWithSettings = await this.projectResolver.resolveProjectNeedSettings(shotData?.scene?.episode);
            const settings = projectWithSettings?.settingsJson || {};
            realEnabled = !!settings.ce23RealEnabled;
        }
        if (realEnabled) {
            this.logger.log(`Using REAL Identity Scoring for shot ${shotId}`);
            return this.scoreIdentityReal(referenceAssetId, targetAssetId, characterId);
        }
        return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
    }
    async scoreIdentityReal(referenceAssetId, targetAssetId, characterId) {
        try {
            const [refAsset, tarAsset] = await Promise.all([
                this.prisma.asset.findUnique({ where: { id: referenceAssetId } }),
                this.prisma.asset.findUnique({ where: { id: targetAssetId } }),
            ]);
            if (!refAsset || !tarAsset) {
                throw new Error('Asset not found for REAL identity scoring');
            }
            const refPath = this.storage.getAbsolutePath(refAsset.storageKey);
            const tarPath = this.storage.getAbsolutePath(tarAsset.storageKey);
            const [refPpv, tarPpv] = await Promise.all([
                (0, ppv64_1.ppv64FromImage)(refPath, image_decoder_1.nodeSharpDecoder),
                (0, ppv64_1.ppv64FromImage)(tarPath, image_decoder_1.nodeSharpDecoder),
            ]);
            const cosVal = (0, ppv64_1.cosine)(refPpv.vec, tarPpv.vec);
            const score = (cosVal + 1) / 2;
            const verdict = score >= 0.8 ? 'PASS' : 'FAIL';
            return {
                score: parseFloat(score.toFixed(4)),
                verdict,
                details: {
                    provider: 'real-embed-v1',
                    algo_version: 'ppv64@v1',
                    dims: 64,
                    score_mapping: '(cos+1)/2',
                    embedding_hash: tarPpv.embeddingHash,
                    anchor_file_sha256: refPpv.fileSha256,
                    target_file_sha256: tarPpv.fileSha256,
                    cosine_raw: parseFloat(cosVal.toFixed(4)),
                },
            };
        }
        catch (err) {
            this.logger.error(`REAL Identity Scoring failed: ${err.message}`, err.stack);
            return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
        }
    }
    async scoreIdentityStub(referenceAssetId, targetAssetId, characterId) {
        const inputString = `${referenceAssetId}|${targetAssetId}|${characterId}|v1`;
        const hash = (0, crypto_1.createHash)('sha256').update(inputString).digest('hex');
        const hexSegment = hash.substring(0, 8);
        const intValue = parseInt(hexSegment, 16);
        const scoreOffset = (intValue % 3000) / 10000;
        const score = 0.7 + scoreOffset;
        let finalScore = score;
        if (process.env.CE23_STUB_SCORE_MIN) {
            const minParam = parseFloat(process.env.CE23_STUB_SCORE_MIN);
            if (finalScore < minParam) {
                finalScore = minParam + finalScore * 0.01;
            }
        }
        const verdict = finalScore >= 0.85 ? 'PASS' : 'FAIL';
        return {
            score: parseFloat(finalScore.toFixed(4)),
            verdict,
            details: {
                provider: 'ce23-real-stub',
                version: '1.0.0',
                method: 'sha256_bucket_v1',
                inputs_hash: hash,
                original_algo_score: parseFloat(score.toFixed(4)),
            },
        };
    }
    async recordScore(shotId, characterId, referenceAnchorId, targetAssetId, scoreData) {
        const existing = await this.prisma.shotIdentityScore.findFirst({
            where: {
                shotId,
                characterId,
                referenceAnchorId,
                targetAssetId,
            },
        });
        if (existing) {
            return this.prisma.shotIdentityScore.update({
                where: { id: existing.id },
                data: {
                    identityScore: scoreData.score,
                    verdict: scoreData.verdict,
                    details: scoreData.details,
                    createdAt: new Date(),
                },
            });
        }
        return this.prisma.shotIdentityScore.create({
            data: {
                shotId,
                characterId,
                referenceAnchorId,
                targetAssetId,
                identityScore: scoreData.score,
                verdict: scoreData.verdict,
                details: scoreData.details,
            },
        });
    }
};
exports.IdentityConsistencyService = IdentityConsistencyService;
exports.IdentityConsistencyService = IdentityConsistencyService = IdentityConsistencyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => project_resolver_1.ProjectResolver))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        local_storage_service_1.LocalStorageService,
        project_resolver_1.ProjectResolver])
], IdentityConsistencyService);
//# sourceMappingURL=identity-consistency.service.js.map