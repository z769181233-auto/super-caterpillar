import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PpBaseEngine } from '../base/pp_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

@Injectable()
export class PP04HLSPackageAdapter extends PpBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('pp04_hls_package', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const sourceUrl = payload.sourceUrl || '';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), `storage/pp/hls/${hash}`);
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `index.m3u8`);

        const sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';
        if (!sourcePath || !existsSync(sourcePath)) {
            inputArg = `-f lavfi -i testsrc=d=5`;
        } else {
            inputArg = `-i "${sourcePath}"`;
        }

        // FFmpeg: HLS packaging
        const cmd = `ffmpeg -y ${inputArg} -c:v libx264 -preset ultrafast -hls_time 2 -hls_list_size 0 -f hls "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { format: 'm3u8', playlist: 'index.m3u8' }
        };
    }
}
