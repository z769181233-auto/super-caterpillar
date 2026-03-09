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
exports.BibleAliasController = void 0;
const common_1 = require("@nestjs/common");
const story_service_1 = require("../story/story.service");
const text_service_1 = require("../text/text.service");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
function requireInternalEnabled() {
    if (process.env.BIBLE_INTERNAL_ALIAS_ENABLED !== '1') {
        throw new common_1.NotFoundException('internal route disabled');
    }
}
let BibleAliasController = class BibleAliasController {
    storyService;
    textService;
    constructor(storyService, textService) {
        this.storyService = storyService;
        this.textService = textService;
    }
    async internalStoryParse(body, req) {
        requireInternalEnabled();
        return this.handleStoryParse(body, req);
    }
    async storyParse(body, req) {
        return this.handleStoryParse(body, req);
    }
    async handleStoryParse(body, req) {
        console.log('[BibleAlias DEBUG] handleStoryParse incoming body keys:', Object.keys(body));
        const rawText = body.text || body.rawText || body.raw_text;
        const projectId = body.projectId || body.project_id;
        const title = body.title || body.name;
        const author = body.author;
        const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
        const userId = req.user?.id || req.apiKeyOwnerUserId;
        const traceId = req.headers['x-request-id'] || req.headers['x-trace-id'];
        const result = await this.storyService.parseStory({
            rawText: rawText,
            projectId: projectId,
            title: title,
            author: author,
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
    async internalTextEnrich(body, req) {
        requireInternalEnabled();
        return this.handleTextEnrich(body, req);
    }
    async textEnrich(body, req) {
        return this.handleTextEnrich(body, req);
    }
    async handleTextEnrich(body, req) {
        const user = req.user;
        const organizationId = req.user?.organizationId || req.apiKeyOwnerOrgId;
        const result = await this.textService.visualEnrich({
            text: body.text,
            projectId: body.projectId,
        }, user?.id, organizationId, req.ip || req.headers['x-forwarded-for'] || undefined, req.headers['user-agent'] || undefined);
        return result;
    }
};
exports.BibleAliasController = BibleAliasController;
__decorate([
    (0, common_1.Post)('/_internal/story/parse'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BibleAliasController.prototype, "internalStoryParse", null);
__decorate([
    (0, common_1.Post)('/story/parse'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BibleAliasController.prototype, "storyParse", null);
__decorate([
    (0, common_1.Post)('/_internal/text/enrich'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BibleAliasController.prototype, "internalTextEnrich", null);
__decorate([
    (0, common_1.Post)('/text/enrich'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BibleAliasController.prototype, "textEnrich", null);
exports.BibleAliasController = BibleAliasController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [story_service_1.StoryService,
        text_service_1.TextService])
], BibleAliasController);
//# sourceMappingURL=bible-alias.controller.js.map