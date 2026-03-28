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
    @Inject(CostLedgerService) private readonly cost: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  private requireContextId(value: unknown, field: 'projectId' | 'jobId'): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    throw new Error(`[CE18WorldLogicValidatorAdapter] Missing context.${field}`);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { payload, context } = input;
    let projectId: string;
    let jobId: string;
    try {
      projectId = this.requireContextId(context.projectId, 'projectId');
      jobId = this.requireContextId(context.jobId, 'jobId');
    } catch (error: any) {
      return {
        status: 'FAILED' as any,
        error: {
          code: 'CE18_CONTEXT_REQUIRED',
          message: error.message,
        },
      };
    }

    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: projectId,
      action: 'CE18_INVOKE',
      details: payload,
    });

    const output = {
      logicPass: true,
      detectedParadoxes: [],
      worldPhysicsRating: 0.88,
      meta: { engineVersion: 'ce18-v1.0' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId,
      jobId,
      jobType: 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: 0.06,
      billingUnit: 'tokens',
      quantity: 600,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
