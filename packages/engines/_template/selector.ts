/**
 * 引擎母版 - Selector（模式选择器）
 *
 * 支持三种模式:
 * - REAL: 真实引擎（调用 API / GPU）
 * - REPLAY: 确定性重放（测试用）
 * - LEGACY_STUB: 兼容旧版 Stub
 */

import { __ENGINE__Input, __ENGINE__Output } from './types';
import { __ENGINE__RealEngine } from './real';
import { __ENGINE__ReplayEngine } from './replay';

export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

function getMode(): Stage3EngineMode {
  const v = process.env.STAGE3_ENGINE_MODE?.toUpperCase();
  if (v === 'REAL' || v === 'REPLAY' || v === 'LEGACY_STUB') return v as Stage3EngineMode;
  return 'REPLAY'; // 默认 REPLAY 确保测试稳定性
}

/**
 * 引擎选择器函数
 */
export async function __ENGINE__Selector(input: __ENGINE__Input): Promise<__ENGINE__Output | null> {
  const mode = getMode();

  if (mode === 'REAL') {
    return __ENGINE__RealEngine(input);
  }
  if (mode === 'REPLAY') {
    return __ENGINE__ReplayEngine(input);
  }

  // LEGACY_STUB: 返回 null 让调用方使用规则逻辑
  return null;
}

/**
 * 引擎选择器类（兼容旧代码调用方式）
 */
export class __ENGINE__EngineSelector {
  async invoke(input: __ENGINE__Input): Promise<__ENGINE__Output | null> {
    return __ENGINE__Selector(input);
  }
}
