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
exports.TimestampNonceGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const nonce_service_1 = require("../nonce.service");
const signature_path_utils_1 = require("../../common/utils/signature-path.utils");
const hmac_error_utils_1 = require("../../common/utils/hmac-error.utils");
let TimestampNonceGuard = class TimestampNonceGuard {
    nonceService;
    reflector;
    WINDOW_SECONDS = 300;
    constructor(nonceService, reflector) {
        this.nonceService = nonceService;
        this.reflector = reflector;
    }
    getPath(req) {
        const raw = (req.originalUrl || req.url || '');
        return raw.split('?')[0];
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.method === 'OPTIONS') {
            return true;
        }
        const path = this.getPath(request);
        if ((0, signature_path_utils_1.shouldBypassSignature)(path)) {
            return true;
        }
        if (!(0, signature_path_utils_1.shouldRequireSignature)(path)) {
            return true;
        }
        const hmac = request.hmac || {
            apiKey: (request.headers['x-api-key'] || request.headers['x-api-signature']),
            nonce: (request.headers['x-nonce'] || request.headers['x-api-nonce']),
            timestamp: (request.headers['x-timestamp'] || request.headers['x-api-timestamp']),
        };
        const timestampStr = hmac.timestamp;
        const nonce = hmac.nonce;
        const apiKey = hmac.apiKey;
        if (!timestampStr || !nonce || !apiKey) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Invalid HMAC headers', {
                path: request.path || request.url,
                method: request.method,
            });
        }
        const ts = Number(timestampStr);
        if (Number.isNaN(ts)) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Invalid timestamp', {
                path: request.path || request.url,
                method: request.method,
            });
        }
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - ts) > this.WINDOW_SECONDS) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Timestamp out of window', {
                path: request.path || request.url,
                method: request.method,
            });
        }
        await this.nonceService.assertAndStoreNonce(nonce, apiKey, ts, {
            path: request.path || request.url,
            method: request.method,
            ip: request.ip || request.headers['x-forwarded-for'] || undefined,
            ua: request.headers['user-agent'] || undefined,
        });
        return true;
    }
};
exports.TimestampNonceGuard = TimestampNonceGuard;
exports.TimestampNonceGuard = TimestampNonceGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nonce_service_1.NonceService,
        core_1.Reflector])
], TimestampNonceGuard);
//# sourceMappingURL=timestamp-nonce.guard.js.map