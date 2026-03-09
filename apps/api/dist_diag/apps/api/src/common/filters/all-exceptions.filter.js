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
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const capacity_errors_1 = require("../errors/capacity-errors");
const sensitive_data_masker_1 = require("../utils/sensitive-data-masker");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    auditLogService;
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        const isHttp = exception instanceof common_1.HttpException;
        const status = isHttp ? exception.getStatus() : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const payload = isHttp ? exception.getResponse() : { message: 'Internal server error' };
        this.logger.error(`[FILTER_DEBUG] Status: ${status}, Payload: ${JSON.stringify(payload)}`);
        const err = exception;
        const errorBody = typeof payload === 'object' ? payload : { message: payload };
        const errorCode = errorBody?.error?.code;
        if (exception instanceof capacity_errors_1.CapacityExceededException) {
            const capacityError = exception;
            return res.status(common_1.HttpStatus.TOO_MANY_REQUESTS).json({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                error: {
                    code: capacityError.errorCode,
                    message: capacity_errors_1.CapacityErrorMessages[capacityError.errorCode],
                    currentCount: capacityError.currentCount,
                    limit: capacityError.limit,
                },
            });
        }
        const isExpectedSecurityRejection = status === 401 || status === 403 || errorCode === '4003' || errorCode === '4004';
        if (isExpectedSecurityRejection) {
            const securityContext = {
                tag: 'SECURITY_REJECTION',
                method: req.method,
                path: req.originalUrl || req.url,
                status,
                code: errorCode,
                message: errorBody?.error?.message || err?.message,
                userId: req.user?.id || req.user?.userId,
                apiKeyId: req.apiKeyId,
                nonce: req.headers['x-nonce'] || req.hmac?.nonce,
                timestamp: req.headers['x-timestamp'] || req.hmac?.timestamp,
                ip: req.ip ||
                    (Array.isArray(req.headers['x-forwarded-for'])
                        ? req.headers['x-forwarded-for'][0]
                        : req.headers['x-forwarded-for']) ||
                    undefined,
                ua: req.headers['user-agent'] || undefined,
            };
            this.logger.warn(JSON.stringify(securityContext, null, 2));
            const auditAction = errorCode === '4004'
                ? 'API_NONCE_REPLAY'
                : errorCode === '4003'
                    ? 'API_SIGNATURE_ERROR'
                    : status === 403
                        ? 'API_FORBIDDEN'
                        : 'API_UNAUTHORIZED';
            this.auditLogService
                .record({
                userId: securityContext.userId,
                apiKeyId: securityContext.apiKeyId,
                action: auditAction,
                resourceType: 'api',
                resourceId: undefined,
                ip: securityContext.ip,
                userAgent: securityContext.ua,
                details: {
                    path: securityContext.path,
                    method: securityContext.method,
                    code: errorCode,
                    message: securityContext.message,
                    incomingNonce: securityContext.nonce,
                    incomingSignature: req.headers['x-signature'] || req.hmac?.signature,
                    incomingTimestamp: securityContext.timestamp,
                },
            })
                .catch((auditErr) => {
                this.logger.warn('Failed to write audit log for security rejection', auditErr);
            });
        }
        else {
            const isProduction = process.env.NODE_ENV === 'production';
            const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            if (isProduction) {
                this.logger.error(JSON.stringify({
                    tag: 'UNHANDLED_EXCEPTION',
                    errorId,
                    method: req.method,
                    url: req.originalUrl || req.url,
                    status,
                    name: err?.name,
                    message: (0, sensitive_data_masker_1.maskSensitiveString)(err?.message),
                }, null, 2));
            }
            else {
                try {
                    this.logger.error(JSON.stringify({
                        tag: 'UNHANDLED_EXCEPTION',
                        errorId,
                        method: req.method,
                        url: req.originalUrl || req.url,
                        status,
                        payload: (0, sensitive_data_masker_1.maskSensitiveData)(payload),
                        name: err?.name,
                        message: (0, sensitive_data_masker_1.maskSensitiveString)(err?.message),
                        stack: err?.stack,
                    }, null, 2));
                }
                catch (logErr) {
                    this.logger.error(`[FILTER_LOG_FAIL] Failed to stringify error: ${logErr}. Raw error: ${err}`);
                }
            }
        }
        res
            .status(status)
            .json(typeof payload === 'string' ? { statusCode: status, message: payload } : payload);
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)(),
    __param(0, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map