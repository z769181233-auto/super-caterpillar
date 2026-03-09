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
var WorkerController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const worker_service_1 = require("./worker.service");
const register_worker_dto_1 = require("./dto/register-worker.dto");
const heartbeat_dto_1 = require("./dto/heartbeat.dto");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let WorkerController = WorkerController_1 = class WorkerController {
    moduleRef;
    auditLogService;
    constructor(moduleRef, auditLogService) {
        this.moduleRef = moduleRef;
        this.auditLogService = auditLogService;
    }
    get workerService() {
        return this.moduleRef.get(worker_service_1.WorkerService, { strict: false });
    }
    async register(registerDto, user, request) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const worker = await this.workerService.registerWorker(registerDto.workerId, registerDto.name, registerDto.capabilities, registerDto.gpuCount, registerDto.gpuMemory, registerDto.gpuType, user?.userId, apiKeyId, requestInfo.ip, requestInfo.userAgent);
        if (!worker) {
            throw new common_1.NotFoundException('Worker not found after registration');
        }
        return {
            success: true,
            data: {
                id: worker.id,
                workerId: worker.workerId,
                status: worker.status,
                capabilities: worker.capabilities,
            },
        };
    }
    async heartbeat(workerId, heartbeatDto, user, request) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const worker = await this.workerService.heartbeat(workerId, heartbeatDto.status, heartbeatDto.tasksRunning, heartbeatDto.temperature, user?.userId, apiKeyId, requestInfo.ip, requestInfo.userAgent);
        return {
            ok: true,
            workerId: worker.workerId,
            ts: new Date().toISOString(),
        };
    }
    async getOnlineWorkers(jobType) {
        const workers = await this.workerService.getOnlineWorkers(jobType);
        return {
            success: true,
            data: workers.map((w) => ({
                id: w.id,
                workerId: w.workerId,
                status: w.status,
                capabilities: w.capabilities,
                lastHeartbeat: w.lastHeartbeat,
                tasksRunning: w.tasksRunning,
            })),
        };
    }
    async getNextJob(workerId, user, request) {
        const logger = new common_1.Logger(WorkerController_1.name);
        console.log(`[WorkerController] CONSOLE LOG: getNextJob called. WorkerId=${workerId}`);
        const headerWorkerId = (request.headers['x-worker-id'] || '').trim();
        if (!headerWorkerId) {
            throw new common_1.NotFoundException('Missing x-worker-id header for claim audit');
        }
        if (headerWorkerId !== workerId) {
            throw new common_1.NotFoundException(`x-worker-id header mismatch: expected=${workerId} actual=${headerWorkerId}`);
        }
        const job = await this.workerService.dispatchNextJobForWorker(workerId);
        logger.log(JSON.stringify({
            event: 'WORKER_JOBS_NEXT_RESULT',
            workerId,
            statusCode: 200,
            returnedJobId: job?.id || null,
            timestamp: new Date().toISOString(),
        }));
        if (!job) {
            return {
                success: true,
                data: null,
                message: 'No job available',
            };
        }
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const nonce = request.hmacNonce;
        const signature = request.hmacSignature;
        const hmacTimestamp = request.hmacTimestamp;
        await this.auditLogService.record({
            userId: user?.userId,
            apiKeyId,
            action: 'JOB_STARTED',
            resourceType: 'job',
            resourceId: job.id,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
                workerId,
                taskId: job.taskId,
                type: job.type,
            },
            traceId: job.traceId || undefined,
        });
        return {
            success: true,
            data: {
                id: job.id,
                type: job.type,
                payload: job.payload,
                engineKey: job.engineBinding?.engineKey || job.payload?.engineKey,
                taskId: job.taskId,
                shotId: job.shotId,
                projectId: job.projectId,
                episodeId: job.episodeId,
                sceneId: job.sceneId,
                organizationId: job.organizationId,
                traceId: job.traceId,
                isVerification: job.isVerification,
                createdAt: job.createdAt,
            },
        };
    }
};
exports.WorkerController = WorkerController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_worker_dto_1.RegisterWorkerDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerController.prototype, "register", null);
__decorate([
    (0, common_1.Post)(':workerId/heartbeat'),
    __param(0, (0, common_1.Param)('workerId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, heartbeat_dto_1.HeartbeatDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerController.prototype, "heartbeat", null);
__decorate([
    (0, common_1.Get)('online'),
    __param(0, (0, common_1.Param)('jobType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkerController.prototype, "getOnlineWorkers", null);
__decorate([
    (0, common_1.Post)(':workerId/jobs/next'),
    __param(0, (0, common_1.Param)('workerId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerController.prototype, "getNextJob", null);
exports.WorkerController = WorkerController = WorkerController_1 = __decorate([
    (0, common_1.Controller)('workers'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        audit_log_service_1.AuditLogService])
], WorkerController);
//# sourceMappingURL=worker.controller.js.map