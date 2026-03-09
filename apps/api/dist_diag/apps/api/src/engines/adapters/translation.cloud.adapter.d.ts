import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export declare class TranslationCloudAdapter implements EngineAdapter {
    private readonly prisma;
    private readonly auditService;
    private readonly costLedgerService;
    readonly name = "translation_engine";
    private readonly logger;
    constructor(prisma: PrismaService, auditService: AuditService, costLedgerService: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private simulateTranslation;
    private auditHelper;
    private recordCost;
}
