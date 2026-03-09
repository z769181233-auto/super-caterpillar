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
var AuditLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
let AuditLogService = AuditLogService_1 = class AuditLogService {
    prisma;
    logger = new common_1.Logger(AuditLogService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(options) {
        try {
            const { req } = options;
            const reqNonce = options.nonce || req?.headers['x-nonce'] || req?.headers['x-hmac-nonce'] || req?.hmacNonce;
            const reqSignature = options.signature ||
                req?.headers['x-signature'] ||
                req?.headers['x-hmac-signature'] ||
                req?.hmacSignature;
            const reqTimestampStr = req?.headers['x-timestamp'] || req?.headers['x-hmac-timestamp'] || req?.hmacTimestamp;
            const reqTimestamp = options.timestamp || (reqTimestampStr ? new Date(reqTimestampStr) : undefined);
            const ip = options.ip || req?.ip || req?.headers['x-forwarded-for'];
            const userAgent = options.userAgent || req?.headers['user-agent'];
            const traceId = options.traceId || `trace-${(0, crypto_1.randomBytes)(8).toString('hex')}`;
            const serverTimestamp = new Date();
            const serverNonce = (0, crypto_1.randomBytes)(16).toString('hex');
            const details = options.details ? { ...options.details } : {};
            details._traceId = traceId;
            let detailsStr = '';
            try {
                detailsStr = JSON.stringify(details);
            }
            catch (e) {
                detailsStr = '[UNSERIALIZABLE]';
            }
            const detailsDigest = (0, crypto_1.createHash)('sha256').update(detailsStr).digest('hex');
            const signBase = [
                options.action,
                options.resourceType,
                options.resourceId || '',
                serverTimestamp.toISOString(),
                serverNonce,
                detailsDigest,
                traceId,
            ].join('|');
            const secret = process.env.AUDIT_SIGNING_SECRET;
            const recordSignature = (0, crypto_1.createHmac)('sha256', secret || 'EMERGENCY_UNSECURE_FALLBACK_SUPER_CATERPILLAR')
                .update(signBase)
                .digest('hex');
            const payload = {
                action: options.action,
                resourceType: options.resourceType,
                resourceId: options.resourceId ?? null,
                orgId: options.orgId ?? null,
                ip: ip ?? null,
                userAgent: userAgent ?? null,
                nonce: reqNonce || serverNonce,
                signature: reqSignature || recordSignature,
                timestamp: (reqTimestamp || serverTimestamp).toISOString(),
                details,
                traceId,
                auditKeyVersion: 'v1',
            };
            await this.prisma.auditLog.create({
                data: {
                    userId: options.userId,
                    orgId: options.orgId,
                    apiKeyId: options.apiKeyId,
                    action: options.action,
                    resourceType: options.resourceType,
                    resourceId: options.resourceId,
                    ip: ip,
                    userAgent: userAgent,
                    details: details,
                    nonce: reqNonce || serverNonce,
                    signature: reqSignature || recordSignature,
                    timestamp: reqTimestamp || serverTimestamp,
                    payload: payload,
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to record audit log: ${options.action} for ${options.resourceType}:${options.resourceId}`, error?.stack);
        }
    }
    static extractRequestInfo(request) {
        return {
            ip: request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress,
            userAgent: request.headers['user-agent'],
        };
    }
};
exports.AuditLogService = AuditLogService;
exports.AuditLogService = AuditLogService = AuditLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogService);
//# sourceMappingURL=audit-log.service.js.map