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
var MemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../audit-log/audit-log.service");
let MemoryService = MemoryService_1 = class MemoryService {
    prisma;
    auditLogService;
    logger = new common_1.Logger(MemoryService_1.name);
    constructor(prisma, auditLogService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
    }
    async getShortTermMemory(chapterId, userId) {
        const memory = await this.prisma.memoryShortTerm.findFirst({
            where: { chapterId },
        });
        await this.auditLogService.record({
            userId,
            action: 'MEMORY_ACCESS',
            resourceType: 'memory',
            resourceId: chapterId,
            details: { type: 'short-term', chapterId },
        });
        if (!memory) {
            return {
                success: true,
                data: {
                    chapterId,
                    summary: null,
                    characterStates: null,
                },
            };
        }
        return {
            success: true,
            data: {
                chapterId,
                summary: memory.summary,
                characterStates: memory.characterStates,
            },
        };
    }
    async getLongTermMemory(entityId, userId) {
        const memory = await this.prisma.memoryLongTerm.findFirst({
            where: { entityId },
        });
        await this.auditLogService.record({
            userId,
            action: 'MEMORY_ACCESS',
            resourceType: 'memory',
            resourceId: entityId,
            details: { type: 'long-term', entityId },
        });
        if (!memory) {
            return {
                success: true,
                data: {
                    entityId,
                    entityType: null,
                    vectorRef: null,
                    metadata: null,
                },
            };
        }
        return {
            success: true,
            data: {
                entityId,
                entityType: memory.entityType,
                vectorRef: memory.vectorRef,
                metadata: memory.metadata,
            },
        };
    }
    async updateMemory(body, userId) {
        if (body.type === 'short-term' && body.chapterId) {
            await this.auditLogService.record({
                userId,
                action: 'MEMORY_UPDATE',
                resourceType: 'memory',
                resourceId: body.chapterId,
                details: { type: 'short-term', chapterId: body.chapterId },
            });
            return {
                success: true,
                data: {
                    chapterId: body.chapterId,
                    status: 'PENDING',
                },
            };
        }
        else if (body.type === 'long-term' && body.entityId) {
            await this.auditLogService.record({
                userId,
                action: 'MEMORY_UPDATE',
                resourceType: 'memory',
                resourceId: body.entityId,
                details: { type: 'long-term', entityId: body.entityId },
            });
            return {
                success: true,
                data: {
                    entityId: body.entityId,
                    status: 'PENDING',
                },
            };
        }
        throw new common_1.NotFoundException('Invalid memory type or missing ID');
    }
};
exports.MemoryService = MemoryService;
exports.MemoryService = MemoryService = MemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService])
], MemoryService);
//# sourceMappingURL=memory.service.js.map