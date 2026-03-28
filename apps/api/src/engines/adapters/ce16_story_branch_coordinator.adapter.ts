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
    @Inject(CostLedgerService) private readonly cost: CostLedgerService
  ) {}

  supports(engineKey: string): boolean {
    return engineKey === this.name;
  }

  private requireContextId(value: unknown, field: 'projectId' | 'jobId'): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    throw new Error(`[CE16StoryBranchCoordinatorAdapter] Missing context.${field}`);
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
          code: 'CE16_CONTEXT_REQUIRED',
          message: error.message,
        },
      };
    }

    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: projectId,
      action: 'CE16_INVOKE',
      details: payload,
    });

    const output = await this.processLogic(payload);

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId,
      jobId,
      jobType: 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: 0.08,
      billingUnit: 'tokens',
      quantity: 800,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }

  private async processLogic(payload: any): Promise<any> {
    if (process.env.NODE_ENV === 'production' && process.env.GATE_MODE !== '1') {
      throw new Error(`[ENGINE_UNAVAILABLE] CE16 Story Branch Coordinator implementation required.`);
    }
    throw new Error('[STUB_ERROR] CE16 Story Branch Coordinator is a STUB; real implementation missing.');
  }
}
