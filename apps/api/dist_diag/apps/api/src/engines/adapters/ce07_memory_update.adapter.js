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
var CE07MemoryUpdateAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE07MemoryUpdateAdapter = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const cost_ledger_service_1 = require("../../cost/cost-ledger.service");
const crypto_1 = require("crypto");
const perf_hooks_1 = require("perf_hooks");
let CE07MemoryUpdateAdapter = CE07MemoryUpdateAdapter_1 = class CE07MemoryUpdateAdapter {
    prisma;
    auditService;
    costLedgerService;
    name = 'ce07_memory_update';
    logger = new common_1.Logger(CE07MemoryUpdateAdapter_1.name);
    constructor(prisma, auditService, costLedgerService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.costLedgerService = costLedgerService;
    }
    supports(engineKey) {
        return engineKey === 'ce07_memory_update';
    }
    async invoke(input) {
        const payload = input.payload;
        const context = input.context || {};
        const traceId = context.traceId || `ce07_${(0, crypto_1.randomUUID)()}`;
        const projectId = context.projectId || payload.projectId;
        const t0 = perf_hooks_1.performance.now();
        try {
            if (!payload.characterId || !payload.sceneId || !payload.content || !payload.memoryType) {
                throw new Error('Missing required fields: characterId, sceneId, content, memoryType');
            }
            if (!projectId) {
                throw new Error('Missing projectId in context/payload');
            }
            const effectiveDate = payload.ts ? new Date(payload.ts) : new Date();
            const [cm, sm] = await this.prisma.$transaction([
                this.prisma.characterMemory.create({
                    data: {
                        characterId: payload.characterId,
                        sceneId: payload.sceneId,
                        memoryType: payload.memoryType,
                        content: payload.content,
                        createdAt: effectiveDate,
                    },
                }),
                this.prisma.sceneMemory.create({
                    data: {
                        sceneId: payload.sceneId,
                        memoryType: payload.memoryType,
                        content: payload.content,
                        createdAt: effectiveDate,
                    },
                }),
            ]);
            const verifyCm = await this.prisma.characterMemory.findUnique({
                where: { id: cm.id },
            });
            if (!verifyCm)
                throw new Error('Write-Readback verification failed for CharacterMemory');
            await this.auditService.log({
                action: 'CE07_MEMORY_UPDATE',
                resourceType: 'character_memory',
                resourceId: cm.id,
                traceId: traceId,
                details: {
                    characterId: payload.characterId,
                    sceneId: payload.sceneId,
                    memoryType: payload.memoryType,
                    contentHash: Buffer.from(payload.content).toString('base64').substring(0, 20) + '...',
                    sceneMemoryId: sm.id,
                    projectId: projectId,
                },
                userId: context.userId || 'system',
                organizationId: context.organizationId,
            });
            await this.costLedgerService.recordFromEvent({
                userId: context.userId || 'system',
                projectId: projectId,
                jobId: context.jobId || traceId,
                jobType: 'CE07_MEMORY_UPDATE',
                costAmount: 0,
                billingUnit: 'job',
                quantity: 1,
                engineKey: this.name,
                attempt: context.attempt || 1,
                metadata: { traceId, memoryId: cm.id },
            });
            const t1 = perf_hooks_1.performance.now();
            const durationMs = Math.round(t1 - t0);
            this.logger.log(`[CE07] Finished memory update for character=${payload.characterId} duration=${durationMs}ms`);
            return {
                status: 'SUCCESS',
                output: {
                    status: 'PASS',
                    recordIds: { characterMemoryId: cm.id, sceneMemoryId: sm.id },
                    meta: {
                        characterId: payload.characterId,
                        sceneId: payload.sceneId,
                        timestamp: effectiveDate.toISOString(),
                        traceId,
                    },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        catch (error) {
            this.logger.error(`[CE07] Failed: ${error.message}`, error.stack);
            return {
                status: 'FAILED',
                error: {
                    code: 'CE07_EXECUTION_ERROR',
                    message: error.message,
                },
            };
        }
    }
};
exports.CE07MemoryUpdateAdapter = CE07MemoryUpdateAdapter;
exports.CE07MemoryUpdateAdapter = CE07MemoryUpdateAdapter = CE07MemoryUpdateAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        cost_ledger_service_1.CostLedgerService])
], CE07MemoryUpdateAdapter);
//# sourceMappingURL=ce07_memory_update.adapter.js.map