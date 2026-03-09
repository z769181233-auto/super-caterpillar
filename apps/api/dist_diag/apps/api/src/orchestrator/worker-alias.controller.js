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
exports.WorkerAliasController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const worker_service_1 = require("../worker/worker.service");
const register_worker_dto_1 = require("../worker/dto/register-worker.dto");
const heartbeat_dto_1 = require("../worker/dto/heartbeat.dto");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let WorkerAliasController = class WorkerAliasController {
    workerService;
    auditLogService;
    constructor(workerService, auditLogService) {
        this.workerService = workerService;
        this.auditLogService = auditLogService;
    }
    async register(registerDto, user, request) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const worker = await this.workerService.registerWorker(registerDto.workerId, registerDto.name, registerDto.capabilities, registerDto.gpuCount, registerDto.gpuMemory, registerDto.gpuType, user?.userId, apiKeyId, requestInfo.ip, requestInfo.userAgent);
        if (!worker) {
            throw new Error('Worker not found after registration');
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
    async getNextJob(workerId, user, request) {
        console.log(`[XXX_DEBUG] WorkerAliasController.getNextJob called for ${workerId}`);
        const job = await this.workerService.dispatchNextJobForWorker(workerId);
        if (!job) {
            return {
                success: true,
                data: null,
                message: 'No job available',
            };
        }
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
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
                taskId: job.taskId,
                shotId: job.shotId,
            },
        };
    }
};
exports.WorkerAliasController = WorkerAliasController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_worker_dto_1.RegisterWorkerDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerAliasController.prototype, "register", null);
__decorate([
    (0, common_1.Post)(':workerId/heartbeat'),
    __param(0, (0, common_1.Param)('workerId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, heartbeat_dto_1.HeartbeatDto, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerAliasController.prototype, "heartbeat", null);
__decorate([
    (0, common_1.Get)(':workerId/jobs/next'),
    (0, common_1.Post)(':workerId/jobs/next'),
    __param(0, (0, common_1.Param)('workerId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkerAliasController.prototype, "getNextJob", null);
exports.WorkerAliasController = WorkerAliasController = __decorate([
    (0, common_1.Controller)('workers'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [worker_service_1.WorkerService,
        audit_log_service_1.AuditLogService])
], WorkerAliasController);
//# sourceMappingURL=worker-alias.controller.js.map