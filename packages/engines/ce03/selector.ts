import { CE03Input, CE03Output } from './types';
import { ce03RealEngine } from './real';
import { ce03ReplayEngine } from './replay';

export type Stage3EngineMode = 'REAL' | 'REPLAY' | 'LEGACY_STUB';

function getMode(): Stage3EngineMode {
    const v = process.env.STAGE3_ENGINE_MODE?.toUpperCase();
    if (v === 'REAL' || v === 'REPLAY' || v === 'LEGACY_STUB') return v as Stage3EngineMode;
    return 'REPLAY'; // Default safe mode
}

export async function ce03Selector(input: CE03Input): Promise<CE03Output | null> {
    const mode = getMode();
    if (mode === 'REAL') return ce03RealEngine(input);
    if (mode === 'REPLAY') return ce03ReplayEngine(input);
    // LEGACY_STUB: return null
    return null;
}

// Class wrapper for compatibility if needed
export class CE03EngineSelector {
    async invoke(input: CE03Input): Promise<CE03Output | null> {
        return ce03Selector(input);
    }
}
