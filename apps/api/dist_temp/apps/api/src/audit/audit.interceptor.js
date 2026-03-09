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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const audit_decorator_1 = require("./audit.decorator");
const audit_service_1 = require("./audit.service");
let AuditInterceptor = class AuditInterceptor {
    reflector;
    auditService;
    constructor(reflector, auditService) {
        this.reflector = reflector;
        this.auditService = auditService;
    }
    intercept(context, next) {
        try {
            if (context.getType() === 'http') {
                const req = context.switchToHttp().getRequest();
                if (req.method === 'OPTIONS')
                    return next.handle();
            }
            const handler = context.getHandler();
            const cls = context.getClass();
            if (!handler || !cls)
                return next.handle();
            const action = this.reflector.getAllAndOverride(audit_decorator_1.AUDIT_ACTION_KEY, [handler, cls]);
            if (!action) {
                return next.handle();
            }
            const request = context.switchToHttp().getRequest();
            const user = request.user;
            const traceId = request.traceId || request.headers['x-trace-id'] || `${Date.now()}-${Math.random()}`;
            const ip = request.ip || request.headers['x-forwarded-for'];
            const ua = request.headers['user-agent'];
            return next.handle().pipe((0, operators_1.tap)(async () => {
                await this.auditService.log({
                    userId: user?.userId,
                    organizationId: user?.organizationId,
                    action,
                    resourceType: request?.route?.path || request.url || 'unknown',
                    resourceId: request.params?.id || request.params?.projectId || null,
                    traceId: traceId.toString(),
                    ip: typeof ip === 'string' ? ip : Array.isArray(ip) ? ip[0] : undefined,
                    userAgent: typeof ua === 'string' ? ua : undefined,
                    details: {
                        method: request.method,
                        path: request.url,
                    },
                });
            }));
        }
        catch (e) {
            return next.handle();
        }
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        audit_service_1.AuditService])
], AuditInterceptor);
//# sourceMappingURL=audit.interceptor.js.map