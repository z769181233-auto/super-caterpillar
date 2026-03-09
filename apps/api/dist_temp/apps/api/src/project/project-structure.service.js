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
exports.ProjectStructureService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_service_1 = require("./project.service");
const database_1 = require("database");
let ProjectStructureService = class ProjectStructureService {
    prisma;
    projectService;
    constructor(prisma, projectService) {
        this.prisma = prisma;
        this.projectService = projectService;
    }
    async getProjectStructureTree(projectId, userId, organizationId) {
        await this.projectService.checkOwnership(projectId, userId);
        const project = await this.prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
            },
            select: {
                id: true,
                name: true,
                status: true,
                tasks: {
                    where: { type: 'NOVEL_ANALYSIS' },
                    select: { id: true, status: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                },
                novelSources: {
                    select: { id: true },
                },
            },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        let analysisStatus = 'PENDING';
        if (project.tasks && project.tasks.length > 0) {
            const task = project.tasks[0];
            if (task.status === database_1.TaskStatus.SUCCEEDED)
                analysisStatus = 'DONE';
            else if (task.status === database_1.TaskStatus.FAILED)
                analysisStatus = 'FAILED';
            else if (['PENDING', 'RUNNING', 'RETRYING'].includes(task.status))
                analysisStatus = 'ANALYZING';
        }
        const SMOKE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
        let sourceType = 'NOVEL';
        const isDemoName = project.name.includes('Demo') || project.name.includes('示例');
        if (!project.novelSources && (project.id === SMOKE_PROJECT_ID || isDemoName)) {
            sourceType = 'DEMO';
        }
        let structureStatus = 'EMPTY';
        const episodes = await this.prisma.episode.findMany({
            where: { projectId },
            include: {
                scenes: {
                    include: {
                        shots: {
                            include: {
                                assets: true,
                            },
                            orderBy: { index: 'asc' },
                        },
                    },
                    orderBy: { sceneIndex: 'asc' },
                },
            },
            orderBy: { index: 'asc' },
        });
        if (episodes.length > 0) {
            structureStatus = 'READY';
        }
        let productionStatus = 'IDLE';
        if (sourceType === 'DEMO') {
            productionStatus = 'IDLE';
        }
        else {
            if (analysisStatus === 'ANALYZING') {
                productionStatus = 'RUNNING';
            }
            else if (analysisStatus === 'DONE') {
                productionStatus = 'DONE';
            }
            else if (structureStatus === 'READY') {
                productionStatus = 'READY';
            }
            else {
                productionStatus = 'IDLE';
            }
        }
        let episodesCount = 0;
        let scenesCount = 0;
        let shotsCount = 0;
        let defaultSelection = null;
        const tree = episodes.map((episode) => {
            episodesCount++;
            if (!defaultSelection)
                defaultSelection = { nodeId: episode.id, nodeType: 'episode' };
            const scenes = episode.scenes.map((scene) => {
                scenesCount++;
                if (defaultSelection?.nodeType === 'episode' && defaultSelection.nodeId === episode.id) {
                    defaultSelection = { nodeId: scene.id, nodeType: 'scene' };
                }
                const shots = scene.shots.map((shot) => {
                    shotsCount++;
                    const videoAsset = shot.assets?.find((a) => a.type === 'VIDEO');
                    let videoUrl = null;
                    if (videoAsset) {
                        videoUrl = videoAsset.storageKey;
                    }
                    return {
                        type: 'shot',
                        id: shot.id,
                        index: shot.index,
                        title: shot.title,
                        description: shot.description,
                        shotType: shot.type,
                        params: shot.params,
                        qualityScore: shot.qualityScore,
                        videoUrl,
                        assets: shot.assets,
                    };
                });
                return {
                    type: 'scene',
                    id: scene.id,
                    index: scene.sceneIndex,
                    title: scene.title,
                    summary: scene.summary,
                    visualDensityScore: scene.visualDensityScore,
                    enrichedText: scene.enrichedText,
                    shots,
                };
            });
            return {
                type: 'episode',
                id: episode.id,
                index: episode.index,
                name: episode.name,
                summary: episode.summary,
                scenes,
            };
        });
        return {
            projectId: project.id,
            projectName: project.name,
            projectStatus: project.status,
            sourceType,
            productionStatus,
            structureStatus,
            tree,
            counts: {
                seasons: 0,
                episodes: episodesCount,
                scenes: scenesCount,
                shots: shotsCount,
            },
            defaultSelection,
            statusSummary: {
                analysis: analysisStatus,
                render: 'PENDING',
            },
        };
    }
};
exports.ProjectStructureService = ProjectStructureService;
exports.ProjectStructureService = ProjectStructureService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_service_1.ProjectService])
], ProjectStructureService);
//# sourceMappingURL=project-structure.service.js.map