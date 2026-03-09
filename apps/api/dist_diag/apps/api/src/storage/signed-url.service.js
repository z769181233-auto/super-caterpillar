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
var SignedUrlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedUrlService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const config_1 = require("@scu/config");
let SignedUrlService = SignedUrlService_1 = class SignedUrlService {
    logger = new common_1.Logger(SignedUrlService_1.name);
    secret;
    defaultExpiresIn;
    baseUrl;
    constructor() {
        this.secret =
            process.env.STORAGE_SIGNED_URL_SECRET ||
                config_1.env.jwtSecret ||
                'default-secret-change-in-production';
        this.defaultExpiresIn = parseInt(process.env.STORAGE_SIGNED_URL_TTL || '3600', 10);
        this.baseUrl = process.env.STORAGE_BASE_URL || config_1.env.apiUrl || 'http://localhost:3000';
        if (this.secret === 'default-secret-change-in-production') {
            this.logger.warn('[SignedUrlService] Using default secret! Change STORAGE_SIGNED_URL_SECRET in production!');
        }
    }
    generateSignedUrl(options) {
        const { key, tenantId, userId, expiresIn = this.defaultExpiresIn, method = 'GET' } = options;
        if (key.includes('..') || key.startsWith('/')) {
            throw new Error(`Invalid storage key: ${key}`);
        }
        if (!tenantId || !userId) {
            throw new Error('tenantId and userId are required for signed URL generation');
        }
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        const expires = Math.floor(expiresAt.getTime() / 1000);
        const signString = `${method}:${key}:${tenantId}:${userId}:${expires}`;
        const signature = (0, crypto_1.createHmac)('sha256', this.secret).update(signString).digest('hex');
        const safePathKey = this.encodeKeyAsPath(key);
        if (process.env.NODE_ENV !== 'production') {
            this.logger.log(`[SignedUrlService] key=${key} safePathKey=${safePathKey}`);
        }
        const url = `${this.baseUrl}/api/storage/signed/${safePathKey}?expires=${expires}&tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&signature=${signature}`;
        return {
            url,
            expiresAt,
            signature,
        };
    }
    verifySignedUrl(key, expires, signature, tenantId, userId, method = 'GET') {
        try {
            const now = Math.floor(Date.now() / 1000);
            if (expires < now) {
                this.logger.warn(`[SignedUrlService] Signed URL expired: key=${key}, expires=${expires}, now=${now}`);
                return false;
            }
            if (key.includes('..') || key.startsWith('/')) {
                this.logger.warn(`[SignedUrlService] Invalid key in signed URL: ${key}`);
                return false;
            }
            const signString = `${method}:${key}:${tenantId}:${userId}:${expires}`;
            const expectedSignature = (0, crypto_1.createHmac)('sha256', this.secret).update(signString).digest('hex');
            if (signature.length !== expectedSignature.length) {
                return false;
            }
            return (0, crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expectedSignature));
        }
        catch (error) {
            this.logger.error(`[SignedUrlService] Error verifying signed URL: ${error.message}`, error.stack);
            return false;
        }
    }
    generateBatchSignedUrls(keys, tenantId, userId, expiresIn) {
        return keys.map((key) => this.generateSignedUrl({ key, tenantId, userId, expiresIn }));
    }
    encodeKeyAsPath(key) {
        return key
            .split('/')
            .filter((s) => s.length > 0)
            .map((seg) => encodeURIComponent(seg))
            .join('/');
    }
};
exports.SignedUrlService = SignedUrlService;
exports.SignedUrlService = SignedUrlService = SignedUrlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SignedUrlService);
//# sourceMappingURL=signed-url.service.js.map