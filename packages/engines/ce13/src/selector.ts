import { CE13Input } from './types';

export enum CE13EngineSelector {
    REAL = 'real',
    REPLAY = 'replay',
}

export function ce13Selector(input: CE13Input): CE13EngineSelector {
    // 默认使用 Real 引擎，除非显式要求 Replay
    if (input.context?.engine_mode === 'replay') {
        return CE13EngineSelector.REPLAY;
    }
    return CE13EngineSelector.REAL;
}
