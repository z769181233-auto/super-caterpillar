/**
 * CE02 Identity Lock Engine - Selector
 * 
 * 功能：根据环境变量选择引擎模式（REAL/REPLAY/LEGACY_STUB）
 */

import { CE02IdentityLockInput, CE02IdentityLockOutput } from './types';
import { ce02RealEngine } from './real';
import { ce02ReplayEngine } from './replay';

export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

function getMode(): Stage3EngineMode {
    const v = process.env.STAGE3_ENGINE_MODE?.toUpperCase();
    if (v === 'REAL' || v === 'REPLAY' || v === 'LEGACY_STUB') return v as Stage3EngineMode;
    return 'REPLAY'; // 默认 REPLAY 确保测试稳定性
}

/**
 * CE02 引擎选择器函数
 */
export async function ce02Selector(input: CE02IdentityLockInput): Promise<CE02IdentityLockOutput | null> {
    const mode = getMode();

    if (mode === 'REAL') {
        return ce02RealEngine(input);
    }
    if (mode === 'REPLAY') {
        return ce02ReplayEngine(input);
    }

    // LEGACY_STUB: 返回 null 让调用方使用规则逻辑
    return null;
}

/**
 * CE02 引擎选择器类（兼容旧代码调用方式）
 */
export class CE02EngineSelector {
    async invoke(input: CE02IdentityLockInput): Promise<CE02IdentityLockOutput | null> {
        return ce02Selector(input);
    }
}
