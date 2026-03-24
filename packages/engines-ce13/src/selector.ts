import { CE13Input } from './types';

export enum CE13EngineSelector {
  REAL = 'real',
  REPLAY = 'replay',
}

export function ce13Selector(input: CE13Input): CE13EngineSelector {
  if (input.context?.engine_mode === 'replay') {
    throw new Error('CE13_REPLAY_REMOVED: replay mode is no longer supported');
  }
  return CE13EngineSelector.REAL;
}
