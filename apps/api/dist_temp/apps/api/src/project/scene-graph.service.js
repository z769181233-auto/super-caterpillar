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
var SceneGraphService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneGraphService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../prisma/prisma.service");
const scene_graph_cache_1 = require("./scene-graph.cache");
let SceneGraphService = SceneGraphService_1 = class SceneGraphService {
    prisma;
    cache;
    logger = new common_1.Logger(SceneGraphService_1.name);
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async handleStructureChanged(payload) {
        this.logger.log(`[Event] Invalidating SceneGraph cache for project ${payload.projectId} (Context: ${payload.context || 'generic'})`);
        await this.invalidateProjectSceneGraph(payload.projectId);
    }
    async getProjectSceneGraph(projectId) {
        const cached = await this.cache.get(projectId);
        if (cached) {
            return cached;
        }
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                tasks: {
                    where: { type: 'NOVEL_ANALYSIS' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        updatedAt: true,
                    },
                },
                episodes: {
                    include: {
                        scenes: {
                            include: {
                                shots: {
                                    orderBy: { index: 'asc' },
                                },
                            },
                            orderBy: { sceneIndex: 'asc' },
                        },
                    },
                    orderBy: { index: 'asc' },
                },
            },
        });
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        const projectData = project;
        const tasks = projectData.tasks || [];
        const succeeded = tasks.find((t) => t.status === 'SUCCEEDED');
        const failed = tasks.find((t) => t.status === 'FAILED');
        let analysisStatus = 'PENDING';
        let analysisUpdatedAt = null;
        if (succeeded) {
            analysisStatus = 'DONE';
            analysisUpdatedAt = succeeded.updatedAt.toISOString();
        }
        else if (failed) {
            analysisStatus = 'FAILED';
            analysisUpdatedAt = failed.updatedAt.toISOString();
        }
        else {
            const pendingOrRunning = tasks.find((t) => t.status === 'PENDING' || t.status === 'RUNNING' || t.status === 'RETRYING');
            if (pendingOrRunning) {
                analysisStatus = 'ANALYZING';
                analysisUpdatedAt = pendingOrRunning.updatedAt.toISOString();
            }
        }
        const sceneGraph = {
            projectId: project.id,
            projectName: project.name,
            projectStatus: project.status,
            analysisStatus,
            analysisUpdatedAt,
            seasons: [],
            episodes: projectData.episodes.map((episode) => this.mapEpisodeToNode(episode, project.id)),
        };
        await this.cache.set(projectId, sceneGraph);
        return sceneGraph;
    }
    async invalidateProjectSceneGraph(projectId) {
        await this.cache.invalidate(projectId);
    }
    mapSeasonToNode(season) {
        return {
            id: season.id,
            parentId: season.projectId,
            index: season.index,
            title: season.title,
            description: season.description || null,
            episodes: season.episodes.map((episode) => this.mapEpisodeToNode(episode, season.projectId)),
            engineContext: season.metadata || undefined,
        };
    }
    mapEpisodeToNode(episode, parentId) {
        return {
            id: episode.id,
            parentId: episode.seasonId || parentId,
            index: episode.index,
            name: episode.name,
            summary: episode.summary || null,
            scenes: episode.scenes.map((scene) => this.mapSceneToNode(scene)),
            engineContext: undefined,
        };
    }
    mapSceneToNode(scene) {
        return {
            id: scene.id,
            parentId: scene.episodeId,
            index: scene.sceneIndex,
            title: scene.title,
            summary: scene.summary || null,
            shots: scene.shots.map((shot) => this.mapShotToNode(shot)),
            engineContext: undefined,
        };
    }
    mapShotToNode(shot) {
        return {
            id: shot.id,
            parentId: shot.sceneId,
            index: shot.index,
            title: shot.title || null,
            description: shot.description || null,
            type: shot.type,
            params: shot.params || {},
            qualityScore: shot.qualityScore || {},
            reviewedAt: shot.reviewedAt ? shot.reviewedAt.toISOString() : null,
            durationSeconds: shot.durationSeconds || null,
            engineContext: undefined,
        };
    }
};
exports.SceneGraphService = SceneGraphService;
__decorate([
    (0, event_emitter_1.OnEvent)('project.structure_changed', { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SceneGraphService.prototype, "handleStructureChanged", null);
exports.SceneGraphService = SceneGraphService = SceneGraphService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scene_graph_cache_1.SceneGraphCache])
], SceneGraphService);
//# sourceMappingURL=scene-graph.service.js.map