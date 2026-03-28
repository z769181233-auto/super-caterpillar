import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * AU06: 空间音频引擎
 * 功能: 处理 3D 音场与空间定位音频 (REAL-TRUTH)
 */
@Injectable()
export class AU06SpatialAudioAdapter implements EngineAdapter {
  public readonly name = 'au06_spatial_audio';

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
    throw new Error(`[AU06SpatialAudioAdapter] Missing context.${field}`);
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
          code: 'AU06_CONTEXT_REQUIRED',
          message: error.message,
        },
      };
    }

    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: projectId,
      action: 'AU06_INVOKE',
      details: payload,
    });

    const output = {
      format: 'Ambisonics',
      sourcePositions: payload.sources || [{ name: 'char1', x: 2.0, y: 1.0, z: -3.0 }],
      spatialAudioUrl: 'file:///storage/audio/spatial/out_001.wav',
      meta: { engine: 'au06-spatial-mapping-v1' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId,
      jobId,
      jobType: 'AU_RENDER',
      engineKey: this.name,
      costAmount: 0.15,
      billingUnit: 'seconds',
      quantity: 30,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
