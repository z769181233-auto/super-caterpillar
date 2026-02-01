/**
 * NLP Output Schema
 * 强制输出结构标准，确保 CE 类引擎的可观测性一致性
 */

export interface NlpBaseOutput {
    status: 'PASS' | 'FAIL';
    analysis: any;
    metrics: {
        chars: number;
        estimatedTokens: number;
        durationMs?: number;
    };
    meta: {
        source: 'cache' | 'generated';
        implementation: string;
        cached?: boolean;
    };
}

export function validateNlpOutput(output: any): output is NlpBaseOutput {
    return (
        output &&
        (output.status === 'PASS' || output.status === 'FAIL') &&
        output.metrics &&
        typeof output.metrics.chars === 'number' &&
        output.meta &&
        output.meta.source
    );
}
