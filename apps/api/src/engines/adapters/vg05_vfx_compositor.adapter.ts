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
export class VG05VFXCompositorAdapter extends VgBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('vg05_vfx_compositor', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    /**
     * 实现具体的 VFX 合成逻辑 (REAL-STUB)
     * 使用 FFmpeg 滤镜叠加热噪声、暗角或调色特效
     */
    protected async processLogic(payload: any): Promise<any> {
        const sourceUrl = payload.sourceUrl || '';
        const vfx = payload.vfxPreset || 'grain';
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/vg/vfx');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.png`);

        let sourcePath = sourceUrl.replace('file://', '');
        let inputArg = '';
        if (!sourcePath || !existsSync(sourcePath)) {
            inputArg = `-f lavfi -i color=c=0x111111:s=512x512`;
        } else {
            inputArg = `-i "${sourcePath}"`;
        }

        // FFmpeg Logic: noise, vignette, or color transformation
        let filter = 'noise=alls=15:allf=t+u';
        if (vfx === 'vignette') filter = 'vignette=PI/4';
        if (vfx === 'sepia') filter = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
        if (vfx === 'scanlines') filter = 'drawbox=y=ih/2:w=iw:h=1:color=black@0.5:t=fill'; // Mock scanline

        const cmd = `ffmpeg -y ${inputArg} -vf "${filter}" -frames:v 1 "${outputPath}"`;
        execSync(cmd, { stdio: 'ignore' });

        return {
            assetUrl: `file://${outputPath}`,
            meta: { vfx, sourceUrl, format: 'png' }
        };
    }
}
