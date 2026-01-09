/**
 * P0-R0: ShotRender Provider Index
 * 
 * 统一导出所有渲染后端 Provider
 * 环境变量: SHOT_RENDER_PROVIDER (默认 replicate)
 */

import { replicateProvider, RenderResult } from './replicate.provider';

export interface ShotRenderProvider {
    key: 'replicate' | 'hf' | 'local';
    render(prompt: string, options?: {
        width?: number;
        height?: number;
        seed?: number;
        negativePrompt?: string;
    }): Promise<RenderResult>;
}

export { RenderResult };

// Provider Registry
const providers: Record<string, ShotRenderProvider> = {
    replicate: replicateProvider,
    // hf: hfProvider,  // 占位 - 未来实现
    // local: localProvider,  // 占位 - 未来实现
};

/**
 * 获取当前配置的 Provider
 */
export function getProvider(): ShotRenderProvider {
    const providerKey = process.env.SHOT_RENDER_PROVIDER || 'replicate';
    const provider = providers[providerKey];

    if (!provider) {
        throw new Error(`[RENDER_ERROR] Unknown provider: ${providerKey}. Available: ${Object.keys(providers).join(', ')}`);
    }

    return provider;
}

/**
 * 使用默认 Provider 进行渲染
 */
export async function renderWithProvider(
    prompt: string,
    options?: {
        width?: number;
        height?: number;
        seed?: number;
        negativePrompt?: string;
    }
): Promise<RenderResult> {
    const provider = getProvider();
    return provider.render(prompt, options);
}
