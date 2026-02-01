import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

@Injectable()
export class VG04CameraPathAdapter extends VgBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('vg04_camera_path', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    /**
     * 实现具体的镜头路径逻辑 (REAL-STUB)
     * 生成确定性的镜头关键帧 JSON 文件
     */
    protected async processLogic(payload: any): Promise<any> {
        const mode = payload.mode || 'static';
        const duration = payload.duration || 5;
        const fps = payload.fps || 24;

        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/vg/path');
        mkdirSync(outputDir, { recursive: true });
        const outputPath = join(outputDir, `${hash}.json`);

        // 生成确定性关键帧数据
        const keyframes = [];
        const totalFrames = Math.floor(duration * fps);
        const steps = 5; // 每秒 5 个采样点

        for (let i = 0; i <= totalFrames; i += Math.ceil(fps / steps)) {
            let x = 0, y = 0, z = 0;
            if (mode === 'pan') x = (i / totalFrames) * 10.0;
            if (mode === 'zoom') z = (i / totalFrames) * 5.0;
            if (mode === 'tilt') y = (i / totalFrames) * 5.0;
            keyframes.push({ frame: i, x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)), z: parseFloat(z.toFixed(2)) });
        }

        writeFileSync(outputPath, JSON.stringify({ mode, duration, fps, keyframes }, null, 2));

        return {
            assetUrl: `file://${outputPath}`,
            meta: { mode, duration, fps, format: 'json' }
        };
    }
}
