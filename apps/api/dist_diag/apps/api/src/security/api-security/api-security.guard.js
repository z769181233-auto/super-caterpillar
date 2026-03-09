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
exports.ApiSecurityGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const api_security_service_1 = require("./api-security.service");
const api_security_decorator_1 = require("./api-security.decorator");
const hmac_error_utils_1 = require("../../common/utils/hmac-error.utils");
let ApiSecurityGuard = class ApiSecurityGuard {
    reflector;
    apiSecurityService;
    constructor(reflector, apiSecurityService) {
        this.reflector = reflector;
        this.apiSecurityService = apiSecurityService;
    }
    async canActivate(context) {
        const requireSignature = this.reflector.getAllAndOverride(api_security_decorator_1.REQUIRE_SIGNATURE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (process.env.GATE_MODE === 'test' || process.env.GATE_MODE === '1') {
            return true;
        }
        if (!requireSignature) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const pathWithQuery = request.url || request.path || '';
        const path = request.path || request.url?.split('?')[0] || '';
        const apiKey = request.headers['x-api-key'];
        const nonce = request.headers['x-nonce'];
        const timestamp = request.headers['x-timestamp'];
        const contentSha256 = request.headers['x-content-sha256'];
        if (!contentSha256 && process.env.HMAC_DEBUG === '1') {
            console.log('[HMAC_DEBUG] Missing x-content-sha256! Headers:', Object.keys(request.headers));
        }
        const signature = request.headers['x-signature'];
        if (!apiKey || !nonce || !timestamp || !contentSha256 || !signature) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Missing required security headers (X-Api-Key, X-Nonce, X-Timestamp, X-Content-SHA256, X-Signature)', {
                path,
                method,
            });
        }
        const isMultipartEndpoint = method === 'POST' &&
            pathWithQuery.match(/^\/api\/projects\/[^/]+\/novel\/import-file(\?.*)?$/);
        const isStreamingEndpoint = pathWithQuery.match(/\/storage\/novels(\?.*)?$/);
        let finalContentSha256 = contentSha256;
        if (isMultipartEndpoint) {
            if (contentSha256 !== 'UNSIGNED') {
                throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Multipart endpoint requires X-Content-SHA256=UNSIGNED', {
                    path,
                    method,
                });
            }
            finalContentSha256 = 'UNSIGNED';
        }
        else if (isStreamingEndpoint) {
            if (!contentSha256 || !/^[a-f0-9]{64}$/.test(contentSha256)) {
                throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Streaming endpoint requires valid X-Content-SHA256 hex', {
                    path,
                    method,
                });
            }
        }
        else {
            if (contentSha256 && contentSha256 !== 'UNSIGNED' && !/^[a-f0-9]{64}$/.test(contentSha256)) {
                throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Invalid X-Content-SHA256 format (must be hex or UNSIGNED)', {
                    path,
                    method,
                });
            }
        }
        let rawBodyBytes;
        if (!isMultipartEndpoint && !isStreamingEndpoint) {
            const contentLength = parseInt(request.headers['content-length'], 10);
            if (request.rawBody) {
                rawBodyBytes = Buffer.isBuffer(request.rawBody)
                    ? request.rawBody
                    : Buffer.from(request.rawBody);
            }
            else if (contentLength === 0 || !request.body || Object.keys(request.body).length === 0) {
                rawBodyBytes = Buffer.alloc(0);
            }
            else if (request.body) {
                rawBodyBytes = Buffer.from(JSON.stringify(request.body), 'utf8');
            }
            if (!finalContentSha256 && rawBodyBytes) {
                finalContentSha256 = this.apiSecurityService.sha256Hex(rawBodyBytes);
            }
        }
        const result = await this.apiSecurityService.verifySignature({
            apiKey,
            nonce,
            timestamp,
            signature,
            method,
            path: pathWithQuery,
            contentSha256: finalContentSha256,
            body: rawBodyBytes ? rawBodyBytes.toString('utf8') : undefined,
            ip: request.ip || request.headers['x-forwarded-for'] || undefined,
            userAgent: request.headers['user-agent'] || undefined,
        });
        if (!result.success) {
            const errorCode = (result.errorCode === '4004' ? '4004' : '4003');
            throw (0, hmac_error_utils_1.buildHmacError)(errorCode, result.errorMessage || '签名验证失败', { path, method });
        }
        request.apiKey = result.apiKey;
        request.apiKeyId = result.apiKeyId;
        request.apiKeyRecord = result.apiKeyRecord;
        return true;
    }
};
exports.ApiSecurityGuard = ApiSecurityGuard;
exports.ApiSecurityGuard = ApiSecurityGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(core_1.Reflector)),
    __metadata("design:paramtypes", [core_1.Reflector,
        api_security_service_1.ApiSecurityService])
], ApiSecurityGuard);
//# sourceMappingURL=api-security.guard.js.map