import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export type CE07MemoryType = 'relationship' | 'knowledge' | 'emotion' | 'skill';
export interface CE07MemoryInput {
    characterId: string;
    sceneId: string;
    memoryType: CE07MemoryType;
    content: string;
    ts?: string;
}
export declare class CE07MemoryUpdateAdapter implements EngineAdapter {
    private readonly prisma;
    private readonly auditService;
    private readonly costLedgerService;
    readonly name = "ce07_memory_update";
    private readonly logger;
    constructor(prisma: PrismaService, auditService: AuditService, costLedgerService: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
}
