import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { AuBaseEngine } from '../base/au_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

@Injectable()
export class AU04AudioMixAdapter extends AuBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('au04_audio_mix', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const tracks = payload.tracks || [];
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/au/mix');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.wav`);

        // FFmpeg: amix
        let inputs = '';
        let count = 0;
        for (const t of tracks) {
            const p = t.url.replace('file://', '');
            if (existsSync(p)) {
                inputs += `-i "${p}" `;
                count++;
            }
        }

        if (count === 0) {
            inputs = '-f lavfi -i "sine=f=440:d=1"';
            count = 1;
        }

        const cmd = `ffmpeg -y ${inputs} -filter_complex amix=inputs=${count} "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { tracks_count: count, format: 'wav' }
        };
    }
}
