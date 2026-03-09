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
var ApiKeyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto_1 = require("crypto");
const secret_encryption_service_1 = require("../../security/api-security/secret-encryption.service");
let ApiKeyService = ApiKeyService_1 = class ApiKeyService {
    prisma;
    secretEncryptionService;
    logger = new common_1.Logger(ApiKeyService_1.name);
    constructor(prisma, secretEncryptionService) {
        this.prisma = prisma;
        this.secretEncryptionService = secretEncryptionService;
    }
    generateApiKey() {
        const keyId = `ak_${(0, crypto_1.randomBytes)(16).toString('hex')}`;
        const secret = (0, crypto_1.randomBytes)(32).toString('hex');
        return { key: keyId, secret };
    }
    async createApiKey(userId, orgId, name) {
        const { key, secret } = this.generateApiKey();
        let secretEnc;
        let secretEncIv;
        let secretEncTag;
        let secretVersion;
        let secretHash;
        try {
            if (this.secretEncryptionService.isMasterKeyConfigured()) {
                const encrypted = this.secretEncryptionService.encryptSecret(secret);
                secretEnc = encrypted.enc;
                secretEncIv = encrypted.iv;
                secretEncTag = encrypted.tag;
                secretVersion = 1;
            }
            else {
                const isProduction = process.env.NODE_ENV === 'production';
                if (isProduction) {
                    throw new common_1.BadRequestException('API_KEY_MASTER_KEY_B64 is required in production environment. ' +
                        'Please configure the master key before creating API keys.');
                }
                this.logger.warn('API_KEY_MASTER_KEY_B64 not configured. Using insecure secretHash storage (dev/test only).');
                secretHash = secret;
            }
        }
        catch (error) {
            const isProduction = process.env.NODE_ENV === 'production';
            if (isProduction) {
                this.logger.error(`Failed to encrypt secret: ${error.message}`, error.stack);
                throw new common_1.BadRequestException('Failed to encrypt secret. Production environment requires encrypted storage.');
            }
            this.logger.warn(`Failed to encrypt secret, using fallback: ${error.message}`);
            secretHash = secret;
        }
        const apiKey = await this.prisma.apiKey.create({
            data: {
                key,
                secretHash,
                secretEnc,
                secretEncIv,
                secretEncTag,
                secretVersion,
                name,
                ownerUserId: userId,
                ownerOrgId: orgId,
                status: 'ACTIVE',
            },
        });
        const result = {
            ...apiKey,
            secret,
        };
        delete result.secretHash;
        delete result.secretEnc;
        delete result.secretEncIv;
        delete result.secretEncTag;
        return result;
    }
    async findByKey(key) {
        return this.prisma.apiKey.findUnique({
            where: { key },
            include: {
                ownerUser: true,
                ownerOrg: true,
            },
        });
    }
    async disableApiKey(key) {
        const apiKey = await this.findByKey(key);
        if (!apiKey) {
            throw new common_1.NotFoundException('API Key 不存在');
        }
        return this.prisma.apiKey.update({
            where: { key },
            data: { status: 'DISABLED' },
        });
    }
    async enableApiKey(key) {
        const apiKey = await this.findByKey(key);
        if (!apiKey) {
            throw new common_1.NotFoundException('API Key 不存在');
        }
        return this.prisma.apiKey.update({
            where: { key },
            data: { status: 'ACTIVE' },
        });
    }
    async listApiKeys(userId, orgId) {
        const where = {};
        if (userId) {
            where.ownerUserId = userId;
        }
        if (orgId) {
            where.ownerOrgId = orgId;
        }
        return this.prisma.apiKey.findMany({
            where,
            include: {
                ownerUser: {
                    select: { id: true, email: true },
                },
                ownerOrg: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.ApiKeyService = ApiKeyService;
exports.ApiKeyService = ApiKeyService = ApiKeyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        secret_encryption_service_1.SecretEncryptionService])
], ApiKeyService);
//# sourceMappingURL=api-key.service.js.map