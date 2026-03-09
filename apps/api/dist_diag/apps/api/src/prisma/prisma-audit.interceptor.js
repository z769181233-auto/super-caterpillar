"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PrismaQueryRawAuditInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaQueryRawAuditInterceptor = void 0;
exports.auditQueryRaw = auditQueryRaw;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let PrismaQueryRawAuditInterceptor = PrismaQueryRawAuditInterceptor_1 = class PrismaQueryRawAuditInterceptor {
    logger = new common_1.Logger(PrismaQueryRawAuditInterceptor_1.name);
    isProduction = process.env.NODE_ENV === 'production';
    intercept(context, next) {
        if (!this.isProduction) {
            return next.handle();
        }
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const path = request.path;
        return next.handle().pipe((0, operators_1.tap)(() => {
            this.logger.warn(`[PrismaAudit] Potential $queryRaw usage detected at ${method} ${path}. ` +
                `Please ensure no SQL string concatenation is used.`);
        }));
    }
};
exports.PrismaQueryRawAuditInterceptor = PrismaQueryRawAuditInterceptor;
exports.PrismaQueryRawAuditInterceptor = PrismaQueryRawAuditInterceptor = PrismaQueryRawAuditInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], PrismaQueryRawAuditInterceptor);
function auditQueryRaw(sql, params) {
    const isProduction = process.env.NODE_ENV === 'production';
    const logger = new common_1.Logger('PrismaQueryRawAudit');
    if (isProduction) {
        if (sql.includes('${') || sql.includes('${') || sql.includes('+')) {
            logger.error(`[SECURITY] Detected potential SQL injection risk: string concatenation in $queryRaw. ` +
                `SQL: ${sql.substring(0, 100)}...`);
            throw new Error('SQL string concatenation is forbidden in production. Use Prisma template literals instead.');
        }
    }
}
//# sourceMappingURL=prisma-audit.interceptor.js.map