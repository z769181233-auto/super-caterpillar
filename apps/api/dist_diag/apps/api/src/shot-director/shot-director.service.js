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
var ShotDirectorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotDirectorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let ShotDirectorService = ShotDirectorService_1 = class ShotDirectorService {
    prisma;
    auditLogService;
    logger = new common_1.Logger(ShotDirectorService_1.name);
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async inpaint(shotId, userId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
        });
        if (!shot) {
            throw new common_1.NotFoundException(`Shot ${shotId} not found`);
        }
        await this.auditLogService.record({
            userId,
            action: 'SHOT_INPAINT',
            resourceType: 'shot',
            resourceId: shotId,
            details: { operation: 'inpaint' },
        });
        return {
            success: true,
            data: {
                shotId,
                jobId: `inpaint-job-${shotId}`,
                status: 'PENDING',
            },
        };
    }
    async pose(shotId, userId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
        });
        if (!shot) {
            throw new common_1.NotFoundException(`Shot ${shotId} not found`);
        }
        await this.auditLogService.record({
            userId,
            action: 'SHOT_POSE',
            resourceType: 'shot',
            resourceId: shotId,
            details: { operation: 'pose' },
        });
        return {
            success: true,
            data: {
                shotId,
                jobId: `pose-job-${shotId}`,
                status: 'PENDING',
            },
        };
    }
    async composeVideo(sceneId, userId, organizationId) {
        try {
            const scene = await this.prisma.scene.findUnique({
                where: { id: sceneId },
                include: {
                    shots: {
                        orderBy: { index: 'asc' },
                        include: {
                            assets: {
                                where: { type: 'IMAGE', status: 'GENERATED' },
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                            },
                        },
                    },
                    episode: {
                        include: {
                            season: {
                                include: {
                                    project: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!scene) {
                throw new common_1.NotFoundException(`Scene ${sceneId} not found`);
            }
            const assets = [];
            for (const shot of scene.shots) {
                if (shot.assets && shot.assets.length > 0) {
                    assets.push(shot.assets[0].storageKey);
                }
            }
            if (assets.length === 0) {
                throw new Error(`Scene ${sceneId} has no generated assets to compose`);
            }
            const anchorShotId = scene.shots[0].id;
            const finalOrganizationId = organizationId || scene.episode?.season?.project?.organizationId;
            const finalProjectId = scene.episode?.season?.project?.id;
            if (!finalOrganizationId || !finalProjectId) {
                throw new Error(`Cannot determine project/org for scene ${sceneId}`);
            }
            const taskId = (await this.prisma.task.create({
                data: {
                    organizationId: finalOrganizationId,
                    projectId: finalProjectId,
                    type: 'VIDEO_RENDER',
                    status: 'PENDING',
                    payload: { sceneId, assetsCount: assets.length },
                },
            })).id;
            const job = await this.prisma.shotJob.create({
                data: {
                    organizationId: finalOrganizationId,
                    projectId: finalProjectId,
                    episodeId: scene.episodeId,
                    sceneId: scene.id,
                    shotId: anchorShotId,
                    taskId: taskId,
                    type: 'VIDEO_RENDER',
                    status: 'PENDING',
                    payload: {
                        sceneId,
                        assets,
                        outputFormat: 'mp4',
                    },
                    retryCount: 0,
                    priority: 10,
                },
            });
            let engine = await this.prisma.engine.findUnique({ where: { engineKey: 'ffmpeg_local' } });
            if (!engine) {
                engine = await this.prisma.engine.create({
                    data: {
                        code: 'ffmpeg_local',
                        name: 'FFmpeg Local Renderer',
                        type: 'local',
                        engineKey: 'ffmpeg_local',
                        adapterName: 'default_shot_render',
                        adapterType: 'local',
                        config: {},
                        isActive: true,
                    },
                });
            }
            await this.prisma.jobEngineBinding.create({
                data: {
                    jobId: job.id,
                    engineId: engine.id,
                    engineKey: engine.engineKey,
                    status: 'BOUND',
                    metadata: { strategy: 'default' },
                },
            });
            this.auditLogService.record({
                userId,
                action: 'VIDEO_RENDER_TRIGGERED',
                resourceType: 'job',
                resourceId: job.id,
                details: { sceneId, assetsCount: assets.length },
            });
            return {
                success: true,
                data: {
                    jobId: job.id,
                    status: 'PENDING',
                    assetsCount: assets.length,
                },
            };
        }
        catch (e) {
            this.logger.error('Failed to compose video', e);
            throw e;
        }
    }
};
exports.ShotDirectorService = ShotDirectorService;
exports.ShotDirectorService = ShotDirectorService = ShotDirectorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], ShotDirectorService);
//# sourceMappingURL=shot-director.service.js.map