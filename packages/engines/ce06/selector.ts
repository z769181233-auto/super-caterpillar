import { CE06Input, CE06Output } from './types';
import { ce06ReplayEngine } from './replay';
import { ce06RealEngine } from './real';

export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

function getMode(): Stage3EngineMode {
    const v = process.env.STAGE3_ENGINE_MODE?.toUpperCase();
    if (v === 'REAL' || v === 'REPLAY' || v === 'LEGACY_STUB') return v as Stage3EngineMode;
    return 'REPLAY';
}

export async function ce06Selector(input: CE06Input): Promise<CE06Output | null> {
    const mode = getMode();
    if (mode === 'REAL') return ce06RealEngine(input);
    if (mode === 'REPLAY') return ce06ReplayEngine(input);
    // LEGACY_STUB: return null to let caller use rule-based logic
    return null;
}

// 保留类形式以兼容旧代码
export class CE06EngineSelector {
    async invoke(input: CE06Input): Promise<CE06Output | null> {
        return ce06Selector(input);
    }
}
