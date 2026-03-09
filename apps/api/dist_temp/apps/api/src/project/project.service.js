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
var ProjectService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("database");
const prisma_service_1 = require("../prisma/prisma.service");
const scene_graph_service_1 = require("./scene-graph.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const project_resolver_1 = require("../common/project-resolver");
let ProjectService = ProjectService_1 = class ProjectService {
    prisma;
    sceneGraphService;
    auditLogService;
    projectResolver;
    logger = new common_1.Logger(ProjectService_1.name);
    constructor(prisma, sceneGraphService, auditLogService, projectResolver) {
        this.prisma = prisma;
        this.sceneGraphService = sceneGraphService;
        this.auditLogService = auditLogService;
        this.projectResolver = projectResolver;
        console.log('[DEBUG_BOOT] ProjectService constructor start');
        console.log('[DEBUG_BOOT] ProjectService constructor end');
    }
    async create(createProjectDto, ownerId, organizationId) {
        this.logger.log('PROJECT SERVICE CREATE CALLED');
        let finalOwnerRole = await this.prisma.role.findFirst({
            where: { name: 'OWNER' },
        });
        if (!finalOwnerRole) {
            this.logger.warn('OWNER ROLE MISSING IN DB. ATTEMPTING SELF-HEALING');
            try {
                finalOwnerRole = await this.prisma.role.create({
                    data: {
                        name: 'OWNER',
                        level: 100,
                    },
                });
                this.logger.log(`SUCCESS: Created OWNER role with ID ${finalOwnerRole.id}`);
            }
            catch (err) {
                this.logger.error(`ERROR: Failed to create OWNER role: ${err.message}`);
                this.logger.log('RETRYING FIND OWNER ROLE ...');
                finalOwnerRole = await this.prisma.role.findFirst({
                    where: { name: 'OWNER' },
                });
                if (finalOwnerRole) {
                    this.logger.log(`SUCCESS: Found OWNER role after retry: ${finalOwnerRole.id}`);
                }
                else {
                    this.logger.error(`FATAL: OWNER role still not found after creation failure`);
                }
            }
        }
        else {
            this.logger.log(`FOUND OWNER ROLE: ${finalOwnerRole.id}`);
        }
        const project = await this.prisma.$transaction(async (tx) => {
            const p = await tx.project.create({
                data: {
                    name: createProjectDto.name,
                    description: createProjectDto.description,
                    ownerId,
                    organizationId,
                    status: database_1.ProjectStatus.in_progress,
                },
            });
            if (finalOwnerRole) {
                this.logger.log(`Creating OWNER member for user ${ownerId} in project ${p.id} with role ${finalOwnerRole.id}`);
                await tx.projectMember.create({
                    data: {
                        projectId: p.id,
                        userId: ownerId,
                        roleId: finalOwnerRole.id,
                    },
                });
            }
            else {
                this.logger.error(`OWNER role STILL NOT FOUND! Skipping member creation for project ${p.id}`);
            }
            try {
                await tx.character.create({
                    data: {
                        projectId: p.id,
                        name: 'Default Character',
                        description: 'Auto-generated default character',
                        referenceSheetUrls: { front: '', side: '', back: '' },
                        defaultSeed: `seed_${p.id}_${Date.now()}`,
                        embeddingId: `emb_${p.id}_${Date.now()}`,
                    },
                });
            }
            catch (error) {
                this.logger.warn(`CE01 placeholder failed in transaction: ${error?.message}`);
            }
            return p;
        });
        await this.sceneGraphService.invalidateProjectSceneGraph(project.id);
        return project;
    }
    async findByIdWithHierarchy(id, organizationId) {
        const project = await this.prisma.project.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                episodes: {
                    include: {
                        scenes: {
                            include: {
                                shots: true,
                            },
                            orderBy: { sceneIndex: 'asc' },
                        },
                    },
                    orderBy: { index: 'asc' },
                },
            },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        return project;
    }
    async findTreeById(id, organizationId) {
        const project = await this.prisma.project.findFirst({
            where: {
                id,
                organizationId,
            },
            include: {
                tasks: {
                    where: { type: database_1.TaskType.NOVEL_ANALYSIS },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                novelSources: true,
                seasons: {
                    select: {
                        id: true,
                        index: true,
                        title: true,
                        description: true,
                        metadata: true,
                        createdAt: true,
                        episodes: {
                            select: {
                                id: true,
                                index: true,
                                name: true,
                                summary: true,
                                chapter: {
                                    select: {
                                        id: true,
                                        title: true,
                                        index: true,
                                        sceneDrafts: {
                                            select: {
                                                id: true,
                                                index: true,
                                                title: true,
                                                summary: true,
                                                characters: true,
                                                location: true,
                                                status: true,
                                            },
                                            orderBy: { index: 'asc' },
                                        },
                                    },
                                },
                                scenes: {
                                    select: {
                                        id: true,
                                        sceneIndex: true,
                                        title: true,
                                        summary: true,
                                        visualDensityScore: true,
                                        enrichedText: true,
                                        shots: {
                                            select: {
                                                id: true,
                                                index: true,
                                                type: true,
                                                params: true,
                                                title: true,
                                                description: true,
                                                qualityScore: true,
                                                durationSeconds: true,
                                                reviewedAt: true,
                                                assets: {
                                                    select: {
                                                        id: true,
                                                        type: true,
                                                        status: true,
                                                    },
                                                },
                                            },
                                            orderBy: { index: 'asc' },
                                        },
                                    },
                                    orderBy: { sceneIndex: 'asc' },
                                },
                            },
                            orderBy: { index: 'asc' },
                        },
                    },
                    orderBy: { index: 'asc' },
                },
                episodes: {
                    select: {
                        id: true,
                        index: true,
                        name: true,
                        summary: true,
                        chapter: {
                            select: {
                                id: true,
                                title: true,
                                index: true,
                                sceneDrafts: {
                                    select: {
                                        id: true,
                                        index: true,
                                        title: true,
                                        summary: true,
                                        characters: true,
                                        location: true,
                                        status: true,
                                    },
                                    orderBy: { index: 'asc' },
                                },
                            },
                        },
                        scenes: {
                            select: {
                                id: true,
                                sceneIndex: true,
                                title: true,
                                summary: true,
                                visualDensityScore: true,
                                enrichedText: true,
                                shots: {
                                    select: {
                                        id: true,
                                        index: true,
                                        type: true,
                                        params: true,
                                        title: true,
                                        description: true,
                                        qualityScore: true,
                                        durationSeconds: true,
                                        reviewedAt: true,
                                        assets: {
                                            select: {
                                                id: true,
                                                type: true,
                                                status: true,
                                            },
                                        },
                                    },
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
            throw new common_1.NotFoundException('Project not found');
        }
        const projectWithTasks = project;
        const tasks = projectWithTasks.tasks || [];
        const succeeded = tasks.find((t) => t.status === database_1.TaskStatus.SUCCEEDED);
        const failed = tasks.find((t) => t.status === database_1.TaskStatus.FAILED);
        let analysisStatus = 'PENDING';
        let analysisUpdatedAt = null;
        if (succeeded) {
            analysisStatus = 'DONE';
            analysisUpdatedAt = succeeded.updatedAt;
        }
        else if (failed) {
            analysisStatus = 'FAILED';
            analysisUpdatedAt = failed.updatedAt;
        }
        else {
            const pendingOrRunning = tasks.find((t) => t.status === database_1.TaskStatus.PENDING ||
                t.status === database_1.TaskStatus.RUNNING ||
                t.status === database_1.TaskStatus.RETRYING);
            if (pendingOrRunning) {
                analysisStatus = 'ANALYZING';
                analysisUpdatedAt = pendingOrRunning.updatedAt;
            }
        }
        const enrichShot = (parentScene) => (shot) => {
            let qaStatus = 'PASS';
            let blockingReason = null;
            if (!shot.params) {
                qaStatus = 'FAIL';
                blockingReason = 'Missing parameters';
            }
            const generatedAssets = shot.assets?.filter((a) => a.status === 'GENERATED' || a.status === 'PUBLISHED') || [];
            const hasAssets = generatedAssets.length > 0;
            let canGenerate = true;
            if (parentScene.qaStatus === 'FAIL') {
                canGenerate = false;
                blockingReason = 'Parent scene QA failed';
            }
            return {
                ...shot,
                qaStatus,
                blockingReason: canGenerate ? null : blockingReason,
                canGenerate,
                assets: undefined,
            };
        };
        const enrichScene = (scene) => {
            const hasSummary = !!scene.summary;
            let qaStatus = 'PASS';
            let blockingReason = null;
            if (!hasSummary) {
                qaStatus = 'FAIL';
                blockingReason = 'Missing scene summary (Analysis incomplete)';
            }
            const canGenerate = qaStatus !== 'FAIL';
            return {
                ...scene,
                qaStatus,
                blockingReason,
                canGenerate,
                shots: scene.shots.map(enrichShot({ qaStatus, blockingReason, canGenerate })),
            };
        };
        const seasons = project.seasons.map((season) => ({
            ...season,
            episodes: season.episodes.map((episode) => ({
                ...episode,
                scenes: episode.scenes.map(enrichScene),
            })),
        }));
        const legacyEpisodes = project.episodes?.map((episode) => ({
            ...episode,
            scenes: episode.scenes.map(enrichScene),
        }));
        const SMOKE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
        let sourceType = 'NOVEL';
        if (project.id === SMOKE_PROJECT_ID ||
            project.name.includes('Demo') ||
            project.name.includes('示例')) {
            sourceType = 'DEMO';
        }
        let structureStatus = 'EMPTY';
        if (project.seasons && project.seasons.length > 0) {
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
        const { tasks: _, ...projectWithoutTasks } = projectWithTasks;
        return {
            ...projectWithoutTasks,
            seasons,
            episodes: legacyEpisodes,
            analysisStatus,
            analysisUpdatedAt,
            sourceType,
            productionStatus,
            structureStatus,
        };
    }
    async findAll(userId, organizationId, page = 1, pageSize = 100) {
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const [projects, total] = await Promise.all([
            this.prisma.project.findMany({
                where: {
                    organizationId,
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true,
                    status: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip,
                take,
            }),
            this.prisma.project.count({
                where: {
                    organizationId,
                },
            }),
        ]);
        return {
            projects,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async findById(id) {
        const project = await this.prisma.project.findUnique({
            where: { id },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        return project;
    }
    async update(id, updateProjectDto) {
        await this.findById(id);
        const project = await this.prisma.$transaction(async (tx) => {
            return tx.project.update({
                where: { id },
                data: updateProjectDto,
            });
        });
        await this.sceneGraphService.invalidateProjectSceneGraph(id);
        return project;
    }
    async delete(id) {
        await this.findById(id);
        const project = await this.prisma.$transaction(async (tx) => {
            return tx.project.delete({
                where: { id },
            });
        });
        await this.sceneGraphService.invalidateProjectSceneGraph(id);
        return project;
    }
    async checkOwnership(projectId, userId) {
        this.logger.log(`checkOwnership: projectId=${projectId}, userId=${userId}, hasPrisma=${!!this.prisma}`);
        if (!this.prisma) {
            this.logger.error('CRITICAL: this.prisma is undefined in checkOwnership!');
        }
        const project = await this.findById(projectId);
        if (project.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to access this project');
        }
        return project;
    }
    async createSeason(projectId, createSeasonDto) {
        await this.findById(projectId);
        const season = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.season.findUnique({
                where: {
                    projectId_index: {
                        projectId,
                        index: createSeasonDto.index,
                    },
                },
            });
            if (existing) {
                throw new common_1.ConflictException(`Season with index ${createSeasonDto.index} already exists in this project`);
            }
            return tx.season.create({
                data: {
                    projectId,
                    index: createSeasonDto.index,
                    title: createSeasonDto.title,
                    description: createSeasonDto.description,
                    metadata: createSeasonDto.metadata || {},
                },
            });
        });
        await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        return season;
    }
    async createEpisode(projectIdOrSeasonId, createEpisodeDto, options) {
        const isSeasonId = options?.isSeasonId ?? false;
        const episode = await this.prisma.$transaction(async (tx) => {
            if (isSeasonId) {
                const season = await tx.season.findUnique({
                    where: { id: projectIdOrSeasonId },
                    include: { project: true },
                });
                if (!season) {
                    throw new common_1.NotFoundException('Season not found');
                }
                return tx.episode.create({
                    data: {
                        seasonId: projectIdOrSeasonId,
                        projectId: season.projectId,
                        index: createEpisodeDto.index,
                        name: createEpisodeDto.name ||
                            createEpisodeDto.title ||
                            `Episode ${createEpisodeDto.index}`,
                        summary: createEpisodeDto.summary,
                    },
                });
            }
            else {
                const project = await this.findById(projectIdOrSeasonId);
                return tx.episode.create({
                    data: {
                        seasonId: null,
                        projectId: projectIdOrSeasonId,
                        index: createEpisodeDto.index,
                        name: createEpisodeDto.name ||
                            createEpisodeDto.title ||
                            `Episode ${createEpisodeDto.index}`,
                        summary: createEpisodeDto.summary,
                    },
                });
            }
        });
        const projectId = isSeasonId
            ? (await this.prisma.season.findUnique({
                where: { id: projectIdOrSeasonId },
                select: { projectId: true },
            }))?.projectId
            : projectIdOrSeasonId;
        if (projectId) {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        }
        return episode;
    }
    async checkEpisodeOwnership(episodeId, userId) {
        const episode = await this.prisma.episode.findUnique({
            where: { id: episodeId },
            include: {
                project: true,
            },
        });
        if (!episode) {
            throw new common_1.NotFoundException('Episode not found');
        }
        if (!episode.project) {
            throw new common_1.NotFoundException('Project not found for episode');
        }
        if (episode.project.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to access this episode');
        }
        return episode;
    }
    async createScene(episodeId, createSceneDto) {
        const scene = await this.prisma.$transaction(async (tx) => {
            const episode = await tx.episode.findUnique({
                where: { id: episodeId },
                include: {
                    season: { select: { projectId: true } },
                    project: { select: { id: true } },
                    chapter: { select: { id: true } },
                },
            });
            if (!episode) {
                throw new common_1.NotFoundException('Episode not found');
            }
            if (episode.chapter?.id) {
                try {
                    const shortTermMemory = await tx.memoryShortTerm.findFirst({
                        where: { chapterId: episode.chapter.id },
                    });
                    if (shortTermMemory) {
                        this.logger.debug(`CE07: Using short-term memory for chapter ${episode.chapter.id}`);
                    }
                }
                catch (error) {
                    await tx.auditLog
                        .create({
                        data: {
                            action: 'CE07_MEMORY_READ_FAIL',
                            resourceType: 'memory',
                            resourceId: episode.chapter.id,
                            details: {
                                reason: 'CE07 short-term memory read failed',
                                error: error?.message || 'Unknown error',
                                chapterId: episode.chapter.id,
                            },
                        },
                    })
                        .catch(() => {
                    });
                    this.logger.warn({
                        tag: 'CE07_MEMORY_READ_FAIL',
                        chapterId: episode.chapter.id,
                        error: error?.message || 'Unknown error',
                    }, 'CE07 memory read failed');
                }
            }
            return tx.scene.create({
                data: {
                    episodeId,
                    projectId: episode.projectId || episode.project?.id || episode.season?.projectId || '',
                    sceneIndex: createSceneDto.index,
                    title: createSceneDto.title || `Scene ${createSceneDto.index}`,
                    summary: createSceneDto.summary,
                },
            });
        });
        const episode = await this.prisma.episode.findUnique({
            where: { id: episodeId },
            select: { projectId: true, season: { select: { projectId: true } } },
        });
        const projectId = episode?.projectId || episode?.season?.projectId;
        if (projectId) {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        }
        return scene;
    }
    async checkSceneOwnership(sceneId, userId) {
        const scene = await this.prisma.scene.findUnique({
            where: { id: sceneId },
            include: {
                episode: {
                    include: {
                        project: true,
                    },
                },
            },
        });
        if (!scene) {
            throw new common_1.NotFoundException('Scene not found');
        }
        const project = await this.projectResolver.resolveProjectAuthOnly(scene.episode);
        if (!project) {
            throw new common_1.NotFoundException(`Project not found for scene ${sceneId}`);
        }
        if (project.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to access this scene');
        }
        return scene;
    }
    async updateScene(id, updateSceneDto) {
        const scene = await this.prisma.$transaction(async (tx) => {
            await tx.scene.findUniqueOrThrow({ where: { id } });
            return tx.scene.update({
                where: { id },
                data: updateSceneDto,
            });
        });
        const sceneWithProject = await this.prisma.scene.findUnique({
            where: { id },
            select: {
                episode: {
                    select: {
                        projectId: true,
                        season: { select: { projectId: true } },
                    },
                },
            },
        });
        const projectId = sceneWithProject?.episode?.projectId || sceneWithProject?.episode?.season?.projectId;
        if (projectId) {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        }
        return scene;
    }
    async createShot(sceneId, createShotDto, organizationId) {
        const shot = await this.prisma.$transaction(async (tx) => {
            const scene = await tx.scene.findUnique({
                where: { id: sceneId },
                include: {
                    episode: {
                        include: {
                            project: true,
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
                throw new common_1.NotFoundException('Scene not found');
            }
            const episodeProject = await this.projectResolver.resolveProjectAuthOnly(scene.episode);
            const finalOrganizationId = organizationId ||
                episodeProject?.organizationId ||
                scene.episode?.season?.project?.organizationId;
            if (!finalOrganizationId) {
                throw new common_1.BadRequestException('Cannot determine organizationId for shot');
            }
            return tx.shot.create({
                data: {
                    sceneId,
                    index: createShotDto.index ?? 1,
                    type: createShotDto.type,
                    params: createShotDto.params ?? {},
                    qualityScore: {},
                    organizationId: finalOrganizationId,
                    title: createShotDto.title,
                    description: createShotDto.description,
                },
            });
        });
        const scene = await this.prisma.scene.findUnique({
            where: { id: sceneId },
            select: {
                episode: {
                    select: {
                        projectId: true,
                        season: { select: { projectId: true } },
                    },
                },
            },
        });
        const projectId = scene?.episode?.projectId || scene?.episode?.season?.projectId;
        if (projectId) {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        }
        return shot;
    }
    async checkShotOwnership(shotId, userId, organizationId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: {
                scene: {
                    include: {
                        episode: {
                            include: {
                                project: true,
                                season: {
                                    include: {
                                        project: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!shot) {
            throw new common_1.NotFoundException('Shot not found');
        }
        const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
        if (!shotProject) {
            throw new common_1.NotFoundException(`Project not found for shot ${shotId}`);
        }
        if (shotProject.organizationId !== organizationId) {
            throw new common_1.ForbiddenException('You do not have permission to access this shot');
        }
        return shot;
    }
    async findShotById(id, organizationId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id },
            include: {
                qualityScores: true,
                safetyResults: true,
                scene: {
                    include: {
                        episode: {
                            include: {
                                project: true,
                            },
                        },
                    },
                },
            },
        });
        if (!shot) {
            throw new common_1.NotFoundException('Shot not found');
        }
        const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
        if (!shotProject) {
            throw new common_1.NotFoundException(`Project not found for shot ${id}`);
        }
        if (shotProject.organizationId !== organizationId) {
            throw new common_1.ForbiddenException('You do not have permission to access this shot');
        }
        return shot;
    }
    async updateShot(id, updateShotDto, organizationId) {
        const shot = await this.prisma.$transaction(async (tx) => {
            const shot = await tx.shot.findUnique({
                where: { id },
                include: {
                    scene: {
                        include: {
                            episode: {
                                include: {
                                    project: true,
                                    season: {
                                        include: {
                                            project: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!shot) {
                throw new common_1.NotFoundException('Shot not found');
            }
            const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
            if (!shotProject || shotProject.organizationId !== organizationId) {
                throw new common_1.ForbiddenException('You do not have permission to update this shot');
            }
            const updateData = { ...updateShotDto };
            if (updateData.status && typeof updateData.status === 'string') {
                updateData.status = updateData.status;
            }
            return tx.shot.update({
                where: { id },
                data: updateData,
            });
        });
        const shotWithProject = await this.prisma.shot.findUnique({
            where: { id },
            select: {
                scene: {
                    select: {
                        episode: {
                            select: {
                                projectId: true,
                                season: { select: { projectId: true } },
                            },
                        },
                    },
                },
            },
        });
        const projectId = shotWithProject?.scene?.episode?.projectId ||
            shotWithProject?.scene?.episode?.season?.projectId;
        if (projectId) {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
        }
        return shot;
    }
    async listEpisodes(userId, organizationId, filters) {
        const { projectId, seasonId, page = 1, pageSize = 20 } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const where = {
            season: {
                project: { organizationId },
            },
        };
        if (seasonId)
            where.seasonId = seasonId;
        if (projectId)
            where.season.projectId = projectId;
        const [data, total] = await Promise.all([
            this.prisma.episode.findMany({
                where,
                orderBy: { index: 'asc' },
                skip,
                take,
                select: {
                    id: true,
                    projectId: true,
                    seasonId: true,
                    index: true,
                    name: true,
                },
            }),
            this.prisma.episode.count({ where }),
        ]);
        return { data, total, page, pageSize };
    }
    async listScenes(userId, organizationId, filters) {
        const { projectId, episodeId, page = 1, pageSize = 20 } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const where = {
            episode: {
                season: {
                    project: { organizationId },
                },
            },
        };
        if (episodeId)
            where.episodeId = episodeId;
        if (projectId)
            where.episode.season.projectId = projectId;
        const [data, total] = await Promise.all([
            this.prisma.scene.findMany({
                where,
                orderBy: { sceneIndex: 'asc' },
                skip,
                take,
                select: {
                    id: true,
                    projectId: true,
                    episodeId: true,
                    sceneIndex: true,
                    title: true,
                },
            }),
            this.prisma.scene.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async listShots(userId, organizationId, filters) {
        const { projectId, episodeId, sceneId, status, reviewStatus, q, page = 1, pageSize = 20, } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const where = {};
        if (sceneId) {
            where.sceneId = sceneId;
        }
        else if (episodeId) {
            where.scene = {
                episodeId,
            };
        }
        else if (projectId) {
            where.scene = {
                episode: {
                    projectId,
                },
            };
        }
        else {
            where.scene = {
                episode: {
                    project: {
                        organizationId,
                    },
                },
            };
        }
        if (q) {
            where.OR = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { dialogue: { contains: q, mode: 'insensitive' } },
                { prompt: { contains: q, mode: 'insensitive' } },
            ];
        }
        const [shots, total] = await Promise.all([
            this.prisma.shot.findMany({
                where,
                select: {
                    id: true,
                    index: true,
                    type: true,
                    title: true,
                    description: true,
                    reviewedAt: true,
                    scene: {
                        select: {
                            id: true,
                            sceneIndex: true,
                            episode: {
                                select: {
                                    id: true,
                                    index: true,
                                    name: true,
                                    project: {
                                        select: {
                                            id: true,
                                            name: true,
                                            organizationId: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    index: 'asc',
                },
                skip,
                take,
            }),
            this.prisma.shot.count({ where }),
        ]);
        const filteredShots = shots.filter((shot) => {
            const shotProject = shot.scene.episode?.project;
            return shotProject?.organizationId === organizationId;
        });
        const formattedShots = filteredShots.map((shot) => {
            const ep = shot.scene?.episode;
            const proj = ep?.project;
            return {
                id: shot.id,
                index: shot.index,
                type: shot.type,
                title: shot.title,
                description: shot.description,
                reviewedAt: shot.reviewedAt,
                projectId: proj?.id,
                projectName: proj?.name,
                episodeId: ep?.id,
                episodeName: ep?.name,
                sceneId: shot.scene?.id,
                sceneIndex: shot.scene?.sceneIndex,
            };
        });
        return {
            shots: formattedShots,
            total: filteredShots.length,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async getProjectOverview(projectId, organizationId) {
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, organizationId },
            include: {
                tasks: { orderBy: { createdAt: 'desc' } },
                novelSources: true,
            },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const [seasons, episodes, scenes, shots, runningJobs, costAgg, auditLogs] = await Promise.all([
            this.prisma.season.count({ where: { projectId } }),
            this.prisma.episode.count({
                where: { season: { projectId } },
            }),
            this.prisma.scene.count({ where: { projectId } }),
            this.prisma.shot.count({
                where: {
                    scene: {
                        episode: {
                            season: {
                                projectId,
                            },
                        },
                    },
                },
            }),
            this.prisma.shotJob.findMany({
                where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
                include: { task: true },
                take: 10,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.billingLedger.aggregate({
                where: { projectId: projectId },
                _sum: { amount: true },
            }),
            this.prisma.auditLog.findMany({
                where: {
                    OR: [
                        { resourceType: 'project', resourceId: projectId },
                        { resourceType: 'scene', details: { path: ['projectId'], equals: projectId } },
                    ],
                },
                include: { user: { select: { id: true, email: true, avatar: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        const hasNovel = !!project.novelSources;
        const structureTask = project.tasks.find((t) => t.type === database_1.TaskType.NOVEL_ANALYSIS);
        const structureStatus = structureTask?.status;
        const flowImport = {
            key: 'NOVEL_IMPORT',
            label: 'Novel Import',
            status: hasNovel ? 'DONE' : 'PENDING',
            gate: { canRun: true },
            actions: [
                {
                    key: 'RUN',
                    label: hasNovel ? 'Re-Import' : 'Import Novel',
                    enabled: true,
                    href: '/import',
                },
            ],
        };
        const canRunStructure = hasNovel;
        let structureNodeStatus = 'PENDING';
        if (structureStatus === 'SUCCEEDED')
            structureNodeStatus = 'DONE';
        else if (structureStatus === 'RUNNING')
            structureNodeStatus = 'RUNNING';
        else if (structureStatus === 'FAILED')
            structureNodeStatus = 'FAILED';
        const flowStructure = {
            key: 'STRUCTURE_ANALYSIS',
            label: 'Structure Analysis',
            status: structureNodeStatus,
            gate: {
                canRun: canRunStructure,
                blockedReason: !canRunStructure ? 'Depends on Novel Import' : undefined,
                missingInputs: !canRunStructure ? [{ code: 'MISSING_NOVEL', title: 'Missing Novel' }] : [],
            },
            actions: [
                {
                    key: 'RUN',
                    label: structureNodeStatus === 'RUNNING'
                        ? 'Analyzing...'
                        : structureNodeStatus === 'DONE'
                            ? 'Re-Analyze'
                            : 'Start Analysis',
                    enabled: canRunStructure && structureNodeStatus !== 'RUNNING',
                    disabledReason: structureNodeStatus === 'RUNNING'
                        ? 'Analysis in progress'
                        : !canRunStructure
                            ? 'Missing Novel'
                            : undefined,
                },
            ],
        };
        const flowScript = {
            key: 'SCRIPT_SEMANTIC',
            label: 'Script Semantic',
            status: 'PENDING',
            gate: { canRun: structureNodeStatus === 'DONE' },
            actions: [],
        };
        const flowShot = {
            key: 'SHOT_PLANNING',
            label: 'Shot Planning',
            status: 'PENDING',
            gate: { canRun: false },
            actions: [],
        };
        const flowAsset = {
            key: 'ASSET_GENERATION',
            label: 'Asset Gen',
            status: 'PENDING',
            gate: { canRun: false },
            actions: [],
        };
        const flowVideo = {
            key: 'VIDEO_GENERATION',
            label: 'Video Gen',
            status: 'PENDING',
            gate: { canRun: false },
            actions: [],
        };
        const flowExport = {
            key: 'COMPOSE_EXPORT',
            label: 'Export',
            status: 'PENDING',
            gate: { canRun: false },
            actions: [],
        };
        let nextAction = {
            action: {
                key: 'CHECK',
                label: 'Check Status',
                canRun: false,
                disabledReason: 'Unknown state',
            },
            why: 'Unknown state',
            estimate: { etaSec: 0 },
        };
        if (!hasNovel) {
            nextAction = {
                action: { key: 'IMPORT', label: 'Go to Import', href: '/import', canRun: true },
                why: 'Project is empty. Novel import required to start.',
                estimate: { etaSec: 60 },
            };
        }
        else if (structureNodeStatus !== 'DONE') {
            if (structureNodeStatus === 'RUNNING') {
                nextAction = {
                    action: {
                        key: 'VIEW_LOGS',
                        label: 'View Analysis Logs',
                        href: `/projects/${projectId}/logs`,
                        canRun: true,
                    },
                    why: 'Structure analysis is currently running.',
                    estimate: { etaSec: 120 },
                };
            }
            else if (structureNodeStatus === 'FAILED') {
                nextAction = {
                    action: {
                        key: 'RETRY',
                        label: 'Retry Structure Analysis',
                        href: `/projects/${projectId}/structure`,
                        canRun: true,
                    },
                    why: 'Previous analysis failed. Please retry or check logs.',
                    estimate: { etaSec: 300 },
                };
            }
            else {
                nextAction = {
                    action: { key: 'RUN', label: 'Start Structure Analysis', canRun: true },
                    why: 'Novel imported. Ready for structure analysis.',
                    estimate: { etaSec: 300 },
                };
            }
        }
        else {
            const sceneCount = scenes;
            if (sceneCount === 0) {
                nextAction = {
                    action: {
                        key: 'REVIEW',
                        label: 'Review Structure',
                        href: `/projects/${projectId}/structure`,
                        canRun: true,
                    },
                    why: 'Analysis done but no scenes found. Please review.',
                    estimate: { etaSec: 60 },
                };
            }
            else {
                nextAction = {
                    action: {
                        key: 'REVIEW',
                        label: 'Enter Workbench',
                        href: `/projects/${projectId}/structure`,
                        canRun: true,
                    },
                    why: 'Structure ready. Proceed to scene refinement and shot planning.',
                    estimate: { etaSec: 600 },
                };
            }
        }
        const structureQuality = seasons > 0 && episodes > 0 ? 'OK' : structureNodeStatus === 'DONE' ? 'WARN' : 'OK';
        const recentAudit = auditLogs.map((log) => ({
            at: log.createdAt.toISOString(),
            actor: {
                id: log.userId || log.apiKeyId || 'system',
                name: log.user?.email?.split('@')[0] || log.apiKeyId || 'System',
            },
            action: log.action,
            result: 'OK',
        }));
        return {
            header: {
                id: project.id,
                idShort: project.id.substring(0, 8),
                name: project.name,
                createdAt: project.createdAt.toISOString(),
                updatedAt: project.updatedAt.toISOString(),
                status: project.status === 'in_progress' ? 'RUNNING' : 'DRAFT',
                stage: {
                    currentKey: structureNodeStatus === 'DONE' ? 'SCRIPT_SEMANTIC' : 'STRUCTURE_ANALYSIS',
                    currentLabel: 'Development',
                    progressPct: 30,
                },
                blocking: { isBlocked: false },
                risk: { quality: structureQuality, cost: 'OK', compliance: 'OK' },
            },
            flow: {
                nodes: [flowImport, flowStructure, flowScript, flowShot, flowAsset, flowVideo, flowExport],
            },
            next: nextAction,
            stats: {
                seasons: seasons,
                episodes: episodes,
                scenes: scenes,
                shots: shots,
                issues: { total: 0, missingBindings: 0, semanticConflicts: 0, qaFailed: 0 },
                links: { structureView: '', issuesView: '' },
            },
            jobs: {
                running: await Promise.all(runningJobs.map(async (j) => {
                    const taskPayload = j.task?.payload;
                    const isShredder = taskPayload?.mode === 'SHREDDER';
                    let currentStep = undefined;
                    let progressPct = 0;
                    let breakdown = undefined;
                    if (isShredder && j.taskId) {
                        const chunkStats = await this.prisma.shotJob.groupBy({
                            by: ['status'],
                            where: {
                                taskId: j.taskId,
                                type: 'NOVEL_CHUNK_PARSE',
                            },
                            _count: true,
                        });
                        let totalChunks = 0;
                        let succeededChunks = 0;
                        let failedChunks = 0;
                        let runningChunks = 0;
                        for (const stat of chunkStats) {
                            const count = stat._count;
                            totalChunks += count;
                            if (stat.status === 'SUCCEEDED')
                                succeededChunks += count;
                            if (stat.status === 'FAILED')
                                failedChunks += count;
                            if (stat.status === 'RUNNING')
                                runningChunks += count;
                        }
                        if (j.status === 'PENDING' || j.status === 'RUNNING') {
                            currentStep = 'CE06_SCAN';
                            progressPct = 5;
                        }
                        else {
                            currentStep = 'CE06_PARSING';
                            if (totalChunks > 0) {
                                progressPct = Math.floor(10 + (succeededChunks / totalChunks) * 90);
                            }
                            else {
                                progressPct = 10;
                            }
                        }
                        breakdown = {
                            scanPct: j.status === 'SUCCEEDED' ? 100 : 5,
                            parsePct: totalChunks > 0 ? Math.floor((succeededChunks / totalChunks) * 100) : 0,
                            doneChunks: succeededChunks,
                            totalChunks,
                        };
                    }
                    else {
                        progressPct = j.status === 'SUCCEEDED' ? 100 : 50;
                        if (j.type === 'CE06_NOVEL_PARSING')
                            currentStep = 'CE06_PARSING';
                        if (j.type === 'NOVEL_SCAN_TOC')
                            currentStep = 'CE06_SCAN';
                    }
                    return {
                        id: j.id,
                        type: j.type,
                        status: j.status,
                        progressPct,
                        currentStep,
                        progressBreakdown: breakdown,
                        startedAt: j.createdAt.toISOString(),
                        workerId: j.workerId,
                    };
                })),
                queuedCount: 0,
                failed: [],
            },
            quality: {
                structure: structureQuality,
                semantic: 'OK',
                visual: 'OK',
            },
            cost: {
                total: { money: Math.abs(Number(costAgg._sum?.amount || 0n) / 100) },
                last24h: { money: 0.0 },
                currentRunEstimate: { money: 0.0 },
                alert: { level: 'OK' },
            },
            audit: {
                recent: recentAudit,
                href: `/projects/audit`,
            },
        };
    }
    async createDemoStructure(userId, organizationId) {
        const DEMO_PROJECT_NAME = 'Demo Structure Project';
        let project = await this.prisma.project.findFirst({
            where: {
                ownerId: userId,
                organizationId,
                name: DEMO_PROJECT_NAME,
            },
        });
        if (!project) {
            project = await this.prisma.project.create({
                data: {
                    name: DEMO_PROJECT_NAME,
                    description: 'Auto-generated demo for structure contract verification',
                    ownerId: userId,
                    organizationId,
                    status: 'in_progress',
                },
            });
            this.logger.log(`[DEMO] Created project: ${project.id}`);
        }
        else {
            this.logger.log(`[DEMO] Found existing project: ${project.id}`);
        }
        const existingMember = await this.prisma.projectMember.findFirst({
            where: { userId, projectId: project.id },
        });
        if (!existingMember) {
            let ownerRole = await this.prisma.role.findFirst({ where: { name: 'OWNER' } });
            if (!ownerRole) {
                try {
                    ownerRole = await this.prisma.role.create({ data: { name: 'OWNER', level: 100 } });
                }
                catch (e) {
                    ownerRole = await this.prisma.role.findFirst({ where: { name: 'OWNER' } });
                }
            }
            if (ownerRole) {
                await this.prisma.projectMember.create({
                    data: { projectId: project.id, userId, roleId: ownerRole.id },
                });
                this.logger.log(`[DEMO] Added owner member: ${userId}`);
            }
        }
        let season = await this.prisma.season.findFirst({
            where: { projectId: project.id, index: 1 },
        });
        if (!season) {
            season = await this.prisma.season.create({
                data: {
                    projectId: project.id,
                    index: 1,
                    title: 'Season 1',
                },
            });
            this.logger.log(`[DEMO] Created Season 1`);
        }
        for (let epIndex = 1; epIndex <= 2; epIndex++) {
            let episode = await this.prisma.episode.findFirst({
                where: { seasonId: season.id, index: epIndex },
            });
            if (!episode) {
                episode = await this.prisma.episode.create({
                    data: {
                        seasonId: season.id,
                        projectId: project.id,
                        index: epIndex,
                        name: `Episode ${epIndex}`,
                    },
                });
                this.logger.log(`[DEMO] Created Episode ${epIndex}`);
            }
            for (let scIndex = 1; scIndex <= 3; scIndex++) {
                let scene = await this.prisma.scene.findFirst({
                    where: { episodeId: episode.id, sceneIndex: scIndex },
                });
                if (!scene) {
                    scene = await this.prisma.scene.create({
                        data: {
                            episodeId: episode.id,
                            projectId: project.id,
                            sceneIndex: scIndex,
                            title: `Scene ${epIndex}-${scIndex}`,
                            summary: `Auto-generated summary for Scene ${epIndex}-${scIndex}`,
                        },
                    });
                    this.logger.log(`[DEMO] Created Scene ${epIndex}-${scIndex}`);
                }
                for (let shotIndex = 1; shotIndex <= 5; shotIndex++) {
                    const existing = await this.prisma.shot.findFirst({
                        where: { sceneId: scene.id, index: shotIndex },
                    });
                    if (!existing) {
                        await this.prisma.shot.create({
                            data: {
                                sceneId: scene.id,
                                index: shotIndex,
                                type: shotIndex % 2 === 0 ? 'CLOSEUP' : 'FULL',
                                title: `Shot ${epIndex}-${scIndex}-${shotIndex}`,
                                organizationId,
                            },
                        });
                    }
                }
            }
        }
        this.logger.log(`[DEMO] Demo structure complete for project ${project.id}`);
        return { projectId: project.id };
    }
};
exports.ProjectService = ProjectService;
exports.ProjectService = ProjectService = ProjectService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(scene_graph_service_1.SceneGraphService)),
    __param(2, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scene_graph_service_1.SceneGraphService,
        audit_log_service_1.AuditLogService,
        project_resolver_1.ProjectResolver])
], ProjectService);
//# sourceMappingURL=project.service.js.map