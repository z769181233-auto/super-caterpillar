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
exports.StoryController = void 0;
const common_1 = require("@nestjs/common");
const story_service_1 = require("./story.service");
const job_service_1 = require("../job/job.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let StoryController = class StoryController {
    storyService;
    prisma;
    jobService;
    constructor(storyService, prisma, jobService) {
        this.storyService = storyService;
        this.prisma = prisma;
        this.jobService = jobService;
    }
    async parseStory(body, req) {
        const { raw_text, rawText, context, projectId: topProjectId, projectId, title, author } = body;
        const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
        const userId = req.user?.id || req.apiKeyOwnerUserId;
        const traceId = req.headers['x-request-id'] || req.headers['x-trace-id'] || `req_${Date.now()}`;
        const result = await this.storyService.parseStory({
            projectId: context?.projectId || topProjectId || projectId,
            rawText: raw_text || rawText,
            title: title || 'Direct Input',
            author: author || 'Direct Input',
        }, userId, organizationId, req.ip, req.headers['user-agent'], traceId);
        return {
            success: true,
            data: {
                jobId: result.jobId,
                status: result.status,
                taskId: result.taskId,
                traceId: result.traceId,
            },
        };
    }
};
exports.StoryController = StoryController;
__decorate([
    (0, common_1.Post)('parse'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StoryController.prototype, "parseStory", null);
exports.StoryController = StoryController = __decorate([
    (0, common_1.Controller)('story'),
    __metadata("design:paramtypes", [story_service_1.StoryService,
        prisma_service_1.PrismaService,
        job_service_1.JobService])
], StoryController);
//# sourceMappingURL=story.controller.js.map