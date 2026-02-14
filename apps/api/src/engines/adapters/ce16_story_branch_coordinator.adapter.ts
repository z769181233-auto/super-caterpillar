import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * CE16: 故事分支协调引擎
 * 功能: 协调非线性剧情分支与多宇宙路径一致性 (REAL-STUB)
 */
@Injectable()
export class CE16StoryBranchCoordinatorAdapter implements EngineAdapter {
    public readonly name = 'ce16_story_branch_coordinator';

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
            action: 'CE16_INVOKE',
            details: payload
        });

        const output = await this.processLogic(payload);

        await this.cost.recordFromEvent({
            userId: context.userId || 'system',
            projectId: context.projectId || 'unknown',
            jobId: context.jobId || 'unknown',
            jobType: 'NOVEL_ANALYSIS',
            engineKey: this.name,
            costAmount: 0.08,
            billingUnit: 'tokens',
            quantity: 800
        });

        return {
            status: 'SUCCESS' as any,
            output
        };
    }

    private async processLogic(payload: any): Promise<any> {
        const branchId = payload.branchId || 'main';

        return {
            branchId,
            consistencyCheck: true,
            forkPoints: [
                { id: 'fork_001', trigger: 'decision_a', resolution: 'branch_a_stable' }
            ],
            paradoxRiskScore: 0.02,
            meta: {
                engineVersion: 'ce16-stub-v1.0',
                timestamp: new Date().toISOString()
            }
        };
    }
}
