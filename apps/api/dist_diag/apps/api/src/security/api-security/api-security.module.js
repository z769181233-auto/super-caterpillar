"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSecurityModule = void 0;
const common_1 = require("@nestjs/common");
const api_security_service_1 = require("./api-security.service");
const api_security_guard_1 = require("./api-security.guard");
const secret_encryption_service_1 = require("./secret-encryption.service");
const prisma_module_1 = require("../../prisma/prisma.module");
const redis_module_1 = require("../../redis/redis.module");
const audit_log_module_1 = require("../../audit-log/audit-log.module");
let ApiSecurityModule = class ApiSecurityModule {
};
exports.ApiSecurityModule = ApiSecurityModule;
exports.ApiSecurityModule = ApiSecurityModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, redis_module_1.RedisModule, (0, common_1.forwardRef)(() => audit_log_module_1.AuditLogModule)],
        providers: [api_security_service_1.ApiSecurityService, api_security_guard_1.ApiSecurityGuard, secret_encryption_service_1.SecretEncryptionService],
        exports: [api_security_service_1.ApiSecurityService, api_security_guard_1.ApiSecurityGuard, secret_encryption_service_1.SecretEncryptionService],
    })
], ApiSecurityModule);
//# sourceMappingURL=api-security.module.js.map