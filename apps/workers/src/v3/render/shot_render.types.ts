/**
 * P2-FIX-2: Shot Render 输入类型单一真源
 * 
 * 目的：确保 shotId/traceId 在调用链中不丢失
 */

export interface ShotRenderInput {
    prompt: string;
    negativePrompt?: string | null;
    seed: number;
    width?: number;
    height?: number;

    // P2-FIX-2: Required for artifact naming & evidence
    shotId: string;
    traceId: string;

    // Optional context
    projectId?: string;
    attempt?: number;
    style?: string;

    // Advanced options
    controlnetSettings?: any;
    assetBindings?: Record<string, string>;
    context?: {
        projectId?: string;
    };
}

export interface ShotRenderOutput {
    asset: {
        uri: string;
        sha256: string;
        videoUri?: string;
    };
    render_meta: {
        seed: number;
        model: string;
        width: number;
        height: number;
        gpuSeconds: number;
    };
    audit_trail: any;
}
