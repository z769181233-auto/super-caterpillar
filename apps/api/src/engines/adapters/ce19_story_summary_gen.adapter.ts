import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * CE19: 故事大纲生成引擎
 * 功能: 自动生成多尺度剧情摘要与大纲 (REAL-STUB)
 */
@Injectable()
export class CE19StorySummaryGenAdapter implements EngineAdapter {
  public readonly name = 'ce19_story_summary_gen';

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
      action: 'CE19_INVOKE',
      details: payload,
    });

    const output = {
      oneLine: 'A determined caterpillar explores the multiverse to find its wings.',
      shortSummary:
        'In a world where every crawl can lead to a new dimension, one small caterpillar must navigate cosmic challenges and self-discovery.',
      mainArcSteps: [
        'Discovery of the rift',
        'Meeting the sage moth',
        'The cocoon of time',
        'Emergence and victory',
      ],
      meta: { engine: 'ce19-llm-aggregator-stub' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId: context.projectId || 'unknown',
      jobId: context.jobId || 'unknown',
      jobType: 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: 0.1,
      billingUnit: 'tokens',
      quantity: 1000,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
