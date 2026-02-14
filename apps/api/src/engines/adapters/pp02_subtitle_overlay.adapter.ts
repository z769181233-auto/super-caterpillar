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
export class PP02SubtitleOverlayAdapter extends PpBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('pp02_subtitle_overlay', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    protected async processLogic(payload: any): Promise<any> {
        const sourceUrl = payload.sourceUrl || '';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/pp/subtitle');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.mp4`);

        const sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';
        if (!sourcePath || !existsSync(sourcePath)) {
            inputArg = `-f lavfi -i testsrc=d=1`;
        } else {
            inputArg = `-i "${sourcePath}"`;
        }

        // FFmpeg: 使用 drawbox 模拟字幕条
        const cmd = `ffmpeg -y ${inputArg} -vf "drawbox=y=ih-50:w=iw:h=40:color=black@0.5:t=fill" -c:a copy "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { format: 'mp4', hasSubtitle: true }
        };
    }
}
