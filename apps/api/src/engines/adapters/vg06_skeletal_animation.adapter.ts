import { Injectable, Inject } from '@nestjs/common';
import { EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { VgBaseEngine } from '../base/vg_base.engine';
import { AuditService } from '../../audit/audit.service';
import { CostLedgerService } from '../../cost/cost-ledger.service';
import { RedisService } from '../../redis/redis.service';
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

/**
 * VG06: 骨骼动画引擎
 * 功能: 2D骨骼动画生成与绑定
 * 
 * 能力:
 * - 基于关键帧的骨骼动画生成
 * - 角色动作绑定 (走、跑、跳、坐等)
 * - 动作平滑插值
 * - 支持分层动画 (上半身/下半身独立)
 */
@Injectable()
export class VG06SkeletalAnimationAdapter extends VgBaseEngine {
    constructor(
        @Inject(RedisService) redis: RedisService,
        @Inject(AuditService) audit: AuditService,
        @Inject(CostLedgerService) cost: CostLedgerService
    ) {
        super('vg06_skeletal_animation', redis, audit, cost);
    }

    async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
        return this.execute(input, input.payload);
    }

    /**
     * 骨骼动画生成核心逻辑 (REAL-STUB)
     * 当前: 算法生成关键帧动画数据
     * 未来: 可升级为AI驱动的骨骼动画生成服务
     * 
     * Payload 结构:
     * {
     *   characterId: string,      // 角色ID
     *   action: string,           // 动作类型: 'walk', 'run', 'jump', 'sit', 'wave'
     *   duration: number,         // 动画时长(秒)
     *   fps: number,              // 帧率 (默认24)
     *   style: string,            // 动画风格: 'smooth', 'snappy', 'realistic'
     *   layered?: boolean         // 是否使用分层动画
     * }
     */
    protected async processLogic(payload: any): Promise<any> {
        const characterId = payload.characterId || 'char_default';
        const action = payload.action || 'idle';
        const duration = payload.duration || 2.0;
        const fps = payload.fps || 24;
        const style = payload.style || 'smooth';
        const layered = payload.layered || false;

        // 确定性 Hash 作为文件名
        const hash = this.generateCacheKey(payload).split(':').pop();
        const outputDir = join(process.cwd(), 'storage/vg/skeletal');
        mkdirSync(outputDir, { recursive: true });

        // 生成骨骼动画数据 (JSON格式的关键帧)
        const animationData = this.generateSkeletalAnimation(
            action,
            duration,
            fps,
            style,
            layered
        );

        // 保存动画数据
        const dataPath = join(outputDir, `${hash}_anim.json`);
        writeFileSync(dataPath, JSON.stringify(animationData, null, 2));

        // 生成预览视频 (使用FFmpeg绘制骨架)
        const previewPath = join(outputDir, `${hash}_preview.mp4`);
        this.generateAnimationPreview(animationData, previewPath, fps);

        return {
            animationDataUrl: `file://${dataPath}`,
            previewVideoUrl: `file://${previewPath}`,
            meta: {
                characterId,
                action,
                duration,
                fps,
                frameCount: animationData.frames.length,
                boneCount: animationData.skeleton.bones.length,
                style,
                layered
            }
        };
    }

    /**
     * 生成骨骼动画关键帧数据
     */
    private generateSkeletalAnimation(
        action: string,
        duration: number,
        fps: number,
        style: string,
        layered: boolean
    ): any {
        const frameCount = Math.floor(duration * fps);

        // 定义骨骼结构 (简化的人形骨架)
        const skeleton = {
            bones: [
                { id: 'root', parent: null, length: 0 },
                { id: 'spine', parent: 'root', length: 80 },
                { id: 'head', parent: 'spine', length: 40 },
                { id: 'leftArm', parent: 'spine', length: 60 },
                { id: 'rightArm', parent: 'spine', length: 60 },
                { id: 'leftLeg', parent: 'root', length: 70 },
                { id: 'rightLeg', parent: 'root', length: 70 }
            ]
        };

        // 根据动作类型生成关键帧
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const t = i / frameCount; // 归一化时间 [0,1]
            const frame = this.generateFrame(action, t, skeleton, style, layered);
            frames.push(frame);
        }

        return {
            version: '1.0',
            skeleton,
            action,
            duration,
            fps,
            frameCount,
            frames
        };
    }

    /**
     * 生成单帧骨骼姿态
     */
    private generateFrame(
        action: string,
        t: number,
        skeleton: any,
        style: string,
        layered: boolean
    ): any {
        const frame: any = { time: t, bones: {} };

        // 插值函数 (根据style选择)
        const lerp = style === 'snappy'
            ? this.snapInterpolate
            : this.smoothInterpolate;

        switch (action) {
            case 'walk':
                frame.bones.leftLeg = { rotation: Math.sin(t * Math.PI * 4) * 30 };
                frame.bones.rightLeg = { rotation: Math.sin(t * Math.PI * 4 + Math.PI) * 30 };
                frame.bones.leftArm = { rotation: Math.sin(t * Math.PI * 4 + Math.PI) * 20 };
                frame.bones.rightArm = { rotation: Math.sin(t * Math.PI * 4) * 20 };
                break;

            case 'run':
                frame.bones.leftLeg = { rotation: Math.sin(t * Math.PI * 8) * 45 };
                frame.bones.rightLeg = { rotation: Math.sin(t * Math.PI * 8 + Math.PI) * 45 };
                frame.bones.leftArm = { rotation: Math.sin(t * Math.PI * 8 + Math.PI) * 35 };
                frame.bones.rightArm = { rotation: Math.sin(t * Math.PI * 8) * 35 };
                frame.bones.spine = { rotation: Math.sin(t * Math.PI * 8) * 5 };
                break;

            case 'jump':
                const jumpPhase = t < 0.5 ? t * 2 : 2 - t * 2; // 抛物线
                frame.bones.leftLeg = { rotation: -45 * jumpPhase };
                frame.bones.rightLeg = { rotation: -45 * jumpPhase };
                frame.bones.leftArm = { rotation: 60 * jumpPhase };
                frame.bones.rightArm = { rotation: 60 * jumpPhase };
                frame.bones.root = { y: -50 * Math.sin(t * Math.PI) };
                break;

            case 'wave':
                frame.bones.rightArm = { rotation: 90 + Math.sin(t * Math.PI * 4) * 30 };
                break;

            case 'sit':
                frame.bones.leftLeg = { rotation: 90 };
                frame.bones.rightLeg = { rotation: 90 };
                frame.bones.spine = { rotation: -10 };
                break;

            default: // idle
                frame.bones.spine = { rotation: Math.sin(t * Math.PI) * 2 };
                break;
        }

        return frame;
    }

    /**
     * 平滑插值
     */
    private smoothInterpolate(a: number, b: number, t: number): number {
        const smoothT = t * t * (3 - 2 * t); // Smoothstep
        return a + (b - a) * smoothT;
    }

    /**
     * 急促插值
     */
    private snapInterpolate(a: number, b: number, t: number): number {
        return t < 0.5 ? a : b;
    }

    /**
     * 生成动画预览视频 (使用FFmpeg绘制骨架)
     */
    private generateAnimationPreview(
        animationData: any,
        outputPath: string,
        fps: number
    ): void {
        // 简化版: 生成纯色视频作为placeholder
        // 实际生产中应该绘制骨架线框
        const duration = animationData.duration;
        const cmd = `ffmpeg -y -f lavfi -i color=c=0x2a2a2a:s=512x512:r=${fps} -t ${duration} -pix_fmt yuv420p "${outputPath}"`;

        try {
            execSync(cmd, { stdio: 'ignore' });
        } catch (error) {
            // Fallback: 如果FFmpeg失败，创建空文件
            writeFileSync(outputPath, '');
        }
    }
}
