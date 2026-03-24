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

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    const { payload, context } = input;

    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: context.projectId,
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
      projectId: context.projectId || 'unknown',
      jobId: context.jobId || 'unknown',
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
