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
var HmacAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HmacAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const hmac_auth_service_1 = require("./hmac-auth.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const audit_constants_1 = require("../../audit/audit.constants");
const nonce_service_1 = require("../nonce.service");
const hmac_error_utils_1 = require("../../common/utils/hmac-error.utils");
let HmacAuthGuard = HmacAuthGuard_1 = class HmacAuthGuard {
    hmacAuthService;
    auditLogService;
    nonceService;
    logger = new common_1.Logger(HmacAuthGuard_1.name);
    constructor(hmacAuthService, auditLogService, nonceService) {
        this.hmacAuthService = hmacAuthService;
        this.auditLogService = auditLogService;
        this.nonceService = nonceService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.apiKey) {
            if (process.env.NODE_ENV !== 'production') {
                this.logger.log(`[HMAC_GUARD] Skipping validation, already validated by upstream Guard`);
            }
            const upstreamRecord = request.apiKeyRecord;
            if (upstreamRecord?.ownerUser) {
                request.user = {
                    userId: upstreamRecord.ownerUser.id,
                    id: upstreamRecord.ownerUser.id,
                    email: upstreamRecord.ownerUser.email,
                    userType: upstreamRecord.ownerUser.userType || 'USER',
                    role: upstreamRecord.ownerUser.role || 'USER',
                    tier: upstreamRecord.ownerUser.tier || 'FREE',
                    organizationId: upstreamRecord.ownerOrgId,
                };
                request.authType = 'hmac';
            }
            return true;
        }
        const method = request.method;
        const path = request.originalUrl || request.url || '';
        if (process.env.HMAC_TRACE === '1') {
            this.logger.error(`[HMAC_TRACE] path_debug: ${JSON.stringify({
                originalUrl: request.originalUrl,
                url: request.url,
                path: request.path,
                baseUrl: request.baseUrl,
                route_path: request.route?.path,
                computed_path: path,
            })}`);
        }
        const apiKey = (request.headers['x-api-key'] ||
            request.headers['x-api-key'.toLowerCase()] ||
            request.headers['x-api-key']);
        const nonce = (request.headers['x-nonce'] || request.headers['x-api-nonce']);
        const timestamp = (request.headers['x-timestamp'] ||
            request.headers['x-api-timestamp']);
        const signature = (request.headers['x-signature'] ||
            request.headers['x-api-signature']);
        const hmacVersion = request.headers['x-hmac-version'];
        if (!apiKey || !signature) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', '缺少必需的认证头：X-Api-Key, X-Signature', { path, method });
        }
        const tsNum = Number(timestamp);
        this.logger.warn(`[HMAC_GUARD_WARN] Incoming timestamp: ${timestamp} (type: ${typeof timestamp}), parsed: ${tsNum}`);
        if (!timestamp || isNaN(tsNum)) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Invalid or missing X-Timestamp', { path, method });
        }
        if (tsNum > 10000000000) {
            this.logger.error(`[HMAC_GUARD_REJECT] REJECTING MS TIMESTAMP: ${tsNum} > 10000000000`);
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'timestamp_must_be_seconds', { path, method });
        }
        const hasNonceInfo = !!(nonce && timestamp);
        if (hasNonceInfo) {
            try {
                await this.nonceService.assertAndStoreNonce(nonce, apiKey, Number(timestamp), {
                    path,
                    method,
                    ip: request.ip,
                    ua: request.headers['user-agent'],
                });
            }
            catch (error) {
                if (error?.message?.includes('REPLAY') || error?.message?.includes('replay')) {
                    throw (0, hmac_error_utils_1.buildHmacError)('4004', 'NONCE_REPLAY: Nonce replay detected', { path, method });
                }
                throw error;
            }
        }
        const isEngineInvoke = path.includes('/_internal/engine/invoke');
        const contentLength = Number(request.headers['content-length'] || 0);
        let bodyString = '';
        if (isEngineInvoke && contentLength > 1024 * 1024) {
            bodyString = `__MASSIVE_BODY_BYPASS__:${contentLength}`;
            request.__isMassiveBody = true;
        }
        else if (request.rawBody) {
            bodyString = Buffer.isBuffer(request.rawBody)
                ? request.rawBody.toString('utf8')
                : String(request.rawBody);
        }
        else {
            const hasBodyObject = request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0;
            bodyString =
                typeof request.body === 'string'
                    ? request.body
                    : hasBodyObject
                        ? JSON.stringify(request.body)
                        : '';
        }
        if (process.env.HMAC_TRACE === '1') {
            this.logger.error(`[HMAC_TRACE] guard_enter: ${JSON.stringify({
                path: request.originalUrl ?? request.url,
                method: request.method,
                hasSig: !!request.headers['x-signature'],
                hasV: !!request.headers['x-hmac-version'],
                hasWorker: !!request.headers['x-worker-id'],
            })}`);
        }
        if (process.env.NODE_ENV !== 'production') {
            this.logger.log(`[HMAC DEBUG]: ${JSON.stringify({
                method,
                path,
                headers: {
                    'x-api-key': apiKey,
                    'x-nonce': nonce,
                    'x-timestamp': timestamp,
                    'x-signature': signature,
                },
                bodyString,
            })}`);
        }
        try {
            const keyRecord = await this.hmacAuthService.verifySignature(apiKey, method, path, bodyString, nonce, timestamp, signature, {
                ip: request.ip || request.headers['x-forwarded-for'],
                ua: request.headers['user-agent'],
                workerId: request.headers['x-worker-id'],
                contentSha256: request.headers['x-content-sha256'],
                hmacVersion: request.headers['x-hmac-version'],
            });
            this.logger.log(`[HMAC_AUTH] ApiKey ownerOrgId: ${keyRecord.ownerOrgId}, ownerUserId: ${keyRecord.ownerUserId}`);
            request.apiKey = keyRecord;
            request.apiKeyId = keyRecord.id;
            request.apiKeyOwnerUserId = keyRecord.ownerUserId;
            request.apiKeyOwnerOrgId = keyRecord.ownerOrgId;
            request.hmacNonce = nonce;
            request.hmacTimestamp = timestamp;
            request.hmacSignature = signature;
            request.hmac = {
                apiKey,
                nonce,
                timestamp,
                signature,
            };
            request.authType = 'hmac';
            if (keyRecord.ownerUser) {
                request.user = {
                    userId: keyRecord.ownerUser.id,
                    id: keyRecord.ownerUser.id,
                    email: keyRecord.ownerUser.email,
                    userType: keyRecord.ownerUser.userType || 'USER',
                    role: keyRecord.ownerUser.role || 'USER',
                    tier: keyRecord.ownerUser.tier || 'FREE',
                    organizationId: keyRecord.ownerOrgId,
                };
                this.logger.log(`[HMAC_AUTH] Resolved user: ${keyRecord.ownerUser.id}, org: ${keyRecord.ownerOrgId}`);
            }
            else {
                request.user = null;
                request.authHasUser = false;
            }
            if (process.env.NODE_ENV !== 'production') {
                this.logger.log(`[SMOKE_KEY_RESOLVE]: ${JSON.stringify({
                    apiKeyKey: keyRecord.key,
                    apiKeyId: keyRecord.id,
                    ownerUserId: keyRecord.ownerUserId,
                    ownerOrgId: keyRecord.ownerOrgId,
                })}`);
                this.logger.log(`[HMAC_GUARD_USER] request.user: ${JSON.stringify(request.user)}`);
            }
            return true;
        }
        catch (error) {
            const requestInfo = audit_log_service_1.AuditLogService.extractRequestInfo(request);
            await this.auditLogService
                .record({
                apiKeyId: undefined,
                action: audit_constants_1.AuditActions.SECURITY_EVENT,
                resourceType: 'api_security',
                resourceId: apiKey,
                ip: requestInfo.ip,
                userAgent: requestInfo.userAgent,
                details: {
                    reason: 'HMAC_AUTH_FAILED',
                    path,
                    method,
                    message: error?.response?.error?.message || error?.message,
                    code: error?.response?.error?.code || '4003',
                    incomingNonce: nonce,
                    incomingSignature: signature,
                },
                traceId: request.traceId,
            })
                .catch(() => undefined);
            throw error;
        }
    }
};
exports.HmacAuthGuard = HmacAuthGuard;
exports.HmacAuthGuard = HmacAuthGuard = HmacAuthGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => hmac_auth_service_1.HmacAuthService))),
    __param(1, (0, common_1.Inject)(audit_log_service_1.AuditLogService)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => nonce_service_1.NonceService))),
    __metadata("design:paramtypes", [hmac_auth_service_1.HmacAuthService,
        audit_log_service_1.AuditLogService,
        nonce_service_1.NonceService])
], HmacAuthGuard);
//# sourceMappingURL=hmac-auth.guard.js.map