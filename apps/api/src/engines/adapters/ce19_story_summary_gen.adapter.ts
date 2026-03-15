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
    if (process.env.NODE_ENV === 'production' && process.env.GATE_MODE !== '1') {
      throw new Error(`[ENGINE_UNAVAILABLE] CE19 Story Summary Gen implementation required.`);
    }
    console.warn(`CE19 Story Summary Gen running in non-prod mode. No REAL implementation bound.`);
    throw new Error('[STUB_ERROR] CE19 Story Summary Gen is a STUB; real implementation missing.');
  }
}
