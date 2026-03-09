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
exports.JobGenericController = void 0;
const common_1 = require("@nestjs/common");
const job_service_1 = require("./job.service");
const create_job_dto_1 = require("./dto/create-job.dto");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const crypto_1 = require("crypto");
let JobGenericController = class JobGenericController {
    jobService;
    constructor(jobService) {
        this.jobService = jobService;
    }
    async createGenericJob(createJobDto, user, organizationId, req) {
        try {
            console.log('[JobGenericController] Received request:', JSON.stringify(createJobDto));
            console.log('[JobGenericController] User:', JSON.stringify(user));
            if (!process.env.ENABLE_JOB_GENERIC_CONTROLLER) {
                throw new common_1.HttpException('JobGenericController is disabled', common_1.HttpStatus.FORBIDDEN);
            }
            const userId = user?.userId || req.apiKeyId || 'system-worker';
            if (!userId) {
                throw new common_1.HttpException('USER_CONTEXT_MISSING', common_1.HttpStatus.UNAUTHORIZED);
            }
            const isSystemWorker = !!(req.apiKeyId || user?.userId === 'system-worker');
            const jobTypeStr = isSystemWorker
                ? (createJobDto.jobType ?? createJobDto.type)
                : createJobDto.type;
            const projectId = isSystemWorker
                ? (createJobDto.projectId ?? createJobDto.payload?.projectId ?? user?.userId)
                : (createJobDto.payload?.projectId ?? user?.userId);
            const orgId = isSystemWorker
                ? (createJobDto.organizationId ?? organizationId ?? 'org-default')
                : (organizationId ?? 'org-default');
            const job = await this.jobService.createCECoreJob({
                projectId,
                organizationId: orgId,
                jobType: jobTypeStr,
                payload: createJobDto.payload,
                traceId: createJobDto.traceId,
                isVerification: createJobDto.isVerification,
                dedupeKey: createJobDto.dedupeKey,
                priority: createJobDto.priority,
            });
            console.log('[JobGenericController] SUCCESS. Job:', JSON.stringify(job));
            return {
                success: true,
                data: job,
                requestId: (0, crypto_1.randomUUID)(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error('[JobGenericController] CRITICAL ERROR:', error.message, error.stack);
            throw error;
        }
    }
};
exports.JobGenericController = JobGenericController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_job_dto_1.CreateJobDto, Object, String, Object]),
    __metadata("design:returntype", Promise)
], JobGenericController.prototype, "createGenericJob", null);
exports.JobGenericController = JobGenericController = __decorate([
    (0, common_1.Controller)('jobs'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Inject)(job_service_1.JobService)),
    __metadata("design:paramtypes", [job_service_1.JobService])
], JobGenericController);
//# sourceMappingURL=job-generic.controller.js.map