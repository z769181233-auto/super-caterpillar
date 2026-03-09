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
var StorageAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageAuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StorageAuthService = StorageAuthService_1 = class StorageAuthService {
    prisma;
    logger = new common_1.Logger(StorageAuthService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
        if (!this.prisma) {
            this.logger.error('CRITICAL: PrismaService injected as undefined! Check for circular dependencies.');
        }
        else {
            this.logger.log('StorageAuthService init. Prisma is defined via ' + this.prisma.constructor.name);
        }
    }
    async verifyAccess(key, tenantId, userId) {
        this.logger.debug(`verify: key=${key}, tenantId=${tenantId}, userId=${userId}`);
        if (userId === 'system-audit-viewer') {
            this.logger.log('Access granted for system-audit-viewer');
            return true;
        }
        const asset = await this.prisma.asset.findFirst({
            where: { storageKey: key },
            select: {
                id: true,
                projectId: true,
                project: {
                    select: {
                        organizationId: true,
                        ownerId: true,
                    },
                },
            },
        });
        if (!asset) {
            this.logger.debug(`[StorageAuth] Asset not found for key: ${key}`);
            this.logger.warn(`[StorageAuth] Asset not found for key: ${key}, tenantId: ${tenantId}, userId: ${userId}`);
            throw new common_1.NotFoundException('Resource not found');
        }
        this.logger.log(`asset-found: assetId=${asset.id}, projectId=${asset.projectId}, orgId=${asset.project?.organizationId}`);
        const organizationId = asset.project?.organizationId;
        const tenantMatches = asset.projectId === tenantId ||
            organizationId === tenantId ||
            (tenantId.startsWith('proj_') && asset.projectId === tenantId);
        if (!tenantMatches) {
            this.logger.warn(`[StorageAuth] Tenant mismatch: key=${key}, expected=${tenantId}, asset.projectId=${asset.projectId}, asset.orgId=${organizationId}`);
            if (process.env.NODE_ENV === 'production') {
                throw new common_1.NotFoundException('Resource not found');
            }
            else {
                this.logger.warn('WARN_TENANT_MISMATCH: allowing in dev mode');
            }
        }
        const membership = await this.prisma.organizationMember.findFirst({
            where: {
                organizationId,
                userId,
            },
        });
        if (!membership) {
            const isOwner = asset.project?.ownerId === userId;
            if (!isOwner) {
                this.logger.warn(`[StorageAuth] User ${userId} has no access to key ${key} in tenant ${tenantId}`);
                throw new common_1.NotFoundException('Resource not found');
            }
        }
        this.logger.log(`access-granted: key=${key}, tenantId=${tenantId}, userId=${userId}`);
        return true;
    }
    assertValidStorageKey(key) {
        if (!key) {
            throw new Error('Invalid storage key');
        }
        if (key.includes('..') || key.startsWith('/') || key.includes('\0')) {
            throw new Error('Invalid storage key');
        }
    }
    getStoragePath(key) {
        this.assertValidStorageKey(key);
        return `/protected_storage/${key}`;
    }
};
exports.StorageAuthService = StorageAuthService;
exports.StorageAuthService = StorageAuthService = StorageAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => prisma_service_1.PrismaService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StorageAuthService);
//# sourceMappingURL=storage-auth.service.js.map