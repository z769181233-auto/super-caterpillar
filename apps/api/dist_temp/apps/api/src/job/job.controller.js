"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JobController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobController = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("./job.service");
const job_report_facade_1 = require("./job-report.facade");
const permission_service_1 = require("../permission/permission.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const quota_guard_1 = require("../auth/guards/quota.guard");
const budget_guard_1 = require("../auth/guards/budget.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const create_job_dto_1 = require("./dto/create-job.dto");
const report_job_dto_1 = require("./dto/report-job.dto");
const list_jobs_dto_1 = require("./dto/list-jobs.dto");
const instantiate_ce01_dto_1 = require("./dto/instantiate-ce01.dto");
const job_operations_dto_1 = require("./dto/job-operations.dto");
const audit_constants_1 = require("../audit/audit.constants");
const audit_log_service_1 = require("../audit-log/audit-log.service");
const capacity_gate_service_1 = require("../capacity/capacity-gate.service");
const crypto_1 = require("crypto");
let JobController = JobController_1 = class JobController {
    jobService;
    jobReportFacade;
    permissionService;
    auditLogService;
    capacityGateService;
    logger = new common_1.Logger(JobController_1.name);
    constructor(jobService, jobReportFacade, permissionService, auditLogService, capacityGateService) {
        this.jobService = jobService;
        this.jobReportFacade = jobReportFacade;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.capacityGateService = capacityGateService;
    }
    async debugKey(key) {
        const prisma = this.jobService.prisma;
        const record = await prisma.apiKey.findUnique({ where: { key } });
        const count = await prisma.project.count();
        return {
            found: !!record,
            key,
            dbUrlEnv: process.env.DATABASE_URL,
            projectCount: count,
            record: record ? { id: record.id, status: record.status } : null,
        };
    }
    async createJob(shotId, createJobDto, user, organizationId, req, res) {
        const u = req.user;
        const effectiveUserId = u?.userId || req.apiKeyId || 'system-worker';
        const { env: scuEnv } = await Promise.resolve().then(() => __importStar(require('@scu/config')));
        if (scuEnv.apiBackpressureEnabled) {
            const snapshot = await this.jobService.getQueueSnapshot();
            if (snapshot.pending >= scuEnv.apiQueuePendingLimit ||
                snapshot.running >= scuEnv.apiQueueRunningLimit) {
                await this.auditLogService.record({
                    userId: effectiveUserId,
                    action: 'JOB_REJECTED_BACKPRESSURE',
                    resourceType: 'job',
                    details: {
                        snapshot,
                        limits: {
                            pending: scuEnv.apiQueuePendingLimit,
                            running: scuEnv.apiQueueRunningLimit,
                        },
                    },
                });
                const retryAfter = scuEnv.apiRetryAfterSeconds || 5;
                if (res && typeof res.set === 'function') {
                    res.set('Retry-After', retryAfter.toString());
                }
                throw new common_1.HttpException({
                    statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                    message: 'System busy: Queue capacity reached. Please retry later.',
                    code: 'API_BACKPRESSURE_LIMIT',
                    retryAfter,
                }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
        }
        const job = await this.jobService.create(shotId, createJobDto, effectiveUserId, organizationId);
        return {
            success: true,
            data: job,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async createProjectJob(createJobDto, user, organizationId, req) {
        const u = req.user;
        const effectiveUserId = u?.userId || req.apiKeyId || 'system-worker';
        if (createJobDto.projectId) {
            const jobType = createJobDto.type || createJobDto.jobType;
            const job = await this.jobService.createCECoreJob({
                projectId: createJobDto.projectId,
                organizationId,
                jobType: jobType,
                payload: createJobDto.payload || {},
                traceId: createJobDto.traceId,
                dedupeKey: createJobDto.dedupeKey,
                priority: createJobDto.priority,
                isVerification: createJobDto.isVerification,
            });
            return {
                success: true,
                data: job,
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        throw new common_1.BadRequestException('Project ID is required for project-level jobs (POST /api/jobs)');
    }
    async getJobsByShot(shotId, user, organizationId) {
        const jobs = await this.jobService.findByShotId(shotId, user.userId, organizationId);
        return {
            success: true,
            data: jobs,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getCapacityUsage(user, organizationId) {
        const usage = await this.capacityGateService.getCapacityUsage(organizationId);
        return {
            success: true,
            data: usage,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getJob(id, user, organizationId) {
        this.logger.debug(`Controller getJob: id=${id}, userId=${user?.userId}, orgId=${organizationId}`);
        const job = await this.jobService.findJobById(id, user.userId, organizationId);
        this.logger.debug(`Controller job result: id=${job.id}, status=${job.status}, workerId=${job.workerId}`);
        return {
            success: true,
            data: job,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async listJobs(query, user, organizationId) {
        const result = await this.jobService.listJobs(user.userId, organizationId, query);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async getEngineSummary(engineKey, projectId, user, organizationId) {
        const summary = await this.jobService.getEngineSummary(engineKey, projectId, user.userId, organizationId);
        return {
            success: true,
            data: summary,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async retryJob(id, body, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const job = await this.jobService.retryJob(id, user.userId, organizationId, body.resetAttempts);
        return {
            success: true,
            data: job,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async cancelJob(id, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const job = await this.jobService.cancelJob(id, user.userId, organizationId);
        return {
            success: true,
            data: job,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async forceFailJob(id, body, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const job = await this.jobService.forceFailJob(id, user.userId, organizationId, body.message);
        return {
            success: true,
            data: job,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async batchRetry(body, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const result = await this.jobService.batchRetry(body.jobIds, user.userId, organizationId, false);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async batchCancel(body, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const result = await this.jobService.batchCancel(body.jobIds, user.userId, organizationId);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async batchForceFail(body, user, organizationId) {
        await this.permissionService.assertCanManageJobs(user.userId, organizationId);
        const result = await this.jobService.batchForceFail(body.jobIds, user.userId, organizationId, body.note);
        return {
            success: true,
            data: result,
            requestId: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
        };
    }
    async startJob(jobId, user, request) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const workerId = request.body?.workerId || request.headers['x-worker-id'];
        if (!workerId) {
            throw new common_1.BadRequestException('Worker ID is required');
        }
        const job = await this.jobService.markJobRunning(jobId, workerId);
        await this.auditLogService.record({
            userId: user?.userId,
            apiKeyId,
            action: 'JOB_STARTED',
            resourceType: 'job',
            resourceId: jobId,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
                workerId,
                jobType: job.type,
                taskId: job.taskId,
            },
        });
        return {
            ok: true,
            jobId: job.id,
            status: job.status,
        };
    }
    async reportJob(jobId, reportDto, user, request) {
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        const apiKeyId = request.apiKey?.id;
        const nonce = request.hmacNonce;
        const signature = request.hmacSignature;
        const hmacTimestamp = request.hmacTimestamp;
        const result = await this.jobReportFacade.handleReport({
            jobId,
            status: reportDto.status,
            result: reportDto.result,
            errorMessage: reportDto.errorMessage,
            userId: user?.userId,
            apiKeyId,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            hmacMeta: {
                nonce,
                signature,
                hmacTimestamp,
            },
            attempts: reportDto.attempts,
        });
        if (!result) {
            throw new common_1.NotFoundException(`Job ${jobId} not found after report`);
        }
        return {
            ok: true,
            jobId: result.id,
            status: result.status,
        };
    }
    async ackJob(jobId, request) {
        const workerId = request.body?.workerId || request.headers['x-worker-id'];
        if (!workerId) {
            throw new common_1.BadRequestException('Worker ID is required');
        }
        const result = await this.jobService.ackJob(jobId, workerId);
        return {
            success: true,
            data: result,
        };
    }
    async completeJob(jobId, body, request) {
        const workerId = request.body?.workerId || request.headers['x-worker-id'];
        if (!workerId) {
            throw new common_1.BadRequestException('Worker ID is required');
        }
        const result = await this.jobService.completeJob(jobId, workerId, body);
        return {
            success: true,
            data: result,
        };
    }
    async instantiateCE01(body, user, organizationId, request) {
        const { characterId, projectId, posePreset, styleSeed, traceId } = body;
        const result = await this.jobService.createCharacterReferenceSheetJob({
            characterId,
            projectId,
            organizationId,
            posePreset,
            styleSeed,
            userId: user.userId,
            traceId,
        });
        const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
        await this.auditLogService.record({
            userId: user.userId,
            action: audit_constants_1.AuditActions.JOB_CREATED,
            resourceType: 'job',
            resourceId: result.referenceSheetId,
            ip: requestInfo.ip,
            userAgent: requestInfo.userAgent,
            details: {
                type: 'CE01_REFERENCE_SHEET',
                characterId,
                projectId,
                fingerprint: result.fingerprint,
            },
        });
        return {
            ok: true,
            data: result,
        };
    }
};
exports.JobController = JobController;
__decorate([
    (0, common_1.Get)('debug-key/:key'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "debugKey", null);
__decorate([
    (0, common_1.Post)('shots/:shotId/jobs'),
    (0, common_1.UseGuards)(quota_guard_1.QuotaGuard, budget_guard_1.BudgetGuard),
    __param(0, (0, common_1.Param)('shotId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(4, (0, common_1.Req)()),
    __param(5, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_job_dto_1.CreateJobDto, Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "createJob", null);
__decorate([
    (0, common_1.Post)('jobs'),
    (0, common_1.UseGuards)(quota_guard_1.QuotaGuard, budget_guard_1.BudgetGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_job_dto_1.CreateJobDto, Object, String, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "createProjectJob", null);
__decorate([
    (0, common_1.Get)('shots/:shotId/jobs'),
    __param(0, (0, common_1.Param)('shotId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "getJobsByShot", null);
__decorate([
    (0, common_1.Get)('jobs/capacity'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "getCapacityUsage", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "getJob", null);
__decorate([
    (0, common_1.Get)('jobs'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_jobs_dto_1.ListJobsDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "listJobs", null);
__decorate([
    (0, common_1.Get)('jobs/engine-summary'),
    __param(0, (0, common_1.Query)('engineKey')),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "getEngineSummary", null);
__decorate([
    (0, common_1.Post)('jobs/:id/retry'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, job_operations_dto_1.RetryJobDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "cancelJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/force-fail'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, job_operations_dto_1.ForceFailJobDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "forceFailJob", null);
__decorate([
    (0, common_1.Post)('jobs/batch/retry'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [job_operations_dto_1.BatchJobOperationDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "batchRetry", null);
__decorate([
    (0, common_1.Post)('jobs/batch/cancel'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [job_operations_dto_1.BatchJobOperationDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "batchCancel", null);
__decorate([
    (0, common_1.Post)('jobs/batch/force-fail'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [job_operations_dto_1.BatchJobOperationDto, Object, String]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "batchForceFail", null);
__decorate([
    (0, common_1.Post)('jobs/:id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "startJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/report'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, report_job_dto_1.ReportJobDto, Object, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "reportJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/ack'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "ackJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "completeJob", null);
__decorate([
    (0, common_1.Post)('jobs/ce01/instantiate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [instantiate_ce01_dto_1.InstantiateCE01Dto, Object, String, Object]),
    __metadata("design:returntype", Promise)
], JobController.prototype, "instantiateCE01", null);
exports.JobController = JobController = JobController_1 = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Inject)(job_service_1.JobService)),
    __param(1, (0, common_1.Inject)(job_report_facade_1.JobReportFacade)),
    __param(2, (0, common_1.Inject)(permission_service_1.PermissionService)),
    __param(3, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(4, (0, common_1.Inject)(capacity_gate_service_1.CapacityGateService)),
    __metadata("design:paramtypes", [job_service_1.JobService,
        job_report_facade_1.JobReportFacade,
        permission_service_1.PermissionService,
        audit_log_service_1.AuditLogService,
        capacity_gate_service_1.CapacityGateService])
], JobController);
//# sourceMappingURL=job.controller.js.map