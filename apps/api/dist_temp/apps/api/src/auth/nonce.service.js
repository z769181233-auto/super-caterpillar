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
var NonceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const audit_constants_1 = require("../audit/audit.constants");
const hmac_error_utils_1 = require("../common/utils/hmac-error.utils");
const crypto_1 = require("crypto");
const redis_service_1 = require("../redis/redis.service");
let NonceService = NonceService_1 = class NonceService {
    prisma;
    auditService;
    redisService;
    logger = new common_1.Logger(NonceService_1.name);
    devMemoryStore = new Map();
    isDev = process.env.NODE_ENV !== 'production';
    constructor(prisma, auditService, redisService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.redisService = redisService;
    }
    async assertAndStoreNonce(nonce, apiKey, timestamp, requestInfo) {
        if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
            throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Invalid timestamp provided', {
                path: requestInfo?.path,
                method: requestInfo?.method,
            });
        }
        if (process.env.NODE_ENV !== 'production') {
            this.logger.log(`准备写入 nonce: ${JSON.stringify({
                apiKey: apiKey.substring(0, 8) + '...',
                nonce: nonce.substring(0, 16) + '...',
                timestamp,
                path: requestInfo?.path,
                method: requestInfo?.method,
            })}`);
        }
        try {
            if ('nonceStore' in this.prisma) {
                await this.prisma.nonceStore.create({
                    data: {
                        nonce,
                        apiKey,
                        timestamp: BigInt(timestamp),
                    },
                });
            }
            else {
                if (process.env.NODE_ENV !== 'production') {
                    this.logger.warn('⚠️  使用 $queryRaw fallback（prisma.nonceStore 不可用）');
                }
                const existing = await this.prisma.$queryRaw `
          SELECT COUNT(*)::bigint as count
          FROM nonce_store
          WHERE nonce = ${nonce} AND "apiKey" = ${apiKey}
        `;
                if (existing && existing.length > 0 && Number(existing[0].count) > 0) {
                    throw {
                        code: 'P2002',
                        message: 'Unique constraint failed',
                        meta: { target: ['nonce', 'apiKey'] },
                    };
                }
                await this.prisma.$queryRaw `
          INSERT INTO nonce_store (id, nonce, "apiKey", timestamp)
          VALUES (gen_random_uuid()::text, ${nonce}, ${apiKey}, ${BigInt(timestamp)})
        `;
            }
            if (process.env.NODE_ENV !== 'production') {
                this.logger.log(`✅ nonce stored ok (使用 prisma.nonceStore): ${JSON.stringify({
                    nonce: nonce.substring(0, 16) + '...',
                    apiKey: apiKey.substring(0, 8) + '...',
                })}`);
            }
        }
        catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                this.logger.error(`nonce 写入失败: ${JSON.stringify({
                    error: err.message,
                    code: err.code,
                    meta: err.meta,
                    nonce: nonce.substring(0, 16) + '...',
                    apiKey: apiKey.substring(0, 8) + '...',
                })}`);
            }
            const isUniqueConstraintError = err.code === 'P2002';
            if (isUniqueConstraintError) {
                const traceId = (0, crypto_1.randomUUID)();
                await this.auditService
                    .log({
                    action: audit_constants_1.AuditActions.SECURITY_EVENT,
                    resourceType: 'api_key',
                    resourceId: apiKey,
                    traceId,
                    ip: requestInfo?.ip || null,
                    userAgent: requestInfo?.ua || null,
                    details: {
                        reason: 'NONCE_REPLAY_DETECTED',
                        nonce,
                        timestamp,
                        path: requestInfo?.path,
                        method: requestInfo?.method,
                    },
                })
                    .catch(() => {
                });
                throw (0, hmac_error_utils_1.buildHmacError)('4004', 'Nonce replay detected', {
                    path: requestInfo?.path,
                    method: requestInfo?.method,
                });
            }
            else {
                if (process.env.NODE_ENV !== 'production') {
                    this.logger.error(`非唯一约束错误 - 详细诊断信息: ${JSON.stringify({
                        errorName: err?.name,
                        errorMessage: err?.message,
                        errorCode: err?.code,
                        errorMeta: err?.meta,
                        isPrismaClientKnownRequestError: err?.constructor?.name === 'PrismaClientKnownRequestError' ||
                            err?.name === 'PrismaClientKnownRequestError',
                        prismaServiceConstructor: this.prisma?.constructor?.name,
                        prismaServiceKeys: Object.keys(this.prisma || {}).slice(0, 50),
                        hasNonceStore: 'nonceStore' in (this.prisma || {}),
                        hasNonceStoreCapital: 'NonceStore' in (this.prisma || {}),
                        databaseUrl: this.getDatabaseUrlSafe(),
                    })}`);
                }
                throw (0, hmac_error_utils_1.buildHmacError)('4003', 'Nonce storage failed', {
                    path: requestInfo?.path,
                    method: requestInfo?.method,
                });
            }
        }
    }
    getDatabaseUrlSafe() {
        try {
            const url = process.env.DATABASE_URL || '';
            if (!url)
                return 'DATABASE_URL_NOT_SET';
            try {
                const urlObj = new URL(url);
                return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || '5432'}/${urlObj.pathname.split('/').pop() || ''}`;
            }
            catch {
                return url.substring(0, 50) + '...';
            }
        }
        catch {
            return 'DATABASE_URL_PARSE_ERROR';
        }
    }
};
exports.NonceService = NonceService;
exports.NonceService = NonceService = NonceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __param(1, (0, common_1.Inject)(audit_service_1.AuditService)),
    __param(2, (0, common_1.Inject)(redis_service_1.RedisService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        redis_service_1.RedisService])
], NonceService);
//# sourceMappingURL=nonce.service.js.map