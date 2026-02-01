import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

@Injectable()
export class VG03LightingEngineAdapter extends VgBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('vg03_lighting_engine', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    /**
     * 实现具体的光照引擎逻辑 (REAL-STUB)
     * 使用 FFmpeg eq 滤镜模拟不同的光照预设
     */
    protected async processLogic(payload: any): Promise<any> {
        const sourceUrl = payload.sourceUrl || '';
        const preset = payload.lightingPreset || 'neutral';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/vg/lighting');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.png`);

        let sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';

        if (!sourcePath || !existsSync(sourcePath)) {
            inputArg = `-f lavfi -i color=c=gray:s=512x512`;
        } else {
            inputArg = `-i "${sourcePath}"`;
        }

        let filter = 'eq=brightness=0';
        if (preset === 'night') filter = 'eq=brightness=-0.3:contrast=1.2:gamma=0.8';
        if (preset === 'bright') filter = 'eq=brightness=0.2:contrast=0.9';
        if (preset === 'sunset') filter = 'eq=brightness=0.0:contrast=1.1,hue=h=30:s=1.5';

        const cmd = `ffmpeg -y ${inputArg} -vf "${filter}" -frames:v 1 "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { preset, sourceUrl, format: 'png' }
        };
    }
}
