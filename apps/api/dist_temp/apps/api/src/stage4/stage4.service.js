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
var Stage4Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stage4Service = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const engine_invoker_hub_service_1 = require("../engine-hub/engine-invoker-hub.service");
const project_service_1 = require("../project/project.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let Stage4Service = Stage4Service_1 = class Stage4Service {
    prisma;
    engineInvoker;
    projectService;
    auditLogService;
    logger = new common_1.Logger(Stage4Service_1.name);
    constructor(prisma, engineInvoker, projectService, auditLogService) {
        this.prisma = prisma;
        this.engineInvoker = engineInvoker;
        this.projectService = projectService;
        this.auditLogService = auditLogService;
    }
    async ensureSceneInProject(projectId, sceneId) {
        const scene = await this.prisma.scene.findUnique({
            where: { id: sceneId },
            include: { episode: true },
        });
        if (!scene) {
            throw new common_1.NotFoundException('Scene not found');
        }
        const sceneProjectId = scene.episode?.projectId || null;
        if (sceneProjectId && sceneProjectId !== projectId) {
            throw new common_1.ForbiddenException('Scene does not belong to project');
        }
        return scene;
    }
    async ensureShotInProject(projectId, shotId) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: { scene: { include: { episode: true } } },
        });
        if (!shot) {
            throw new common_1.NotFoundException('Shot not found');
        }
        const shotProjectId = shot.scene?.episode?.projectId || null;
        if (shotProjectId && shotProjectId !== projectId) {
            throw new common_1.ForbiddenException('Shot does not belong to project');
        }
        return shot;
    }
    async runSemanticEnhancement(projectId, sceneId, userId) {
        try {
            this.logger.log(`Running SE for project=${projectId} scene=${sceneId} user=${userId}`);
            await this.projectService.checkOwnership(projectId, userId);
            const scene = await this.ensureSceneInProject(projectId, sceneId);
            const text = scene.summary || scene.title || '';
            this.logger.log(`Scene found, invoking engine...`);
            const prisma = this.prisma;
            const result = await this.engineInvoker.invoke({
                engineKey: 'semantic_enhancement',
                payload: {
                    nodeType: 'scene',
                    nodeId: sceneId,
                    text,
                    context: { projectId, sceneId },
                },
            });
            this.logger.log(`Engine result: ${JSON.stringify(result)}`);
            if (!result.success || !result.output) {
                throw new Error(result.error?.message || 'Semantic enhancement failed');
            }
            this.logger.log(`[Stage4] Writing to DB...`);
            await prisma.semanticEnhancement.upsert({
                where: { nodeType_nodeId: { nodeType: 'scene', nodeId: sceneId } },
                update: {
                    data: result.output,
                    engineKey: 'semantic_enhancement',
                    engineVersion: 'default',
                    confidence: result.output?.summary ? 0.7 : null,
                },
                create: {
                    nodeType: 'scene',
                    nodeId: sceneId,
                    data: result.output,
                    engineKey: 'semantic_enhancement',
                    engineVersion: 'default',
                    confidence: result.output?.summary ? 0.7 : null,
                },
            });
            return result.output;
        }
        catch (e) {
            this.logger.error(`Error: ${e.message}`, e.stack);
            throw e;
        }
    }
    async getSemanticEnhancement(sceneId) {
        const prisma = this.prisma;
        return prisma.semanticEnhancement.findUnique({
            where: { nodeType_nodeId: { nodeType: 'scene', nodeId: sceneId } },
        });
    }
    async runShotPlanning(projectId, shotId, userId) {
        await this.projectService.checkOwnership(projectId, userId);
        const shot = await this.ensureShotInProject(projectId, shotId);
        const text = shot.description || shot.title || '';
        const prisma = this.prisma;
        const result = await this.engineInvoker.invoke({
            engineKey: 'shot_planning',
            payload: {
                shotId,
                text,
                context: { projectId, sceneId: shot.sceneId },
            },
        });
        if (!result.success || !result.output) {
            throw new Error(result.error?.message || 'Shot planning failed');
        }
        await prisma.shotPlanning.upsert({
            where: { shotId },
            update: {
                data: result.output,
                engineKey: 'shot_planning',
                engineVersion: 'default',
                confidence: result.output?.shotType?.confidence,
            },
            create: {
                shotId,
                data: result.output,
                engineKey: 'shot_planning',
                engineVersion: 'default',
                confidence: result.output?.shotType?.confidence,
            },
        });
        return result.output;
    }
    async getShotPlanning(shotId) {
        const prisma = this.prisma;
        return prisma.shotPlanning.findUnique({
            where: { shotId },
        });
    }
    async runStructureQA(projectId, userId) {
        await this.projectService.checkOwnership(projectId, userId);
        const prisma = this.prisma;
        const result = await this.engineInvoker.invoke({
            engineKey: 'structure_qa',
            payload: {
                projectId,
            },
        });
        if (!result.success || !result.output) {
            throw new Error(result.error?.message || 'Structure QA failed');
        }
        await prisma.structureQualityReport.upsert({
            where: { projectId },
            update: {
                data: result.output,
                engineKey: 'structure_qa',
                engineVersion: 'default',
            },
            create: {
                projectId,
                data: result.output,
                engineKey: 'structure_qa',
                engineVersion: 'default',
            },
        });
        return result.output;
    }
    async getStructureQA(projectId) {
        const prisma = this.prisma;
        return prisma.structureQualityReport.findUnique({
            where: { projectId },
        });
    }
    async recordAudit(action, resourceType, resourceId, userId, details) {
        try {
            await this.auditLogService.record({
                userId,
                action,
                resourceType,
                resourceId: resourceId ?? undefined,
                details,
            });
        }
        catch (e) {
        }
    }
};
exports.Stage4Service = Stage4Service;
exports.Stage4Service = Stage4Service = Stage4Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        engine_invoker_hub_service_1.EngineInvokerHubService,
        project_service_1.ProjectService,
        audit_log_service_1.AuditLogService])
], Stage4Service);
//# sourceMappingURL=stage4.service.js.map