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
 * VG07: 面部表情引擎
 * 功能: 基于情感的面部表情生成 (REAL-STUB)
 *
 * 当前: 算法生成表情关键点数据
 * 未来: 可升级为AI驱动的面部表情生成服务
 *
 * 能力:
 * - 基于情感标签生成面部表情
 * - 支持渐变表情动画
 * - 面部关键点追踪 (眉毛、眼睛、嘴巴)
 * - 表情强度控制
 * - 组合表情支持
 */
@Injectable()
export class VG07FacialExpressionAdapter extends VgBaseEngine {
  constructor(
    @Inject(RedisService) redis: RedisService,
    @Inject(AuditService) audit: AuditService,
    @Inject(CostLedgerService) cost: CostLedgerService
  ) {
    super('vg07_facial_expression', redis, audit, cost);
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    return this.execute(input, input.payload);
  }

  /**
   * 面部表情生成核心逻辑 (REAL-STUB)
   *
   * Payload 结构:
   * {
   *   characterId: string,        // 角色ID
   *   emotion: string,            // 情感: 'happy', 'sad', 'angry', 'surprised', 'neutral', 'fear'
   *   intensity: number,          // 强度 0-1
   *   duration: number,           // 动画时长(秒)
   *   fps: number,                // 帧率
   *   transition?: string         // 过渡类型: 'instant', 'smooth', 'elastic'
   * }
   */
  protected async processLogic(payload: any): Promise<any> {
    const characterId = payload.characterId || 'char_default';
    const emotion = payload.emotion || 'neutral';
    const intensity = Math.min(Math.max(payload.intensity || 1.0, 0), 1);
    const duration = payload.duration || 1.0;
    const fps = payload.fps || 24;
    const transition = payload.transition || 'smooth';

    // 确定性 Hash 作为文件名
    const hash = this.generateCacheKey(payload).split(':').pop();
    const outputDir = join(process.cwd(), 'storage/vg/facial');
    mkdirSync(outputDir, { recursive: true });

    // 生成面部表情数据
    const expressionData = this.generateFacialExpression(
      emotion,
      intensity,
      duration,
      fps,
      transition
    );

    // 保存表情数据
    const dataPath = join(outputDir, `${hash}_expr.json`);
    writeFileSync(dataPath, JSON.stringify(expressionData, null, 2));

    // 生成预览图 (单帧表情可视化)
    const previewPath = join(outputDir, `${hash}_preview.png`);
    this.generateExpressionPreview(expressionData, previewPath, emotion);

    return {
      expressionDataUrl: `file://${dataPath}`,
      previewImageUrl: `file://${previewPath}`,
      meta: {
        characterId,
        emotion,
        intensity,
        duration,
        fps,
        frameCount: expressionData.frames.length,
        keypointCount: expressionData.keypoints.length,
        transition,
      },
    };
  }

  /**
   * 生成面部表情动画数据
   */
  private generateFacialExpression(
    emotion: string,
    intensity: number,
    duration: number,
    fps: number,
    transition: string
  ): any {
    const frameCount = Math.floor(duration * fps);

    // 定义面部关键点 (简化的面部特征点)
    const keypoints = [
      { id: 'leftEyebrow', type: 'curve' },
      { id: 'rightEyebrow', type: 'curve' },
      { id: 'leftEye', type: 'aperture' },
      { id: 'rightEye', type: 'aperture' },
      { id: 'mouth', type: 'curve' },
      { id: 'cheeks', type: 'position' },
    ];

    // 获取基准表情
    const baseExpression = this.getBaseExpression(emotion);

    // 生成动画帧
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const t = i / Math.max(frameCount - 1, 1); // 归一化时间
      const easedT = this.applyTransition(t, transition);
      const frame = this.interpolateExpression(baseExpression, easedT, intensity);
      frames.push({ time: t, keypoints: frame });
    }

    return {
      version: '1.0',
      keypoints,
      emotion,
      intensity,
      duration,
      fps,
      frameCount,
      frames,
    };
  }

  /**
   * 获取基准表情配置
   */
  private getBaseExpression(emotion: string): any {
    const expressions: Record<string, any> = {
      happy: {
        leftEyebrow: { y: 0, curve: 0.3 },
        rightEyebrow: { y: 0, curve: 0.3 },
        leftEye: { aperture: 0.8, squint: 0.3 },
        rightEye: { aperture: 0.8, squint: 0.3 },
        mouth: { corners: 1.0, openness: 0.2, curve: 0.8 },
        cheeks: { raise: 0.5 },
      },
      sad: {
        leftEyebrow: { y: -0.3, curve: -0.5 },
        rightEyebrow: { y: -0.3, curve: -0.5 },
        leftEye: { aperture: 0.6, squint: 0 },
        rightEye: { aperture: 0.6, squint: 0 },
        mouth: { corners: -0.5, openness: 0, curve: -0.3 },
        cheeks: { raise: -0.2 },
      },
      angry: {
        leftEyebrow: { y: -0.5, curve: -0.8 },
        rightEyebrow: { y: -0.5, curve: -0.8 },
        leftEye: { aperture: 0.9, squint: -0.4 },
        rightEye: { aperture: 0.9, squint: -0.4 },
        mouth: { corners: -0.3, openness: 0.3, curve: -0.5 },
        cheeks: { raise: -0.3 },
      },
      surprised: {
        leftEyebrow: { y: 0.6, curve: 0 },
        rightEyebrow: { y: 0.6, curve: 0 },
        leftEye: { aperture: 1.0, squint: 0 },
        rightEye: { aperture: 1.0, squint: 0 },
        mouth: { corners: 0, openness: 0.7, curve: 0 },
        cheeks: { raise: 0 },
      },
      fear: {
        leftEyebrow: { y: 0.4, curve: -0.4 },
        rightEyebrow: { y: 0.4, curve: -0.4 },
        leftEye: { aperture: 1.0, squint: 0 },
        rightEye: { aperture: 1.0, squint: 0 },
        mouth: { corners: -0.2, openness: 0.3, curve: -0.2 },
        cheeks: { raise: -0.1 },
      },
      neutral: {
        leftEyebrow: { y: 0, curve: 0 },
        rightEyebrow: { y: 0, curve: 0 },
        leftEye: { aperture: 0.7, squint: 0 },
        rightEye: { aperture: 0.7, squint: 0 },
        mouth: { corners: 0, openness: 0, curve: 0 },
        cheeks: { raise: 0 },
      },
    };

    return expressions[emotion] || expressions.neutral;
  }

  /**
   * 插值表情
   */
  private interpolateExpression(baseExpression: any, t: number, intensity: number): any {
    const result: any = {};

    for (const [key, value] of Object.entries(baseExpression)) {
      result[key] = {};
      for (const [prop, val] of Object.entries(value as any)) {
        // 应用强度和时间插值
        result[key][prop] = (val as number) * t * intensity;
      }
    }

    return result;
  }

  /**
   * 应用过渡曲线
   */
  private applyTransition(t: number, transition: string): number {
    switch (transition) {
      case 'instant':
        return t < 0.1 ? 0 : 1;

      case 'elastic': {
        // 弹性效果
        if (t === 0 || t === 1) return t;
        const p = 0.3;
        const s = p / 4;
        return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
      }

      case 'smooth':
      default:
        // Smoothstep
        return t * t * (3 - 2 * t);
    }
  }

  /**
   * 生成表情预览图 (使用FFmpeg绘制简单表情符号)
   */
  private generateExpressionPreview(
    expressionData: any,
    outputPath: string,
    emotion: string
  ): void {
    // 根据情感选择颜色
    const colors: Record<string, string> = {
      happy: 'yellow',
      sad: 'blue',
      angry: 'red',
      surprised: 'orange',
      fear: 'purple',
      neutral: 'gray',
    };

    const color = colors[emotion] || 'gray';

    // 使用FFmpeg生成纯色占位图
    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=256x256 -frames:v 1 "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (error) {
      // Fallback: 创建空文件
      writeFileSync(outputPath, '');
    }
  }
}
