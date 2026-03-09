"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmacAuthModule = void 0;
const common_1 = require("@nestjs/common");
const hmac_auth_service_1 = require("./hmac-auth.service");
const hmac_auth_guard_1 = require("./hmac-auth.guard");
const api_key_service_1 = require("./api-key.service");
const prisma_module_1 = require("../../prisma/prisma.module");
const redis_module_1 = require("../../redis/redis.module");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
const api_security_module_1 = require("../../security/api-security/api-security.module");
const nonce_module_1 = require("../nonce.module");
let HmacAuthModule = class HmacAuthModule {
};
exports.HmacAuthModule = HmacAuthModule;
exports.HmacAuthModule = HmacAuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            (0, common_1.forwardRef)(() => audit_log_module_1.AuditLogModule),
            api_security_module_1.ApiSecurityModule,
            nonce_module_1.NonceModule,
        ],
        providers: [hmac_auth_service_1.HmacAuthService, hmac_auth_guard_1.HmacAuthGuard, api_key_service_1.ApiKeyService],
        exports: [hmac_auth_service_1.HmacAuthService, hmac_auth_guard_1.HmacAuthGuard, api_key_service_1.ApiKeyService, nonce_module_1.NonceModule],
    })
], HmacAuthModule);
//# sourceMappingURL=hmac-auth.module.js.map