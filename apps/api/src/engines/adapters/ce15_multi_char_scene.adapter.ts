import { Injectable, Inject } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';

/**
 * CE15: 多角色场景协调引擎
 * 功能: 协调多角色互动场景与冲突处理 (REAL-STUB)
 */
@Injectable()
export class CE15MultiCharSceneAdapter implements EngineAdapter {
  public readonly name = 'ce15_multi_char_scene';

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

    // 1. 记录审计
    await this.audit.log({
      userId: context.userId,
      traceId: context.traceId,
      resourceType: 'project',
      resourceId: context.projectId,
      action: 'CE15_INVOKE',
      details: payload,
    });

    // 2. 执行逻辑 (REAL-STUB)
    const output = await this.processLogic(payload);

    // 3. 记录成本
    await this.cost.recordFromEvent({
      userId: context.userId || 'system',
      projectId: context.projectId || 'unknown',
      jobId: context.jobId || 'unknown',
      jobType: 'NOVEL_ANALYSIS',
      engineKey: this.name,
      costAmount: 0.05, // 模拟成本
      billingUnit: 'tokens',
      quantity: 500,
    });

    return {
      status: 'SUCCESS' as any,
      output,
    };
  }

  private async processLogic(payload: any): Promise<any> {
    const sceneId = payload.sceneId || 'scene_default';
    const characterIds = (payload.characterIds as string[]) || [];

    // 模拟多角色协调逻辑
    const coordination = {
      sceneId,
      characterCount: characterIds.length,
      interactions:
        characterIds.length > 1
          ? [
              {
                type: 'EYE_CONTACT',
                involved: characterIds.slice(0, 2),
                priority: 'HIGH',
              },
            ]
          : [],
      conflicts: [],
      compositionRecommendation: characterIds.length > 1 ? 'WIDE_SHOT' : 'CU',
      layout: characterIds.map((id: string, index: number) => ({
        characterId: id,
        position: { x: index * 100, y: 0, z: 50 },
        occlusionScore: index > 0 ? 0.2 : 0,
      })),
    };

    return {
      coordination,
      meta: {
        engineVersion: 'ce15-stub-v1.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
