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
export declare function validateNlpOutput(output: any): output is NlpBaseOutput;
