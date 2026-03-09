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
exports.TextController = void 0;
const common_1 = require("@nestjs/common");
const jwt_or_hmac_guard_1 = require("../auth/guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const text_service_1 = require("./text.service");
const visual_density_dto_1 = require("./dto/visual-density.dto");
const visual_enrich_dto_1 = require("./dto/visual-enrich.dto");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
const common_2 = require("@nestjs/common");
let TextController = class TextController {
    textService;
    constructor(textService) {
        this.textService = textService;
    }
    async visualDensity(dto, user, org, req) {
        return this.textService.visualDensity(dto, user?.id, org?.id, req.ip || req.headers['x-forwarded-for'] || undefined, req.headers['user-agent'] || undefined);
    }
    async visualEnrich(dto, user, org, req) {
        return this.textService.visualEnrich(dto, user?.id, org?.id, req.ip || req.headers['x-forwarded-for'] || undefined, req.headers['user-agent'] || undefined);
    }
};
exports.TextController = TextController;
__decorate([
    (0, common_1.Post)('visual-density'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [visual_density_dto_1.VisualDensityDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TextController.prototype, "visualDensity", null);
__decorate([
    (0, common_1.Post)('enrich'),
    (0, api_security_decorator_1.RequireSignature)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __param(3, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [visual_enrich_dto_1.VisualEnrichDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TextController.prototype, "visualEnrich", null);
exports.TextController = TextController = __decorate([
    (0, common_1.Controller)('text'),
    (0, common_1.UseGuards)(jwt_or_hmac_guard_1.JwtOrHmacGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [text_service_1.TextService])
], TextController);
//# sourceMappingURL=text.controller.js.map