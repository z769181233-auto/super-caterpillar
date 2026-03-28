import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * AU05: 环境混响引擎
 * 功能: 生成高精环境混响与空间音场 (REAL-STUB)
 */
@Injectable()
export class AU05EnvironmentalReverbAdapter implements EngineAdapter {
  public readonly name = 'au05_environmental_reverb';

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
    throw new Error(`[AU05EnvironmentalReverbAdapter] Missing context.${field}`);
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
          code: 'AU05_CONTEXT_REQUIRED',
          message: error.message,
        },
      };
    }

    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: projectId,
      action: 'AU05_INVOKE',
      details: payload,
    });

    const output = {
      reverbProfile: payload.roomType || 'hall',
      decayTime: 2.4,
      wetDryRatio: 0.35,
      spatialImpulseUrl: 'file:///storage/audio/reverb/ir_hall_001.wav',
      meta: { engine: 'au05-convolution-v1' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId,
      jobId,
      jobType: 'AU_RENDER',
      engineKey: this.name,
      costAmount: 0.02,
      billingUnit: 'seconds',
      quantity: 30,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
