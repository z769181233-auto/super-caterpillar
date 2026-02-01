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
export class AU01VoiceTTSAdapter extends AuBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('au01_voice_tts', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const text = payload.text || 'hello';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/au/tts');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.wav`);

        // FFmpeg: 生成正弦波音频作为占位
        const cmd = `ffmpeg -y -f lavfi -i "sine=f=440:d=2" "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { text, format: 'wav', duration: 2 }
        };
    }
}
