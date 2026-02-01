import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync } from 'fs';

@Injectable()
export class AU02BGMGenAdapter extends AuBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('au02_bgm_gen', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const style = payload.style || 'neutral';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/au/bgm');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.wav`);

        // FFmpeg: 生成不同频率的正弦波模拟 BGM
        let freq = 220;
        if (style === 'epic') freq = 110;
        if (style === 'happy') freq = 880;

        const cmd = `ffmpeg -y -f lavfi -i "sine=f=${freq}:d=5" "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { style, format: 'wav', duration: 5 }
        };
    }
}
