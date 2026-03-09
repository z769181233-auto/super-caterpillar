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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const job_service_1 = require("../job/job.service");
const database_1 = require("database");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
let TimelineController = class TimelineController {
    jobService;
    constructor(jobService) {
        this.jobService = jobService;
    }
    async createPreview(body, req) {
        const { projectId, ...timelineData } = body;
        if (!projectId)
            throw new common_1.BadRequestException('projectId is required');
        if (!timelineData.shots ||
            !Array.isArray(timelineData.shots) ||
            timelineData.shots.length === 0) {
            throw new common_1.BadRequestException('shots array must be provided and non-empty');
        }
        const userId = req.user?.id || req.apiKeyOwnerUserId;
        const orgId = req.user?.orgId ||
            req.user?.defaultOrganizationId ||
            req.apiKeyOwnerOrgId ||
            body.organizationId;
        if (!userId || !orgId) {
            throw new common_1.BadRequestException('User context invalid (userId or orgId missing)');
        }
        const runtimeDir = path.resolve(process.cwd(), '.runtime');
        const storageKeyRaw = `timelines/${projectId}/${(0, crypto_1.randomUUID)()}.json`;
        const absPath = path.join(runtimeDir, storageKeyRaw);
        try {
            if (!fs.existsSync(path.dirname(absPath))) {
                fs.mkdirSync(path.dirname(absPath), { recursive: true });
            }
            fs.writeFileSync(absPath, JSON.stringify(timelineData, null, 2));
        }
        catch (e) {
            throw new common_1.InternalServerErrorException(`Failed to persist timeline data: ${e.message}`);
        }
        const firstShotId = timelineData.shots[0].shotId;
        if (!firstShotId)
            throw new common_1.BadRequestException('First shot must have a valid shotId');
        const job = await this.jobService.create(firstShotId, {
            type: database_1.JobType.TIMELINE_PREVIEW,
            payload: {
                projectId,
                timelineStorageKey: storageKeyRaw,
                pipelineRunId: `run-${Date.now()}`,
                width: timelineData.width,
                height: timelineData.height,
                fps: timelineData.fps,
            },
        }, userId, orgId);
        return { success: true, jobId: job.id };
    }
};
exports.TimelineController = TimelineController;
__decorate([
    (0, common_1.Post)('preview'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TimelineController.prototype, "createPreview", null);
exports.TimelineController = TimelineController = __decorate([
    (0, common_1.Controller)('timeline'),
    __metadata("design:paramtypes", [job_service_1.JobService])
], TimelineController);
//# sourceMappingURL=timeline.controller.js.map