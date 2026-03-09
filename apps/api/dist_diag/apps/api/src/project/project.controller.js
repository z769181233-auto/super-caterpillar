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
var ProjectController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const project_service_1 = require("./project.service");
const structure_generate_service_1 = require("./structure-generate.service");
const scene_graph_service_1 = require("./scene-graph.service");
const job_service_1 = require("../job/job.service");
const task_service_1 = require("../task/task.service");
const permission_service_1 = require("../permission/permission.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const project_ownership_guard_1 = require("./guards/project-ownership.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const database_1 = require("database");
const common_2 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const permissions_guard_1 = require("../auth/permissions.guard");
const permission_constants_1 = require("../permission/permission.constants");
const dto_1 = require("./dto");
const list_shots_dto_1 = require("./dto/list-shots.dto");
const crypto_1 = require("crypto");
const audit_decorator_1 = require("../audit/audit.decorator");
const audit_constants_1 = require("../audit/audit.constants");
let ProjectController = ProjectController_1 = class ProjectController {
    projectService;
    structureGenerateService;
    sceneGraphService;
    jobService;
    taskService;
    permissionService;
    auditLogService;
    logger = new common_1.Logger(ProjectController_1.name);
    constructor(projectService, structureGenerateService, sceneGraphService, jobService, taskService, permissionService, auditLogService) {
        this.projectService = projectService;
        this.structureGenerateService = structureGenerateService;
        this.sceneGraphService = sceneGraphService;
        this.jobService = jobService;
        this.taskService = taskService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
    }
    async getProjects(user, organizationId, page, pageSize) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const pageNum = page ? parseInt(page, 10) : 1;
        const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 100;
        const result = await this.projectService.findAll(user.userId, organizationId, pageNum, pageSizeNum);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createDemoStructure(user, organizationId) {
        const isDemoEnabled = process.env.ENABLE_DEMO_SEED_ENDPOINT === 'true';
        if (!isDemoEnabled) {
            throw new common_1.NotFoundException('Endpoint not available');
        }
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const result = await this.projectService.createDemoStructure(user.userId, organizationId);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createProject(createProjectDto, user, organizationId, request) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.permissionService.assertCanManageProject(user.userId, organizationId);
        const project = await this.projectService.create(createProjectDto, user.userId, organizationId);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKeyId;
        await this.auditLogService.record({
            userId: user.userId,
            apiKeyId,
            action: 'PROJECT_CREATED',
            resourceType: 'project',
            resourceId: project.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
                name: project.name,
                organizationId,
            },
        });
        return {
            success: true,
            data: project,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getProject(id, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const project = await this.projectService.findByIdWithHierarchy(id, organizationId);
        return {
            success: true,
            data: project,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getProjectTree(id, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const tree = await this.projectService.findTreeById(id, organizationId);
        return {
            success: true,
            data: tree,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getProjectSceneGraph(id, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.projectService.checkOwnership(id, user.userId);
        const sceneGraph = await this.sceneGraphService.getProjectSceneGraph(id);
        return {
            success: true,
            data: sceneGraph,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getProjectOverview(id, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const overview = await this.projectService.getProjectOverview(id, organizationId);
        return {
            success: true,
            data: overview,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async listEpisodes(projectId, seasonId, page, pageSize, user, organizationId) {
        if (!organizationId)
            throw new Error('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const result = await this.projectService.listEpisodes(user.userId, organizationId, {
            projectId,
            seasonId,
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 100,
        });
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async listScenes(projectId, episodeId, page, pageSize, user, organizationId) {
        if (!organizationId)
            throw new Error('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const result = await this.projectService.listScenes(user.userId, organizationId, {
            projectId,
            episodeId,
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 100,
        });
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async listShotsInProject(projectId, sceneId, page, pageSize, user, organizationId) {
        if (!organizationId)
            throw new Error('No organization context');
        await this.projectService.checkOwnership(projectId, user.userId);
        const result = await this.projectService.listShots(user.userId, organizationId, {
            projectId,
            sceneId,
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 100,
        });
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async generateStructure(projectId, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.projectService.checkOwnership(projectId, user.userId);
        try {
            const tree = await this.structureGenerateService.generateStructure(projectId, organizationId);
            return {
                success: true,
                data: tree,
                message: 'Structure generated successfully',
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'STRUCTURE_GENERATION_FAILED',
                    message: error?.message || 'Failed to generate structure',
                },
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
    }
    async updateProject(id, updateProjectDto) {
        const project = await this.projectService.update(id, updateProjectDto);
        return {
            success: true,
            data: project,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async deleteProject(id, user, request) {
        await this.projectService.delete(id);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.PROJECT_DELETE,
            resourceType: 'project',
            resourceId: id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
        })
            .catch(() => undefined);
        return {
            success: true,
            data: { message: 'Project deleted successfully' },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createEpisode(projectId, createEpisodeDto, user, request) {
        await this.projectService.checkOwnership(projectId, user.userId);
        const episode = await this.projectService.createEpisode(projectId, createEpisodeDto);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.EPISODE_CREATE,
            resourceType: 'episode',
            resourceId: episode.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: { projectId, episodeIndex: episode.index },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: episode,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createScene(episodeId, createSceneDto, user, request) {
        await this.projectService.checkEpisodeOwnership(episodeId, user.userId);
        const scene = await this.projectService.createScene(episodeId, createSceneDto);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.SCENE_CREATE,
            resourceType: 'scene',
            resourceId: scene.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: { episodeId, sceneIndex: scene.sceneIndex },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: scene,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async updateScene(id, updateSceneDto, user, request) {
        await this.projectService.checkSceneOwnership(id, user.userId);
        const scene = await this.projectService.updateScene(id, updateSceneDto);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.SCENE_UPDATE,
            resourceType: 'scene',
            resourceId: id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: { sceneIndex: scene.sceneIndex },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: scene,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createShot(sceneId, createShotDto, user, request) {
        await this.projectService.checkSceneOwnership(sceneId, user.userId);
        const shot = await this.projectService.createShot(sceneId, createShotDto);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.SHOT_CREATE,
            resourceType: 'shot',
            resourceId: shot.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: { sceneId, shotIndex: shot.index },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: shot,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getShot(id, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.projectService.checkShotOwnership(id, user.userId, organizationId);
        const shot = await this.projectService.findShotById(id, organizationId);
        return {
            success: true,
            data: shot,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async updateShot(id, updateShotDto, user, organizationId, request) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.projectService.checkShotOwnership(id, user.userId, organizationId);
        const shot = await this.projectService.updateShot(id, updateShotDto, organizationId);
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService
            .record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.SHOT_UPDATE,
            resourceType: 'shot',
            resourceId: id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: { shotIndex: shot.index },
        })
            .catch(() => undefined);
        return {
            success: true,
            data: shot,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async listShots(query, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        const result = await this.projectService.listShots(user.userId, organizationId, query);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async batchReview(body, user, organizationId) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.permissionService.assertCanManageProject(user.userId, organizationId);
        for (const shotId of body.shotIds) {
            await this.projectService.checkShotOwnership(shotId, user.userId, organizationId);
        }
        const updated = await Promise.all(body.shotIds.map((shotId) => this.projectService.updateShot(shotId, {
            reviewStatus: body.reviewStatus,
            reviewNote: body.reviewNote,
            reviewedAt: new Date().toISOString(),
        }, organizationId)));
        return {
            success: true,
            data: { updated: updated.length, shots: updated },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async batchGenerate(body, user, organizationId, request) {
        if (!organizationId) {
            throw new Error('No organization context');
        }
        await this.permissionService.assertCanManageProject(user.userId, organizationId);
        const shotsWithHierarchy = await Promise.all(body.shotIds.map(async (shotId) => {
            await this.projectService.checkShotOwnership(shotId, user.userId, organizationId);
            const shot = await this.projectService.findShotById(shotId, organizationId);
            return { shotId, shot };
        }));
        const successfulJobs = [];
        for (const { shotId, shot } of shotsWithHierarchy) {
            try {
                const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
                const apiKeyId = request.apiKeyId;
                const projectId = shot.scene?.episode?.projectId;
                if (!projectId) {
                    throw new common_1.BadRequestException('Shot project missing');
                }
                const task = await this.taskService.create({
                    organizationId,
                    projectId,
                    type: database_1.TaskType.SHOT_RENDER,
                    payload: {
                        shotId,
                        jobType: body.jobType,
                        engine: body.engine,
                        engineConfig: body.engineConfig || {},
                    },
                });
                const job = await this.jobService.create(shotId, {
                    type: database_1.JobType.SHOT_RENDER,
                    payload: {
                        engine: body.engine,
                        engineConfig: body.engineConfig,
                        jobType: body.jobType,
                    },
                }, user.userId, organizationId, task.id);
                successfulJobs.push(job);
            }
            catch (err) {
                this.logger.error(`Failed to create task/job for shot ${shotId}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return {
            success: true,
            data: {
                created: successfulJobs.length,
                total: body.shotIds.length,
                jobs: successfulJobs,
                message: `已提交 ${successfulJobs.length} 个生成任务，将在后台队列中逐步处理`,
            },
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProjects", null);
__decorate([
    (0, common_1.Post)('demo-structure'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createDemoStructure", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.SystemPermissions.AUTH, permission_constants_1.SystemPermissions.PROJECT_CREATE),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_CREATE),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateProjectDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createProject", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProject", null);
__decorate([
    (0, common_1.Get)(':id/tree'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProjectTree", null);
__decorate([
    (0, common_1.Get)(':id/scene-graph'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_CREATE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProjectSceneGraph", null);
__decorate([
    (0, common_1.Get)(':id/overview'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_CREATE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProjectOverview", null);
__decorate([
    (0, common_1.Get)(':projectId/episodes'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('seasonId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "listEpisodes", null);
__decorate([
    (0, common_1.Get)(':projectId/scenes'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('episodeId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "listScenes", null);
__decorate([
    (0, common_1.Get)(':projectId/shots'),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_READ),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('sceneId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __param(5, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "listShotsInProject", null);
__decorate([
    (0, common_1.Post)(':id/structure/generate'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "generateStructure", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    (0, permissions_decorator_1.Permissions)(permission_constants_1.ProjectPermissions.PROJECT_WRITE),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_UPDATE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateProjectDto]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_DELETE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "deleteProject", null);
__decorate([
    (0, common_1.Post)(':projectId/episodes'),
    (0, common_1.UseGuards)(project_ownership_guard_1.ProjectOwnershipGuard),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.EPISODE_CREATE),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateEpisodeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createEpisode", null);
__decorate([
    (0, common_1.Post)('episodes/:episodeId/scenes'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SCENE_CREATE),
    __param(0, (0, common_1.Param)('episodeId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateSceneDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createScene", null);
__decorate([
    (0, common_1.Patch)('scenes/:id'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SCENE_UPDATE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateSceneDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "updateScene", null);
__decorate([
    (0, common_1.Post)('scenes/:sceneId/shots'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SHOT_CREATE),
    __param(0, (0, common_1.Param)('sceneId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateShotDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createShot", null);
__decorate([
    (0, common_1.Get)('shots/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getShot", null);
__decorate([
    (0, common_1.Patch)('shots/:id'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.SHOT_UPDATE),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(4, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateShotDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "updateShot", null);
__decorate([
    (0, common_1.Get)('shots'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_shots_dto_1.ListShotsDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "listShots", null);
__decorate([
    (0, common_1.Post)('shots/batch/review'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "batchReview", null);
__decorate([
    (0, common_1.Post)('shots/batch/generate'),
    (0, audit_decorator_1.AuditAction)(audit_constants_1.AuditActions.PROJECT_UPDATE),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "batchGenerate", null);
exports.ProjectController = ProjectController = ProjectController_1 = __decorate([
    (0, common_1.Controller)('projects'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [project_service_1.ProjectService,
        structure_generate_service_1.StructureGenerateService,
        scene_graph_service_1.SceneGraphService,
        job_service_1.JobService,
        task_service_1.TaskService,
        permission_service_1.PermissionService,
        audit_log_service_1.AuditLogService])
], ProjectController);
//# sourceMappingURL=project.controller.js.map