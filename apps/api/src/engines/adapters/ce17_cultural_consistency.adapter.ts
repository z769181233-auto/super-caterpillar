import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * CE17: 文化一致性校验引擎
 * 功能: 校验剧情中的文化细节与一致性 (REAL-STUB)
 */
@Injectable()
export class CE17CulturalConsistencyAdapter implements EngineAdapter {
  public readonly name = 'ce17_cultural_consistency';

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CostLedgerService) private readonly cost: CostLedgerService
  ) {}

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
      action: 'CE17_INVOKE',
      details: payload,
    });

    const output = {
      culturalRegion: payload.region || 'global',
      consistencyScore: 0.95,
      violations: [],
      recommendations: ['Maintain traditional greeting etiquette in Scene 5'],
      meta: { engineVersion: 'ce17-v1.0' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId: context.projectId || 'unknown',
      jobId: context.jobId || 'unknown',
      jobType: 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: 0.04,
      billingUnit: 'tokens',
      quantity: 400,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
