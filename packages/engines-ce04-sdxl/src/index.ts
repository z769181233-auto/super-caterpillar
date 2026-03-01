import { CE03Input, CE03Output } from '@scu/engines-ce03';

export type SDXLInput = CE03Input;
export type SDXLOutput = CE03Output;

export const sdxlRealEngine = {
    id: 'ce04-sdxl',
    run: async (input: SDXLInput) => ({ ok: true, engine: 'sdxl-stub', input })
};
