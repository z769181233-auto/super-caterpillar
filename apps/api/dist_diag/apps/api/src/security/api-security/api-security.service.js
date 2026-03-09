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
var ApiSecurityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSecurityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_service_1 = require("../../redis/redis.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const crypto_1 = require("crypto");
const config_1 = require("@scu/config");
const audit_constants_1 = require("../../audit/audit.constants");
const secret_encryption_service_1 = require("./secret-encryption.service");
function secretFingerprint(secret) {
    const fp = (0, crypto_1.createHash)('sha256').update(secret).digest('hex').slice(0, 12);
    return { len: secret.length, sha12: fp };
}
let ApiSecurityService = ApiSecurityService_1 = class ApiSecurityService {
    prisma;
    redis;
    auditLogService;
    secretEncryptionService;
    TIMESTAMP_WINDOW_SECONDS = 300;
    NONCE_TTL_SECONDS = 300;
    logger = new common_1.Logger(ApiSecurityService_1.name);
    constructor(prisma, redis, auditLogService, secretEncryptionService) {
        this.prisma = prisma;
        this.redis = redis;
        this.auditLogService = auditLogService;
        this.secretEncryptionService = secretEncryptionService;
    }
    async verifySignature(context) {
        const { apiKey, nonce, timestamp, signature, method, path, contentSha256, ip, userAgent } = context;
        const dbg = process.env.HMAC_DEBUG === '1';
        const dlog = (obj) => {
            if (!dbg)
                return;
            try {
                console.log(JSON.stringify({ tag: 'HMAC_DEBUG_STEP', ...obj }));
            }
            catch {
            }
        };
        dlog({
            step: 'enter',
            path,
            method,
            ip,
            xApiKey: apiKey ? apiKey.slice(0, 12) + '...' : undefined,
            xTimestamp: timestamp,
            xNonce: nonce ? nonce.slice(0, 20) + '...' : undefined,
            xSigLen: signature ? signature.length : 0,
            xSigPrefix: signature ? signature.slice(0, 12) : undefined,
            contentSha256: contentSha256 || 'undefined',
        });
        try {
            if (!/^\d{10}$/.test(timestamp)) {
                dlog({ step: 'reject', reason: 'timestamp_format_error', timestamp });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'TIMESTAMP_FORMAT_ERROR',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: 'timestamp_must_be_seconds',
                };
            }
            const timestampNum = parseInt(timestamp, 10);
            dlog({ step: 'db_lookup_api_key_start', apiKey: apiKey.slice(0, 12) + '...' });
            this.logger.log(`[API_SEC_DEBUG] verifySignature: Searching for apiKey. this.prisma: ${!!this.prisma}`);
            if (!this.prisma?.apiKey) {
                this.logger.error(`[API_SEC_DEBUG] CRITICAL: this.prisma.apiKey is undefined! Keys: ${Object.keys(this.prisma || {})}`);
                throw new Error('Prisma Client Malformed: apiKey model missing');
            }
            const keyRecord = await this.prisma.apiKey.findUnique({
                where: { key: apiKey },
                include: {
                    ownerUser: true,
                    ownerOrg: true,
                },
            });
            if (!keyRecord) {
                dlog({ step: 'reject', reason: 'invalid_api_key', apiKey: apiKey.slice(0, 12) + '...' });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'INVALID_API_KEY',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: '无效的 API Key',
                };
            }
            if (keyRecord.status !== 'ACTIVE') {
                dlog({ step: 'reject', reason: 'api_key_disabled', status: keyRecord.status });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'API_KEY_DISABLED',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: 'API Key 已被禁用',
                };
            }
            if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
                dlog({ step: 'reject', reason: 'api_key_expired', expiresAt: keyRecord.expiresAt });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'API_KEY_EXPIRED',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: 'API Key 已过期',
                };
            }
            dlog({ step: 'timestamp_check_start' });
            const nowSec = Math.floor(Date.now() / 1000);
            const timeDiff = Math.abs(nowSec - timestampNum);
            if (timeDiff > this.TIMESTAMP_WINDOW_SECONDS) {
                dlog({
                    step: 'reject',
                    reason: 'timestamp_out_of_window',
                    timeDiff,
                    window: this.TIMESTAMP_WINDOW_SECONDS,
                });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'TIMESTAMP_OUT_OF_WINDOW',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: `时间戳超出允许范围（±${this.TIMESTAMP_WINDOW_SECONDS}秒）`,
                };
            }
            dlog({ step: 'timestamp_check_pass', timeDiff });
            dlog({ step: 'nonce_check_start' });
            const nonceKey = `api_security:nonce:${apiKey}:${nonce}`;
            const nonceExists = await this.redis.get(nonceKey);
            if (nonceExists) {
                dlog({ step: 'reject', reason: 'nonce_replay' });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'NONCE_REPLAY',
                    errorCode: '4004',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4004',
                    errorMessage: 'Nonce 已被使用，请重新生成请求',
                };
            }
            await this.redis.set(nonceKey, timestamp, this.NONCE_TTL_SECONDS);
            let secret = '';
            let secretSource = 'none';
            try {
                secret = await this.resolveSecretForApiKey(keyRecord, apiKey, ip, userAgent);
                secretSource = 'db_per_key';
            }
            catch (e) {
                secret = '';
            }
            if (!secret || secret.length === 0) {
                secret = (0, config_1.pickHmacSecretSSOT)();
                secretSource = 'SSOT';
            }
            if (dbg) {
                const fp = secretFingerprint(secret || '');
                dlog({
                    step: 'secret_pick',
                    source: secretSource,
                    secretLen: fp.len,
                    secretSha12: fp.sha12,
                });
            }
            if (!secret || secret.length === 0) {
                dlog({ step: 'reject', reason: 'secret_not_found' });
                return { success: false, errorCode: '500', errorMessage: 'secret_not_found' };
            }
            let bodyToSign = context.body || '';
            if (['GET', 'DELETE'].includes(method.toUpperCase())) {
                if (bodyToSign === '{}') {
                    bodyToSign = '';
                }
            }
            const canonicalString = this.buildCanonicalStringV2(method, path, apiKey, timestamp, nonce, bodyToSign, contentSha256);
            if (dbg) {
                const cfp = secretFingerprint(canonicalString);
                const bodyFp = secretFingerprint(bodyToSign);
                dlog({
                    step: 'canonical',
                    canonicalLen: cfp.len,
                    canonicalSha12: cfp.sha12,
                    bodyLen: bodyFp.len,
                    bodySha12: bodyFp.sha12,
                });
            }
            const expectedSignature = this.computeSignature(secret, canonicalString);
            const isHex = (s) => typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
            if (!isHex(signature) || !isHex(expectedSignature)) {
                dlog({
                    step: 'reject',
                    reason: 'signature_format_error',
                    sigIsHex: isHex(signature),
                    expectedIsHex: isHex(expectedSignature),
                });
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'SIGNATURE_FORMAT_ERROR',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: 'invalid_signature',
                };
            }
            const signatureBuffer = Buffer.from(signature, 'hex');
            const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
            const valid = signatureBuffer.length === expectedSignatureBuffer.length &&
                signatureBuffer.length === 32 &&
                (0, crypto_1.timingSafeEqual)(signatureBuffer, expectedSignatureBuffer);
            dlog({
                step: 'compare',
                receivedPrefix: signature.slice(0, 12),
                computedPrefix: expectedSignature.slice(0, 12),
                match: valid,
            });
            if (!valid) {
                dlog({ step: 'reject', reason: 'signature_mismatch' });
                this.logger.error(`[HMAC_DEBUG] Signature Mismatch! Method: ${method}, Path: ${path}, apiKey: ${this.maskApiKey(apiKey)}`);
                await this.writeAuditLog({
                    nonce,
                    signature,
                    timestamp,
                    path,
                    method,
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'SIGNATURE_MISMATCH',
                    errorCode: '4003',
                }, ip, userAgent);
                return {
                    success: false,
                    errorCode: '4003',
                    errorMessage: 'invalid_signature',
                };
            }
            await this.prisma.apiKey
                .update({
                where: { id: keyRecord.id },
                data: { lastUsedAt: new Date() },
            })
                .catch((e) => {
                if (dbg)
                    dlog({ step: 'db_update_lastUsedAt_failed', error: e?.message });
            });
            await this.writeAuditLog({
                nonce,
                signature,
                timestamp,
                path,
                method,
                apiKey: this.maskApiKey(apiKey),
                reason: 'SIGNATURE_VERIFIED',
            }, ip, userAgent, keyRecord.id);
            if (dbg)
                dlog({ step: 'exit_success' });
            return {
                success: true,
                apiKeyId: keyRecord.id,
                apiKey: apiKey,
                apiKeyRecord: keyRecord,
            };
        }
        catch (error) {
            const err = error;
            await this.writeAuditLog({
                nonce,
                signature,
                timestamp,
                path,
                method,
                apiKey: this.maskApiKey(apiKey),
                reason: 'VERIFICATION_ERROR',
                errorCode: '500',
            }, ip, userAgent);
            return {
                success: false,
                errorCode: '500',
                errorMessage: err?.message || '签名验证异常',
            };
        }
    }
    buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, body, contentSha256) {
        if (method === 'POST' && body === '' && contentSha256) {
            if (process.env.HMAC_DEBUG === '1')
                console.log('[HMAC_DEBUG] Using ContentHash strategy');
            return `${apiKey}${nonce}${timestamp}${contentSha256}`;
        }
        if (process.env.HMAC_DEBUG === '1')
            console.log(`[HMAC_DEBUG] Using Body strategy. Method=${method}, BodyLen=${body.length}, HasContentSha256=${!!contentSha256}`);
        const result = `${apiKey}${nonce}${timestamp}${body}`;
        return result;
    }
    sha256Hex(data) {
        const hash = (0, crypto_1.createHash)('sha256');
        if (Buffer.isBuffer(data)) {
            hash.update(data);
        }
        else {
            hash.update(data, 'utf8');
        }
        return hash.digest('hex');
    }
    buildCanonicalString(apiKey, nonce, timestamp, body) {
        const normalizedBody = body || '';
        return `${apiKey}${nonce}${timestamp}${normalizedBody}`;
    }
    computeSignature(secret, message) {
        const hmac = (0, crypto_1.createHmac)('sha256', secret);
        hmac.update(message, 'utf8');
        return hmac.digest('hex');
    }
    async resolveSecretForApiKey(keyRecord, apiKey, ip, userAgent) {
        if (keyRecord.secretEnc && keyRecord.secretEncIv && keyRecord.secretEncTag) {
            if (this.secretEncryptionService.isMasterKeyConfigured()) {
                try {
                    const secret = this.secretEncryptionService.decryptSecret(keyRecord.secretEnc, keyRecord.secretEncIv, keyRecord.secretEncTag);
                    return secret;
                }
                catch (error) {
                    const err = error;
                    this.logger.error(`Failed to decrypt secret for API Key ${this.maskApiKey(apiKey)}: ${err.message}`);
                }
            }
        }
        if (keyRecord.secretHash) {
            const isProduction = process.env.NODE_ENV === 'production';
            const isMasterKeyConfigured = this.secretEncryptionService.isMasterKeyConfigured();
            if (isProduction && isMasterKeyConfigured) {
                await this.writeAuditLog({
                    nonce: '',
                    signature: '',
                    timestamp: new Date().toISOString(),
                    path: '',
                    method: '',
                    apiKey: this.maskApiKey(apiKey),
                    reason: 'INSECURE_SECRET_STORAGE',
                    errorCode: '500',
                }, ip, userAgent, keyRecord.id);
                throw new common_1.InternalServerErrorException(`API Key ${this.maskApiKey(apiKey)} uses insecure secret storage (secretHash). ` +
                    `Production environment requires encrypted storage.`);
            }
            else {
                this.logger.warn(`API Key ${this.maskApiKey(apiKey)} using secretHash fallback (isMasterKeyConfigured=${isMasterKeyConfigured})`);
                return keyRecord.secretHash;
            }
        }
        await this.writeAuditLog({
            nonce: '',
            signature: '',
            timestamp: new Date().toISOString(),
            path: '',
            method: '',
            apiKey: this.maskApiKey(apiKey),
            reason: 'SECRET_NOT_FOUND',
            errorCode: '500',
        }, ip, userAgent, keyRecord.id);
        throw new common_1.InternalServerErrorException(`API Key ${this.maskApiKey(apiKey)} has no secret stored (neither encrypted nor hash).`);
    }
    maskApiKey(apiKey) {
        if (!apiKey || apiKey.length <= 8) {
            return '****';
        }
        return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    }
    async writeAuditLog(details, ip, userAgent, apiKeyId) {
        try {
            await this.auditLogService.record({
                apiKeyId,
                action: audit_constants_1.AuditActions.SECURITY_EVENT,
                resourceType: 'api_security',
                resourceId: details.apiKey || undefined,
                ip,
                userAgent,
                nonce: details.nonce,
                signature: details.signature,
                timestamp: /^\d{10}$/.test(details.timestamp)
                    ? new Date(parseInt(details.timestamp, 10) * 1000)
                    : undefined,
                details: {
                    reason: details.reason,
                    path: details.path,
                    method: details.method,
                    errorCode: details.errorCode,
                    incomingNonce: details.nonce,
                    incomingSignature: details.signature,
                    incomingTimestamp: details.timestamp,
                },
            });
        }
        catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to write audit log (non-blocking): ${errMessage.slice(0, 300)}`);
        }
    }
};
exports.ApiSecurityService = ApiSecurityService;
exports.ApiSecurityService = ApiSecurityService = ApiSecurityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(redis_service_1.RedisService)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => audit_log_service_1.AuditLogService))),
    __param(3, (0, common_1.Inject)(secret_encryption_service_1.SecretEncryptionService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        audit_log_service_1.AuditLogService,
        secret_encryption_service_1.SecretEncryptionService])
], ApiSecurityService);
//# sourceMappingURL=api-security.service.js.map