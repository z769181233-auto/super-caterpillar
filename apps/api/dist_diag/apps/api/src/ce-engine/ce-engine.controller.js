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
var CEEngineController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CEEngineController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const ce_engine_service_1 = require("./ce-engine.service");
const parse_story_dto_1 = require("./dto/parse-story.dto");
const visual_density_dto_1 = require("./dto/visual-density.dto");
const enrich_text_dto_1 = require("./dto/enrich-text.dto");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const common_2 = require("@nestjs/common");
let CEEngineController = CEEngineController_1 = class CEEngineController {
    ceEngineService;
    logger = new common_1.Logger(CEEngineController_1.name);
    constructor(ceEngineService) {
        this.ceEngineService = ceEngineService;
    }
    async parseStory(dto, userId, organizationId, req) {
        const apiKeyId = req.apiKeyId;
        this.logger.log(`CE06 parseStory request: projectId=${dto.projectId}, textLength=${dto.rawText.length}`);
        const result = await this.ceEngineService.parseStory({
            projectId: dto.projectId,
            rawText: dto.rawText,
            options: dto.options,
        }, userId, organizationId, apiKeyId);
        return result;
    }
    async analyzeVisualDensity(dto, userId, organizationId, req) {
        const apiKeyId = req.apiKeyId;
        this.logger.log(`CE03 analyzeVisualDensity request: projectId=${dto.projectId}, textLength=${dto.text.length}`);
        const result = await this.ceEngineService.analyzeVisualDensity({
            projectId: dto.projectId,
            text: dto.text,
            options: dto.options,
        }, userId, organizationId, apiKeyId);
        return result;
    }
    async enrichText(dto, userId, organizationId, req) {
        this.logger.log(`CE04 enrichText request: projectId=${dto.projectId}, textLength=${dto.text.length}`);
        const apiKeyId = req.apiKeyId;
        const result = await this.ceEngineService.enrichText({
            projectId: dto.projectId,
            text: dto.text,
            options: dto.options,
        }, userId, organizationId, apiKeyId, req.ip || req.headers['x-forwarded-for'] || undefined, req.headers['user-agent'] || undefined);
        return result;
    }
};
exports.CEEngineController = CEEngineController;
__decorate([
    (0, common_1.Post)('core/story/parse'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [parse_story_dto_1.ParseStoryDto, String, String, Object]),
    __metadata("design:returntype", Promise)
], CEEngineController.prototype, "parseStory", null);
__decorate([
    (0, common_1.Post)('text/visual-density'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [visual_density_dto_1.VisualDensityDto, String, String, Object]),
    __metadata("design:returntype", Promise)
], CEEngineController.prototype, "analyzeVisualDensity", null);
__decorate([
    (0, common_1.Post)('text/enrich'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [enrich_text_dto_1.EnrichTextDto, String, String, Object]),
    __metadata("design:returntype", Promise)
], CEEngineController.prototype, "enrichText", null);
exports.CEEngineController = CEEngineController = CEEngineController_1 = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard),
    __metadata("design:paramtypes", [ce_engine_service_1.CEEngineService])
], CEEngineController);
//# sourceMappingURL=ce-engine.controller.js.map