"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_strategy_1 = require("./jwt.strategy");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const prisma_module_1 = require("../prisma/prisma.module");
const jwt_or_hmac_guard_1 = require("./guards/jwt-or-hmac.guard");
const permissions_guard_1 = require("./permissions.guard");
const user_module_1 = require("../user/user.module");
const quota_guard_1 = require("./guards/quota.guard");
const budget_guard_1 = require("./guards/budget.guard");
const hmac_auth_module_1 = require("./hmac/hmac-auth.module");
const billing_module_1 = require("../billing/billing.module");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const permission_module_1 = require("../permission/permission.module");
const config_1 = require("@scu/config");
const audit_module_1 = require("../audit/audit.module");
const nonce_module_1 = require("./nonce.module");
const api_security_module_1 = require("../security/api-security/api-security.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            prisma_module_1.PrismaModule,
            jwt_1.JwtModule.registerAsync({
                useFactory: () => ({
                    secret: process.env.JWT_SECRET || config_1.env.jwtSecret,
                    signOptions: {
                        expiresIn: config_1.env.jwtExpiresIn,
                    },
                }),
            }),
            (0, common_1.forwardRef)(() => user_module_1.UserModule),
            hmac_auth_module_1.HmacAuthModule,
            permission_module_1.PermissionModule,
            audit_module_1.AuditModule,
            nonce_module_1.NonceModule,
            billing_module_1.BillingModule,
            audit_log_module_1.AuditLogModule,
            api_security_module_1.ApiSecurityModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            jwt_auth_guard_1.JwtAuthGuard,
            jwt_or_hmac_guard_1.JwtOrHmacGuard,
            permissions_guard_1.PermissionsGuard,
            quota_guard_1.QuotaGuard,
            budget_guard_1.BudgetGuard,
        ],
        exports: [
            auth_service_1.AuthService,
            hmac_auth_module_1.HmacAuthModule,
            jwt_auth_guard_1.JwtAuthGuard,
            jwt_or_hmac_guard_1.JwtOrHmacGuard,
            permissions_guard_1.PermissionsGuard,
            quota_guard_1.QuotaGuard,
            budget_guard_1.BudgetGuard,
            nonce_module_1.NonceModule,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map