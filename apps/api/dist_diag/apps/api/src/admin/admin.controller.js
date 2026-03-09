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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const gate_mode_guard_1 = require("./gate-mode.guard");
const common_2 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const worker_service_1 = require("../worker/worker.service");
const orchestrator_service_1 = require("../orchestrator/orchestrator.service");
let AdminController = class AdminController {
    prisma;
    workerService;
    orchestratorService;
    constructor(prisma, workerService, orchestratorService) {
        this.prisma = prisma;
        this.workerService = workerService;
        this.orchestratorService = orchestratorService;
    }
    async reclaim() {
        const reclaimed = await this.workerService.reclaimJobsFromDeadWorkers();
        return { reclaimed };
    }
    async setCredits(body) {
        const { orgId, credits } = body;
        if (!orgId || typeof credits !== 'number') {
            return { ok: false, error: 'orgId and credits required' };
        }
        await this.prisma.organization.update({
            where: { id: orgId },
            data: { credits },
        });
        await this.prisma.auditLog.create({
            data: {
                action: 'ADMIN_SET_CREDITS',
                organizationId: orgId,
                metadata: { credits },
            },
        });
        return { ok: true };
    }
    async enqueueTest(body) {
        const { projectId, jobType, payload, organizationId, priority } = body;
        if (!projectId || !jobType)
            return { ok: false, error: 'projectId and jobType required' };
        let finalOrgId = organizationId;
        if (!finalOrgId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId },
                select: { organizationId: true },
            });
            finalOrgId = project?.organizationId;
        }
        if (!finalOrgId)
            return { ok: false, error: 'organizationId required or not found via project' };
        const job = await this.prisma.shotJob.create({
            data: {
                projectId,
                organizationId: finalOrgId,
                priority: priority ?? 0,
                status: 'PENDING',
                type: jobType,
                payload: (payload ?? {}),
                traceId: `gate_enqueue_${Date.now()}`,
            },
            select: { id: true },
        });
        return { ok: true, jobId: job.id };
    }
    async startStage1Pipeline(body) {
        const result = await this.orchestratorService.startStage1Pipeline(body);
        return { success: true, data: result };
    }
    async triggerStage4Scan(body) {
        const { storageKey, projectId, organizationId } = body;
        if (!storageKey || !projectId || !organizationId) {
            return { ok: false, error: 'storageKey, projectId and organizationId required' };
        }
        const dummyUserId = 'case-c-stress-user';
        await this.prisma.user.upsert({
            where: { id: dummyUserId },
            update: {},
            create: {
                id: dummyUserId,
                email: 'case-c-stress@test.local',
                passwordHash: '$2b$10$dummyhash',
            },
        });
        await this.prisma.organization.upsert({
            where: { id: organizationId },
            update: {},
            create: {
                id: organizationId,
                name: 'Case C Stress Organization',
                ownerId: dummyUserId,
            },
        });
        await this.prisma.project.upsert({
            where: { id: projectId },
            update: {},
            create: {
                id: projectId,
                name: 'Case C Stress Project',
                organizationId,
                ownerId: dummyUserId,
                status: 'in_progress',
            },
        });
        const job = await this.prisma.shotJob.create({
            data: {
                organizationId,
                projectId,
                type: 'NOVEL_SCAN_TOC',
                status: 'PENDING',
                priority: 100,
                payload: {
                    projectId,
                    fileKey: storageKey,
                    isVerification: true,
                },
            },
        });
        return { ok: true, jobId: job.id, projectId };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)('workers/reclaim'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "reclaim", null);
__decorate([
    (0, common_1.Post)('billing/set-credits'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "setCredits", null);
__decorate([
    (0, common_1.Post)('jobs/enqueue-test'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "enqueueTest", null);
__decorate([
    (0, common_1.Post)('prod-gate/stage1-pipeline'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "startStage1Pipeline", null);
__decorate([
    (0, common_1.Post)('trigger/stage4/scan'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "triggerStage4Scan", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_2.UseGuards)(gate_mode_guard_1.GateModeGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        worker_service_1.WorkerService,
        orchestrator_service_1.OrchestratorService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map