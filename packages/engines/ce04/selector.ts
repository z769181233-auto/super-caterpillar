import { CE04Input, CE04Output } from './types';
import { ce04RealEngine } from './real';
import { ce04ReplayEngine } from './replay';

export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

function getMode(): Stage3EngineMode {
    const v = process.env.STAGE3_ENGINE_MODE?.toUpperCase();
    if (v === 'REAL' || v === 'REPLAY' || v === 'LEGACY_STUB') return v as Stage3EngineMode;
    return 'REPLAY'; // Default
}

export async function ce04Selector(input: CE04Input): Promise<CE04Output | null> {
    const mode = getMode();
    if (mode === 'REAL') return ce04RealEngine(input);
    if (mode === 'REPLAY') return ce04ReplayEngine(input);
    // LEGACY_STUB: return null
    return null;
}

export class CE04EngineSelector {
    async invoke(input: CE04Input): Promise<CE04Output | null> {
        return ce04Selector(input);
    }
}
