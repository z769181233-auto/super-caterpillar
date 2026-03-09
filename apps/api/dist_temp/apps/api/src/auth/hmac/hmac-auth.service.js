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
exports.HmacAuthService = void 0;
const common_1 = require("@nestjs/common");
const api_security_service_1 = require("../../security/api-security/api-security.service");
let HmacAuthService = class HmacAuthService {
    apiSecurity;
    constructor(apiSecurity) {
        this.apiSecurity = apiSecurity;
    }
    async verifySignature(apiKeyArg, methodArg, pathArg, bodyArg, nonceArg, timestampArg, signatureArg, debug) {
        const result = await this.apiSecurity.verifySignature({
            apiKey: apiKeyArg,
            nonce: nonceArg,
            timestamp: timestampArg,
            signature: signatureArg,
            method: methodArg,
            path: pathArg,
            body: bodyArg,
            contentSha256: debug?.contentSha256 || '',
            ip: debug?.ip,
            userAgent: debug?.ua,
        });
        if (!result.success) {
            throw new common_1.UnauthorizedException(result.errorMessage || 'Invalid signature');
        }
        return result.apiKeyRecord;
    }
};
exports.HmacAuthService = HmacAuthService;
exports.HmacAuthService = HmacAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => api_security_service_1.ApiSecurityService))),
    __metadata("design:paramtypes", [api_security_service_1.ApiSecurityService])
], HmacAuthService);
//# sourceMappingURL=hmac-auth.service.js.map