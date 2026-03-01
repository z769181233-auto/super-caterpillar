/**
 * tensionCurveMapper.ts
 * P6.2.4 要求：曲线点与 Shot 的映射必须可审计、可回放
 * 规则：每个 CurvePoint 必须携带 shotId（不允许数组下标隐式绑定）
 */
import { EmotionalFrame } from '../types';

export type CurvePoint = {
  shotId: string; // 显式绑定 —— 不允许用 index 推算
  x: number; // 0~100 in SVG viewBox space
  y: number; // 0~100 in SVG viewBox space (inverted: 0=top)
  tensionScore: number; // 0~100
  isCollapse: boolean; // true if the shot has diagnostics
};

/**
 * 将 InsightsPayload.frames 映射为曲线渲染点列表。
 * 采样算法：均匀步长（最多 maxPoints 个点）。
 * 每个点携带 shotId，禁止在调用方通过 index 反查 shotId。
 */
export function mapFramesToCurvePoints(frames: EmotionalFrame[], maxPoints = 12): CurvePoint[] {
  if (!frames || frames.length === 0) return [];

  const step = Math.max(1, Math.floor(frames.length / maxPoints));
  const sampled = frames.filter((_, i) => i % step === 0).slice(0, maxPoints);
  const total = sampled.length;

  return sampled.map((frame, i) => ({
    shotId: frame.shotId, // 显式绑定
    x: total > 1 ? (i / (total - 1)) * 100 : 50,
    y: 100 - frame.tensionScore * 0.8, // invert so high = top
    tensionScore: frame.tensionScore,
    isCollapse: !!frame.diagnostics,
  }));
}
