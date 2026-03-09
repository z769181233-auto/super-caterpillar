import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { RedisService } from '../../redis/redis.service';
import { ShotRenderRouterAdapter } from './shot_render_router.adapter';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
export declare class ShotPreviewFastAdapter implements EngineAdapter {
    private readonly redisService;
    private readonly shotRenderRouter;
    private readonly auditService;
    private readonly costLedgerService;
    readonly name = "shot_preview";
    private readonly logger;
    constructor(redisService: RedisService, shotRenderRouter: ShotRenderRouterAdapter, auditService: AuditService, costLedgerService: CostLedgerService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private auditPreview;
    private recordCost;
}
