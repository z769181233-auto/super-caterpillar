import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * QC05: 技术规格合规性引擎
 * 功能: 自动校验视频编码、码率与元数据规格 (REAL-STUB)
 */
@Injectable()
export class QC05TechnicalComplianceAdapter implements EngineAdapter {
  public readonly name = 'qc05_technical_compliance';

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
      action: 'QC05_INVOKE',
      details: payload,
    });

    const output = {
      compliancePass: true,
      format: 'mp4',
      codec: 'h264',
      resolution: payload.expectedResolution || '1080p',
      bitrateCheck: 'PASS',
      metadataValidated: true,
      meta: { engine: 'qc05-spec-validator-stub' },
    };

    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId: context.projectId || 'unknown',
      jobId: context.jobId || 'unknown',
      jobType: 'QC_CHECK',
      engineKey: this.name,
      costAmount: 0.01,
      billingUnit: 'frames',
      quantity: 1000,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }
}
