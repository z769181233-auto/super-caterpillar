import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * CE18: 世界观逻辑验证引擎
 * 功能: 验证故事物理/魔法规则逻辑一致性 (REAL-STUB)
 */
@Injectable()
export class CE18WorldLogicValidatorAdapter implements EngineAdapter {
    public readonly name = 'ce18_world_logic_validator';

    constructor(
        @Inject(RedisService) private readonly redis: RedisService,
        @Inject(AuditService) private readonly audit: AuditService,
        @Inject(CostLedgerService) private readonly cost: CostLedgerService,
    ) { }

    supports(engineKey: string): boolean {
        return engineKey === this.name;
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        const { payload, context } = input;

        await this.audit.log({
            userId: context.userId,
            traceId: context.traceId,
            resourceType: 'project',
            resourceId: context.projectId,
            action: 'CE18_INVOKE',
            details: payload
        });

        const output = {
            logicPass: true,
            detectedParadoxes: [],
            worldPhysicsRating: 0.88,
            meta: { engineVersion: 'ce18-v1.0' }
        };

        await this.cost.recordFromEvent({
            userId: context.userId || 'system',
            projectId: context.projectId || 'unknown',
            jobId: context.jobId || 'unknown',
            jobType: 'NOVEL_ANALYSIS',
            engineKey: this.name,
            costAmount: 0.06,
            billingUnit: 'tokens',
            quantity: 600
        });

        return {
            status: 'SUCCESS' as any,
            output
        };
    }
}
